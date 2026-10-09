// Integration tests: the backend speaks the customer website's API contract (root app.js / docs/WEBSITE.md).
// Uses an in-memory MongoDB and a fake Razorpay client, so no database server or payment keys are needed.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.CLIENT_URL = 'http://localhost:8080';

// Fake Razorpay Payment Links API, swapped in before the app loads src/config/razorpay.js.
const links = new Map();
const fakeRazorpay = {
  createCalls: [],
  paymentLink: {
    create: async (body) => {
      fakeRazorpay.createCalls.push(body);
      const link = { id: `plink_${links.size + 1}`, short_url: `https://rzp.io/i/test${links.size + 1}`, status: 'created', amount: body.amount, amount_paid: 0, payments: null };
      links.set(link.id, link);
      return link;
    },
    fetch: async (id) => links.get(id),
  },
};
const razorpayPath = require.resolve('../src/config/razorpay');
require.cache[razorpayPath] = { id: razorpayPath, filename: razorpayPath, loaded: true, exports: fakeRazorpay };

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const { seed } = require('../scripts/seed');
const MenuItem = require('../src/models/MenuItem');
const Order = require('../src/models/Order');
const Table = require('../src/models/Table');

let mongo;
const quiet = () => {};

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await seed({ log: quiet });
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const menuId = async (name) => String((await MenuItem.findOne({ name }))._id);
const placeOrder = async (items) =>
  request(app)
    .post('/api/orders')
    .send({ tableId: 'T05', channel: 'qr', customer: { name: 'Asha', phone: '9000000000' }, paymentMethod: 'online', items, clientSubtotal: 1 });

test('seed loads the shared menu and tables, and is safe to run twice', async () => {
  await seed({ log: quiet });
  assert.equal(await MenuItem.countDocuments(), 16);
  assert.equal(await Table.countDocuments(), 10);
  const biryani = await MenuItem.findOne({ name: 'Chicken Biryani' }).populate('category');
  assert.equal(biryani.price, 160);
  assert.equal(biryani.category.name, 'Biryani');
  assert.equal(biryani.imageUrl, 'assets/menu/chicken-biryani.jpg');
});

test('GET /api/menu keeps data.menu and adds the website `items` list', async () => {
  const res = await request(app).get('/api/menu');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.menu.length, 16);
  const item = res.body.items.find((i) => i.name === 'Mutton Handi');
  assert.deepEqual(Object.keys(item).sort(), ['available', 'category', 'description', 'id', 'imageUrl', 'name', 'price']);
  assert.equal(item.category, 'Mutton');
  assert.equal(item.price, 320);
  assert.equal(item.available, true);
});

test('POST /api/orders accepts the website body and returns orderId/total/status at the top level', async () => {
  const res = await placeOrder([{ menuItemId: await menuId('Chicken Biryani'), quantity: 2 }]);
  assert.equal(res.status, 201);
  assert.match(res.body.orderId, /^ORD-/);
  assert.equal(res.body.status, 'Pending');
  assert.equal(res.body.total, 336); // 2 x 160 + 5% tax, calculated on the server
  assert.equal(res.body.data.order.customerName, 'Asha');
  assert.equal(res.body.data.order.totalAmount, 336);
});

test('POST /api/orders rejects bad or unavailable dishes with 400, not a server error', async () => {
  assert.equal((await placeOrder([{ menuItemId: 'chicken-biryani', quantity: 1 }])).status, 400);
  await MenuItem.updateOne({ name: 'Fish Roast' }, { isAvailable: false });
  assert.equal((await placeOrder([{ menuItemId: await menuId('Fish Roast'), quantity: 1 }])).status, 400);
  await MenuItem.updateOne({ name: 'Fish Roast' }, { isAvailable: true });
});

test('customers can track their order by Order ID without logging in; staff lookup stays protected', async () => {
  const { body } = await placeOrder([{ menuItemId: await menuId('Egg Biryani'), quantity: 1 }]);
  const res = await request(app).get(`/api/orders/${body.orderId}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'Pending');
  assert.equal(res.body.total, 126);
  assert.equal(res.body.customerName, undefined);

  await Order.updateOne({ orderId: body.orderId }, { status: 'Served/Completed' });
  assert.equal((await request(app).get(`/api/orders/${body.orderId}`)).body.status, 'Served');

  assert.equal((await request(app).get('/api/orders/ORD-0-MISSING')).status, 404);
  const order = await Order.findOne({ orderId: body.orderId });
  assert.equal((await request(app).get(`/api/orders/${order._id}`)).status, 401);
});

test('online payment: initiate returns a Razorpay checkout URL for the server-side total, verify asks Razorpay', async () => {
  const { body: order } = await placeOrder([{ menuItemId: await menuId('Mutton Handi'), quantity: 1 }]);
  const returnUrl = `http://localhost:8080/?table=T05&payment_return=1&orderId=${order.orderId}`;

  const evil = await request(app).post('/api/payments/initiate').send({ orderId: order.orderId, returnUrl: 'https://evil.example/' });
  assert.equal(evil.status, 400);

  const started = await request(app).post('/api/payments/initiate').send({ orderId: order.orderId, returnUrl });
  assert.equal(started.status, 201);
  assert.match(started.body.checkoutUrl, /^https:\/\//);
  const call = fakeRazorpay.createCalls.at(-1);
  assert.equal(call.amount, 33600); // ₹336 in paise, from the order, not from the browser
  assert.equal(call.callback_url, returnUrl);

  const again = await request(app).post('/api/payments/initiate').send({ orderId: order.orderId, returnUrl });
  assert.equal(again.body.checkoutUrl, started.body.checkoutUrl);
  assert.equal(fakeRazorpay.createCalls.filter((c) => c.notes.orderId === order.orderId).length, 1);

  const verify = () => request(app).post('/api/payments/verify').send({ orderId: order.orderId, paymentReference: null });
  assert.equal((await verify()).body.paymentStatus, 'pending');

  const link = [...links.values()].find((l) => l.short_url === started.body.checkoutUrl);
  Object.assign(link, { status: 'paid', amount_paid: 33600, payments: [{ payment_id: 'pay_TEST1', status: 'captured' }] });
  const paid = await verify();
  assert.equal(paid.status, 200);
  assert.equal(paid.body.paymentStatus, 'paid');
  assert.equal(paid.body.orderStatus, 'Accepted');
  const saved = await Order.findOne({ orderId: order.orderId });
  assert.equal(saved.paymentStatus, 'Paid');
  assert.equal((await verify()).body.paymentStatus, 'paid');
  assert.equal((await request(app).post('/api/payments/initiate').send({ orderId: order.orderId, returnUrl })).status, 409);
});

test('a partly paid link is not accepted as payment', async () => {
  const { body: order } = await placeOrder([{ menuItemId: await menuId('Egg Biryani'), quantity: 1 }]);
  const returnUrl = 'http://localhost:8080/?payment_return=1';
  const started = await request(app).post('/api/payments/initiate').send({ orderId: order.orderId, returnUrl });
  const link = [...links.values()].find((l) => l.short_url === started.body.checkoutUrl);
  Object.assign(link, { status: 'paid', amount_paid: 100, payments: [{ payment_id: 'pay_TEST2', status: 'captured' }] });
  const res = await request(app).post('/api/payments/verify').send({ orderId: order.orderId });
  assert.notEqual(res.body.paymentStatus, 'paid');
});

test('the existing Razorpay popup verify (with signature) still uses its own check', async () => {
  const { body: order } = await placeOrder([{ menuItemId: await menuId('Chicken Fry'), quantity: 1 }]);
  // Several customers can have unpaid online payments at the same time.
  const started = await request(app).post('/api/payments/initiate').send({ orderId: order.orderId, returnUrl: 'http://localhost:8080/' });
  assert.equal(started.status, 201);
  const res = await request(app).post('/api/payments/verify').send({ orderId: order.orderId, paymentId: 'pay_X', signature: 'forged' });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /invalid signature/);
});

test('CORS allows the website origin with cookies and refuses other origins', async () => {
  const ok = await request(app).get('/api/health').set('Origin', 'http://localhost:8080');
  assert.equal(ok.headers['access-control-allow-origin'], 'http://localhost:8080');
  assert.equal(ok.headers['access-control-allow-credentials'], 'true');
  const other = await request(app).get('/api/health').set('Origin', 'https://evil.example');
  assert.equal(other.headers['access-control-allow-origin'], undefined);
});

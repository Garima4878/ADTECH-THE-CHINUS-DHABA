// Integration tests for the restaurant admin dashboard API (/api/admin) and staff login.
// In-memory MongoDB; the customer website's order flow is used to create real orders.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.SEED_ADMIN_PASSWORD = 'admin-pass-123';
process.env.JWT_SECRET = 'test-secret';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const { seed } = require('../scripts/seed');
const MenuItem = require('../src/models/MenuItem');

let mongo;
let adminToken;
let employeeToken;
let managerToken;

const login = async (username, password) => (await request(app).post('/api/auth/login').send({ username, password })).body.data.token;
const as = (token) => ({
  get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  post: (url, body) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body),
  put: (url, body) => request(app).put(url).set('Authorization', `Bearer ${token}`).send(body),
  patch: (url, body) => request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body),
  delete: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
});
const menuId = async (name) => String((await MenuItem.findOne({ name }))._id);
const websiteOrder = async (tableId, dish, quantity = 1, phone = '9000000001') =>
  (await request(app).post('/api/orders').send({
    tableId,
    customer: { name: 'Ravi', phone, note: 'less spicy' },
    paymentMethod: 'counter',
    items: [{ menuItemId: await menuId(dish), quantity }],
  })).body;
const adminOrderId = async (orderNumber) => (await as(adminToken).get(`/api/admin/orders?search=${orderNumber}`)).body.data[0].id;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await seed({ log: () => {} });
  adminToken = await login('admin', 'admin-pass-123');
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

test('staff log in with a username; wrong passwords and public sign-up are refused', async () => {
  const ok = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin-pass-123' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.user.role, 'admin');
  assert.equal((await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong' })).status, 401);

  // Registering used to be public and created admins for anyone.
  assert.equal((await request(app).post('/api/auth/register').send({ name: 'X', email: 'x@x.com', password: 'secret1' })).status, 401);
  assert.equal((await request(app).get('/api/admin/orders')).status, 401);
});

test('admin creates employee and manager accounts; roles are enforced by the server', async () => {
  const employee = await as(adminToken).post('/api/admin/staff', { name: 'Sunil', username: 'sunil', role: 'employee', password: 'kitchen1', isActive: true });
  assert.equal(employee.status, 201);
  assert.equal(employee.body.data.role, 'employee');
  const manager = await as(adminToken).post('/api/admin/staff', { name: 'Meena', username: 'meena', email: 'meena@chinu.test', role: 'manager', password: 'manager1', isActive: true });
  assert.equal(manager.status, 201);
  assert.equal((await as(adminToken).post('/api/admin/staff', { name: 'Dup', username: 'sunil', role: 'employee', password: 'kitchen1' })).status, 409);

  employeeToken = await login('sunil', 'kitchen1');
  managerToken = await login('meena@chinu.test', 'manager1');
  assert.ok(employeeToken && managerToken);

  assert.equal((await as(employeeToken).get('/api/admin/orders')).status, 200);
  assert.equal((await as(employeeToken).get('/api/admin/staff')).status, 403);
  assert.equal((await as(employeeToken).get('/api/admin/payments')).status, 403);
  assert.equal((await as(employeeToken).post('/api/admin/menu/categories', { name: 'Drinks' })).status, 403);
  assert.equal((await as(managerToken).get('/api/admin/payments')).status, 200);
  assert.equal((await as(managerToken).get('/api/admin/staff')).status, 403);

  const list = await as(adminToken).get('/api/admin/staff');
  assert.deepEqual(list.body.data.map((u) => u.username).sort(), ['admin', 'meena', 'sunil']);
});

test('admins cannot lock themselves out; deactivated staff are signed out', async () => {
  const me = (await as(adminToken).get('/api/admin/staff')).body.data.find((u) => u.username === 'admin');
  assert.equal((await as(adminToken).put(`/api/admin/staff/${me.id}`, { isActive: false })).status, 400);
  assert.equal((await as(adminToken).put(`/api/admin/staff/${me.id}`, { role: 'employee' })).status, 400);
  assert.equal((await as(adminToken).delete(`/api/admin/staff/${me.id}`)).status, 400);

  await as(adminToken).post('/api/admin/staff', { name: 'Temp', username: 'temp', role: 'employee', password: 'temp123' });
  const tempToken = await login('temp', 'temp123');
  const temp = (await as(adminToken).get('/api/admin/staff')).body.data.find((u) => u.username === 'temp');
  await as(adminToken).put(`/api/admin/staff/${temp.id}`, { isActive: false });
  assert.equal((await as(tempToken).get('/api/admin/orders')).status, 401);
  assert.equal((await request(app).post('/api/auth/login').send({ username: 'temp', password: 'temp123' })).status, 401);
});

test('website orders appear on the dashboard in its order shape, with filters and paging', async () => {
  const placed = await websiteOrder('T05', 'Chicken Biryani', 2, '9000000005');
  const res = await as(employeeToken).get('/api/admin/orders?status=Pending&limit=5');
  assert.equal(res.status, 200);
  const order = res.body.data.find((o) => o.orderNumber === placed.orderId);
  assert.equal(order.tableNumber, 'T05');
  assert.equal(order.customerPhone, '9000000005');
  assert.equal(order.notes, 'less spicy');
  assert.deepEqual(order.items.map((i) => [i.name, i.quantity, i.price]), [['Chicken Biryani', 2, 160]]);
  assert.equal(order.totalAmount, 336);
  assert.equal(order.taxAmount, 16);
  assert.equal(order.paymentStatus, 'Unpaid');
  assert.equal(order.statusHistory[0].status, 'Pending');
  assert.deepEqual(Object.keys(res.body.meta).sort(), ['limit', 'page', 'total', 'totalPages']);

  assert.equal((await as(adminToken).get('/api/admin/orders?search=9000000005')).body.data.length, 1);
  assert.equal((await as(adminToken).get('/api/admin/orders?tableId=t05')).body.data[0].orderNumber, placed.orderId);
  assert.equal((await as(adminToken).get(`/api/admin/orders/${order.id}`)).body.data.orderNumber, placed.orderId);
  assert.equal((await as(adminToken).get('/api/admin/orders/not-an-id')).status, 404);
});

test('kitchen status updates reach the customer, with history and cancel rules', async () => {
  const placed = await websiteOrder('T06', 'Mutton Handi');
  const id = await adminOrderId(placed.orderId);

  for (const status of ['Accepted', 'Preparing']) {
    const res = await as(employeeToken).patch(`/api/admin/orders/${id}/status`, { status });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, status);
  }
  assert.equal((await request(app).get(`/api/orders/${placed.orderId}`)).body.status, 'Preparing');

  const detail = (await as(adminToken).get(`/api/admin/orders/${id}`)).body.data;
  assert.deepEqual(detail.statusHistory.map((h) => h.status), ['Pending', 'Accepted', 'Preparing']);
  assert.equal(detail.statusHistory[2].by, 'Sunil');

  assert.equal((await as(employeeToken).patch(`/api/admin/orders/${id}/status`, { status: 'Accepted' })).status, 400);
  assert.equal((await as(managerToken).patch(`/api/admin/orders/${id}/status`, { status: 'Cancelled' })).status, 400);

  await as(employeeToken).patch(`/api/admin/orders/${id}/status`, { status: 'Ready' });
  const done = await as(employeeToken).patch(`/api/admin/orders/${id}/status`, { status: 'Completed' });
  assert.equal(done.body.data.status, 'Completed');
  assert.equal((await request(app).get(`/api/orders/${placed.orderId}`)).body.status, 'Served');

  const other = await websiteOrder('T07', 'Egg Biryani');
  const otherId = await adminOrderId(other.orderId);
  assert.equal((await as(employeeToken).patch(`/api/admin/orders/${otherId}/status`, { status: 'Cancelled' })).status, 403);
  const cancelled = await as(managerToken).patch(`/api/admin/orders/${otherId}/status`, { status: 'Cancelled' });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.data.status, 'Cancelled');
});

test('counter payments are recorded and show on the payments page', async () => {
  const placed = await websiteOrder('T08', 'Veg Thali', 2);
  const id = await adminOrderId(placed.orderId);
  assert.equal((await as(employeeToken).patch(`/api/admin/orders/${id}/payment`, { status: 'Paid', method: 'Bitcoin' })).status, 400);

  const paid = await as(employeeToken).patch(`/api/admin/orders/${id}/payment`, { status: 'Paid', method: 'UPI' });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.data.paymentStatus, 'Paid');
  assert.equal(paid.body.data.payment.method, 'UPI');
  assert.equal((await as(employeeToken).patch(`/api/admin/orders/${id}/payment`, { status: 'Paid', method: 'Cash' })).status, 409);
  assert.equal((await request(app).get(`/api/orders/${placed.orderId}`)).body.paymentStatus, 'paid');

  const payments = await as(managerToken).get('/api/admin/payments?status=Paid&method=UPI');
  const row = payments.body.data.find((p) => p.orderNumber === placed.orderId);
  assert.equal(row.amount, 210);
  assert.equal(row.tableNumber, 'T08');
  assert.ok(row.paidAt);
});

test('dashboard stats count today\'s orders, revenue and busy tables', async () => {
  const stats = (await as(employeeToken).get('/api/admin/dashboard/stats')).body.data;
  assert.equal(stats.todayOrders, 4);
  assert.equal(stats.todayRevenue, 210);
  assert.equal(stats.pendingOrders, 2); // T05, and T08 (paid but not started yet)
  assert.equal(stats.completedOrders, 1);
  assert.equal(stats.cancelledOrders, 1);
  assert.equal(stats.unpaidAmount, 336 + 336); // T05 open + T06 served unpaid
  assert.equal(stats.occupiedTables, 2); // T05 and T08 have open orders
  assert.equal(stats.totalTables, 10);
});

test('menu changes on the dashboard reach the website', async () => {
  const categories = (await as(managerToken).get('/api/admin/menu/categories')).body.data;
  const chicken = categories.find((c) => c.name === 'Chicken');
  assert.equal(chicken.itemCount, 3);

  const created = await as(managerToken).post('/api/admin/menu/items', { name: 'Chicken Tikka', price: 230, categoryId: chicken.id, isVeg: false, isSpicy: true });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.categoryName, 'Chicken');
  assert.equal((await as(managerToken).post('/api/admin/menu/items', { name: 'Bad', price: -1, categoryId: chicken.id })).status, 400);

  const fish = (await as(employeeToken).get('/api/admin/menu/items')).body.data.find((i) => i.name === 'Fish Roast');
  assert.equal(fish.isVeg, false);
  assert.equal((await as(managerToken).patch(`/api/admin/menu/items/${fish.id}/availability`, { isAvailable: false })).body.data.isAvailable, false);
  const website = (await request(app).get('/api/menu')).body.items;
  assert.equal(website.find((i) => i.name === 'Fish Roast').available, false);
  assert.ok(website.find((i) => i.name === 'Chicken Tikka'));

  const biryani = (await as(employeeToken).get('/api/admin/menu/items')).body.data.find((i) => i.name === 'Chicken Biryani');
  assert.equal((await as(managerToken).delete(`/api/admin/menu/items/${biryani.id}`)).status, 400); // used in an order
  assert.equal((await as(managerToken).delete(`/api/admin/menu/items/${created.body.data.id}`)).status, 200);
});

test('categories: duplicates and deleting non-empty categories are refused', async () => {
  const drinks = await as(managerToken).post('/api/admin/menu/categories', { name: 'Drinks', description: 'Cold drinks', isActive: true });
  assert.equal(drinks.status, 201);
  assert.equal((await as(managerToken).post('/api/admin/menu/categories', { name: 'drinks' })).status, 409);
  const roti = (await as(managerToken).get('/api/admin/menu/categories')).body.data.find((c) => c.name === 'Roti');
  assert.equal((await as(managerToken).delete(`/api/admin/menu/categories/${roti.id}`)).status, 400);
  assert.equal((await as(managerToken).delete(`/api/admin/menu/categories/${drinks.body.data.id}`)).status, 200);
});

test('tables: occupied status, new tables work for QR ordering, safe deletes', async () => {
  const tables = (await as(employeeToken).get('/api/admin/tables')).body.data;
  const t05 = tables.find((t) => t.number === 'T05');
  assert.equal(t05.status, 'Occupied');
  assert.ok(t05.currentOrderId);
  assert.equal(tables.find((t) => t.number === 'T01').status, 'Free');

  const t11 = await as(managerToken).post('/api/admin/tables', { number: 't11', capacity: 6, isActive: true });
  assert.equal(t11.status, 201);
  assert.equal(t11.body.data.number, 'T11');
  assert.equal((await as(managerToken).post('/api/admin/tables', { number: 'T11', capacity: 2 })).status, 409);
  assert.match((await websiteOrder('T11', 'Chicken Fry')).orderId, /^ORD-/);

  const t01 = tables.find((t) => t.number === 'T01');
  assert.equal((await as(employeeToken).patch(`/api/admin/tables/${t01.id}/status`, { status: 'Cleaning' })).status, 403);
  assert.equal((await as(managerToken).patch(`/api/admin/tables/${t01.id}/status`, { status: 'Cleaning' })).body.data.status, 'Cleaning');
  assert.equal((await as(managerToken).delete(`/api/admin/tables/${t05.id}`)).status, 400);

  const t12 = await as(managerToken).post('/api/admin/tables', { number: 'T12', capacity: 2 });
  assert.equal((await as(managerToken).delete(`/api/admin/tables/${t12.body.data.id}`)).status, 200);
});

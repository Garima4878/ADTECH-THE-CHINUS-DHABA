// Flat shapes for the customer website (root app.js), which reads fields like `id`, `available`,
// `orderId`, `total` and `status` at the top level of the JSON response (see README "Backend connection").
// They are added next to the normal { success, message, data } payload, so existing clients are unaffected.

const toWebsiteStatus = (status) => (status === 'Served/Completed' ? 'Served' : status);

const menuItemForWebsite = (item) => ({
  id: String(item._id),
  name: item.name,
  description: item.description || '',
  price: item.price,
  category: item.category && typeof item.category === 'object' ? item.category.name : 'Other',
  imageUrl: item.imageUrl || '',
  available: item.isAvailable,
});

// Only what a customer needs to track their order: no customer name or staff-only details.
const orderForWebsite = (order) => ({
  id: order.orderId,
  orderId: order.orderId,
  status: toWebsiteStatus(order.status),
  subtotal: order.subtotal,
  tax: order.tax,
  total: order.totalAmount,
  paymentStatus: String(order.paymentStatus || '').toLowerCase(),
  tableId: order.tableId,
  createdAt: order.createdAt,
});

module.exports = { toWebsiteStatus, menuItemForWebsite, orderForWebsite };

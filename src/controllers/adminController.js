// API for the restaurant admin dashboard (admin-dashboard/). Shapes follow its contract in
// admin-dashboard/README.md and src/types: `data` holds the object or list, lists add `meta` for paging.
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const MenuItem = require('../models/MenuItem');
const Category = require('../models/Category');
const Table = require('../models/Table');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { applyStatusChange } = require('./orderController');

const OPEN_STATUSES = ['Pending', 'Accepted', 'Preparing', 'Ready'];
const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'NetBanking', 'Wallet'];
const TABLE_STATUSES = ['Free', 'Occupied', 'Reserved', 'Cleaning'];
const ROLE_OUT = { admin: 'admin', manager: 'manager', staff: 'employee' };
const ROLE_IN = { admin: 'admin', manager: 'manager', employee: 'staff' };

const orderStatusOut = (status) => (status === 'Served/Completed' ? 'Completed' : status);
const orderStatusIn = (status) => (status === 'Completed' ? 'Served/Completed' : status);
const orderPaymentOut = (status) => (status === 'Paid' ? 'Paid' : 'Unpaid');
const paymentStatusOut = (status) => (status === 'paid' ? 'Paid' : 'Unpaid');

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const findById = (Model, id) => (mongoose.isValidObjectId(id) ? Model.findById(id) : null);

const paging = (query) => {
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const page = Math.max(Number(query.page) || 1, 1);
  return { limit, page, skip: (page - 1) * limit };
};
const meta = (page, limit, total) => ({ page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) });

// Inclusive date range on createdAt from YYYY-MM-DD inputs.
const dateRange = (from, to) => {
  const range = {};
  if (from && !Number.isNaN(Date.parse(from))) range.$gte = new Date(from);
  if (to && !Number.isNaN(Date.parse(to))) range.$lt = new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000);
  return Object.keys(range).length ? range : null;
};

// ---------- formatters ----------

const formatPayment = (payment, order) => ({
  id: String(payment._id),
  orderId: String(order ? order._id : payment.order),
  orderNumber: payment.orderId,
  tableNumber: order ? order.tableId : null,
  status: paymentStatusOut(payment.status),
  method: payment.method || null,
  amount: payment.amount,
  paidAmount: payment.status === 'paid' ? payment.amount : 0,
  transactionId: payment.paymentId || null,
  paidAt: payment.paidAt || (payment.status === 'paid' ? payment.updatedAt : null),
});

const formatOrder = (order, payment = null) => ({
  id: String(order._id),
  orderNumber: order.orderId,
  tableId: order.table ? String(order.table._id || order.table) : null,
  tableNumber: order.tableId,
  customerName: order.customerName,
  customerPhone: order.customerPhone || null,
  orderType: order.orderType || 'DineIn',
  items: order.items.map((line) => {
    const item = line.item && typeof line.item === 'object' && line.item.name ? line.item : null;
    const itemId = String(item ? item._id : line.item);
    return { id: itemId, menuItemId: itemId, name: item ? item.name : 'Removed item', quantity: line.quantity, price: line.unitPrice };
  }),
  totalAmount: order.totalAmount,
  discountAmount: 0,
  taxAmount: order.tax,
  status: orderStatusOut(order.status),
  paymentStatus: orderPaymentOut(order.paymentStatus),
  payment: payment ? formatPayment(payment, order) : null,
  placedAt: order.createdAt,
  notes: order.notes || null,
  statusHistory: (order.statusHistory || []).map((entry) => ({ status: orderStatusOut(entry.status), at: entry.at, by: entry.by || undefined })),
});

const formatMenuItem = (item) => ({
  id: String(item._id),
  name: item.name,
  description: item.description || null,
  price: item.price,
  categoryId: item.category ? String(item.category._id || item.category) : '',
  categoryName: item.category && item.category.name ? item.category.name : undefined,
  imageUrl: item.imageUrl || null,
  isVeg: Boolean(item.isVeg),
  isSpicy: Boolean(item.isSpicy),
  isAvailable: item.isAvailable,
});

const formatCategory = (category, itemCount = 0) => ({
  id: String(category._id),
  name: category.name,
  description: category.description || null,
  isActive: category.isActive !== false,
  itemCount,
});

const formatUser = (user) => ({
  id: String(user._id),
  name: user.name,
  username: user.username || user.email,
  role: ROLE_OUT[user.role] || 'employee',
  email: user.email || undefined,
  phone: user.phone || undefined,
  isActive: user.isActive !== false,
});

// ---------- orders ----------

const listOrders = async (req, res, next) => {
  try {
    const { status, paymentStatus, orderType, tableId, search, from, to } = req.query;
    const filter = {};
    if (status) filter.status = orderStatusIn(status);
    if (paymentStatus === 'Paid') filter.paymentStatus = 'Paid';
    else if (paymentStatus === 'Unpaid') filter.paymentStatus = { $ne: 'Paid' };
    else if (paymentStatus) filter.paymentStatus = '__none__'; // Partial/Refunded are not used by this backend
    if (orderType) filter.orderType = orderType;
    if (tableId) {
      filter.$or = [{ tableId: new RegExp(`^${escapeRegex(tableId)}$`, 'i') }];
      if (mongoose.isValidObjectId(tableId)) filter.$or.push({ table: tableId });
    }
    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      filter.$and = [{ $or: [{ orderId: pattern }, { customerName: pattern }, { customerPhone: pattern }, { tableId: pattern }] }];
    }
    const createdAt = dateRange(from, to);
    if (createdAt) filter.createdAt = createdAt;

    const { page, limit, skip } = paging(req.query);
    const [orders, total] = await Promise.all([
      Order.find(filter).populate('items.item', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(filter),
    ]);
    return sendSuccess(res, 200, 'Orders fetched successfully.', orders.map((order) => formatOrder(order)), { meta: meta(page, limit, total) });
  } catch (error) {
    return next(error);
  }
};

const getOrder = async (req, res, next) => {
  try {
    const order = await findById(Order, req.params.id)?.populate('items.item', 'name');
    if (!order) return next(new ApiError(404, 'Order not found.'));
    const payment = await Payment.findOne({ order: order._id });
    return sendSuccess(res, 200, 'Order fetched successfully.', formatOrder(order, payment));
  } catch (error) {
    return next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const order = await findById(Order, req.params.id);
    if (!order) return next(new ApiError(404, 'Order not found.'));

    const status = orderStatusIn(req.body.status);
    if (status === 'Cancelled') {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return sendError(res, 403, 'Only an admin or manager can cancel an order.');
      }
      if (!['Pending', 'Accepted'].includes(order.status)) {
        return sendError(res, 400, 'An order can only be cancelled before the kitchen starts preparing it.');
      }
    }

    const problem = applyStatusChange(order, status, req.user.name);
    if (problem) return sendError(res, 400, problem);

    await order.save();
    await order.populate('items.item', 'name');
    const payment = await Payment.findOne({ order: order._id });
    return sendSuccess(res, 200, 'Order status updated successfully.', formatOrder(order, payment));
  } catch (error) {
    return next(error);
  }
};

// Records a payment taken at the counter (cash, UPI, card...).
const markOrderPaid = async (req, res, next) => {
  try {
    const { status, method } = req.body;
    if (status !== 'Paid') return sendError(res, 400, 'Only marking an order as Paid is supported.');
    if (!PAYMENT_METHODS.includes(method)) return sendError(res, 400, `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}.`);

    const order = await findById(Order, req.params.id);
    if (!order) return next(new ApiError(404, 'Order not found.'));
    if (order.status === 'Cancelled') return sendError(res, 400, 'A cancelled order cannot be marked as paid.');
    if (order.paymentStatus === 'Paid') return sendError(res, 409, 'This order is already paid.');

    const payment = await Payment.findOneAndUpdate(
      { order: order._id },
      {
        order: order._id,
        orderId: order.orderId,
        gateway: 'manual',
        status: 'paid',
        method,
        amount: order.totalAmount,
        currency: 'INR',
        paidAt: new Date(),
        notes: `Marked paid by ${req.user.name}`,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    order.paymentStatus = 'Paid';
    await order.save();
    await order.populate('items.item', 'name');
    return sendSuccess(res, 200, 'Order marked as paid.', formatOrder(order, payment));
  } catch (error) {
    return next(error);
  }
};

// ---------- dashboard ----------

const dashboardStats = async (req, res, next) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const today = { createdAt: { $gte: startOfToday } };

    const [todayOrders, todayPaid, pendingOrders, activeOrders, completedOrders, cancelledOrders, unpaid, openTables, floorOccupied, totalTables] =
      await Promise.all([
        Order.countDocuments(today),
        Order.aggregate([{ $match: { ...today, paymentStatus: 'Paid' } }, { $group: { _id: null, sum: { $sum: '$totalAmount' } } }]),
        Order.countDocuments({ status: 'Pending' }),
        Order.countDocuments({ status: { $in: ['Accepted', 'Preparing', 'Ready'] } }),
        Order.countDocuments({ ...today, status: 'Served/Completed' }),
        Order.countDocuments({ ...today, status: 'Cancelled' }),
        Order.aggregate([
          { $match: { status: { $ne: 'Cancelled' }, paymentStatus: { $ne: 'Paid' } } },
          { $group: { _id: null, sum: { $sum: '$totalAmount' } } },
        ]),
        Order.distinct('tableId', { status: { $in: OPEN_STATUSES } }),
        Table.distinct('tableId', { floorStatus: 'Occupied', status: 'active' }),
        Table.countDocuments({ status: 'active' }),
      ]);

    return sendSuccess(res, 200, 'Dashboard stats fetched successfully.', {
      todayOrders,
      todayRevenue: todayPaid[0] ? todayPaid[0].sum : 0,
      pendingOrders,
      activeOrders,
      completedOrders,
      cancelledOrders,
      unpaidAmount: unpaid[0] ? unpaid[0].sum : 0,
      occupiedTables: new Set([...openTables, ...floorOccupied]).size,
      totalTables,
    });
  } catch (error) {
    return next(error);
  }
};

// ---------- menu ----------

const menuFields = (body) => {
  const fields = {};
  if (body.name !== undefined) fields.name = String(body.name).trim();
  if (body.description !== undefined) fields.description = body.description ? String(body.description).trim() : '';
  if (body.price !== undefined) fields.price = Number(body.price);
  if (body.categoryId !== undefined) fields.category = body.categoryId;
  if (body.imageUrl !== undefined) fields.imageUrl = body.imageUrl || '';
  ['isVeg', 'isSpicy', 'isAvailable'].forEach((key) => {
    if (body[key] !== undefined) fields[key] = Boolean(body[key]);
  });
  return fields;
};

const checkMenuFields = async (fields, creating) => {
  if (creating && !fields.name) return 'Menu item name is required.';
  if (fields.name !== undefined && !fields.name) return 'Menu item name cannot be empty.';
  if ((creating || fields.price !== undefined) && !(Number.isFinite(fields.price) && fields.price >= 0)) return 'Price must be a number of 0 or more.';
  if (creating || fields.category !== undefined) {
    if (!mongoose.isValidObjectId(fields.category) || !(await Category.exists({ _id: fields.category }))) return 'Please choose a valid category.';
  }
  return null;
};

const listMenuItems = async (req, res, next) => {
  try {
    const items = await MenuItem.find().populate('category').sort({ name: 1 });
    return sendSuccess(res, 200, 'Menu fetched successfully.', items.map(formatMenuItem));
  } catch (error) {
    return next(error);
  }
};

const createMenuItem = async (req, res, next) => {
  try {
    const fields = menuFields(req.body);
    const problem = await checkMenuFields(fields, true);
    if (problem) return sendError(res, 400, problem);
    const item = await MenuItem.create(fields);
    await item.populate('category');
    return sendSuccess(res, 201, 'Menu item created successfully.', formatMenuItem(item));
  } catch (error) {
    return next(error);
  }
};

const updateMenuItem = async (req, res, next) => {
  try {
    const item = await findById(MenuItem, req.params.id);
    if (!item) return next(new ApiError(404, 'Menu item not found.'));
    const fields = menuFields(req.body);
    const problem = await checkMenuFields(fields, false);
    if (problem) return sendError(res, 400, problem);
    Object.assign(item, fields);
    await item.save();
    await item.populate('category');
    return sendSuccess(res, 200, 'Menu item updated successfully.', formatMenuItem(item));
  } catch (error) {
    return next(error);
  }
};

const setMenuAvailability = async (req, res, next) => {
  try {
    if (typeof req.body.isAvailable !== 'boolean') return sendError(res, 400, 'isAvailable must be true or false.');
    const item = await findById(MenuItem, req.params.id);
    if (!item) return next(new ApiError(404, 'Menu item not found.'));
    item.isAvailable = req.body.isAvailable;
    await item.save();
    await item.populate('category');
    return sendSuccess(res, 200, 'Availability updated successfully.', formatMenuItem(item));
  } catch (error) {
    return next(error);
  }
};

const deleteMenuItem = async (req, res, next) => {
  try {
    const item = await findById(MenuItem, req.params.id);
    if (!item) return next(new ApiError(404, 'Menu item not found.'));
    if (await Order.exists({ 'items.item': item._id })) {
      return sendError(res, 400, 'This dish appears in past orders. Mark it unavailable instead of deleting it.');
    }
    await item.deleteOne();
    return sendSuccess(res, 200, 'Menu item deleted successfully.', { id: String(item._id) });
  } catch (error) {
    return next(error);
  }
};

// ---------- categories ----------

const listCategories = async (req, res, next) => {
  try {
    const [categories, counts] = await Promise.all([
      Category.find().sort({ name: 1 }),
      MenuItem.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    ]);
    const countBy = new Map(counts.map((row) => [String(row._id), row.count]));
    return sendSuccess(res, 200, 'Categories fetched successfully.', categories.map((c) => formatCategory(c, countBy.get(String(c._id)) || 0)));
  } catch (error) {
    return next(error);
  }
};

const saveCategory = async (req, res, next) => {
  try {
    const creating = !req.params.id;
    const category = creating ? new Category() : await findById(Category, req.params.id);
    if (!category) return next(new ApiError(404, 'Category not found.'));

    const { name, description, isActive } = req.body;
    if (creating || name !== undefined) {
      const trimmed = String(name || '').trim();
      if (!trimmed) return sendError(res, 400, 'Category name is required.');
      const clash = await Category.findOne({ name: new RegExp(`^${escapeRegex(trimmed)}$`, 'i'), _id: { $ne: category._id } });
      if (clash) return sendError(res, 409, 'A category with this name already exists.');
      category.name = trimmed;
    }
    if (description !== undefined) category.description = description ? String(description).trim() : '';
    if (isActive !== undefined) category.isActive = Boolean(isActive);
    await category.save();

    const itemCount = await MenuItem.countDocuments({ category: category._id });
    return sendSuccess(res, creating ? 201 : 200, `Category ${creating ? 'created' : 'updated'} successfully.`, formatCategory(category, itemCount));
  } catch (error) {
    return next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const category = await findById(Category, req.params.id);
    if (!category) return next(new ApiError(404, 'Category not found.'));
    if (await MenuItem.exists({ category: category._id })) {
      return sendError(res, 400, 'Move or delete the dishes in this category first.');
    }
    await category.deleteOne();
    return sendSuccess(res, 200, 'Category deleted successfully.', { id: String(category._id) });
  } catch (error) {
    return next(error);
  }
};

// ---------- tables ----------

const formatTables = async (tables) => {
  const open = await Order.find({ status: { $in: OPEN_STATUSES }, table: { $in: tables.map((t) => t._id) } }).sort({ createdAt: -1 });
  const openByTable = new Map();
  open.forEach((order) => {
    if (!openByTable.has(String(order.table))) openByTable.set(String(order.table), order);
  });
  return tables.map((table) => {
    const current = openByTable.get(String(table._id));
    return {
      id: String(table._id),
      number: table.tableId,
      capacity: table.capacity || 4,
      status: current ? 'Occupied' : table.floorStatus || 'Free',
      isActive: table.status === 'active',
      currentOrderId: current ? String(current._id) : null,
    };
  });
};

const listTables = async (req, res, next) => {
  try {
    const tables = await Table.find().sort({ tableNumber: 1, tableId: 1 });
    return sendSuccess(res, 200, 'Tables fetched successfully.', await formatTables(tables));
  } catch (error) {
    return next(error);
  }
};

const saveTable = async (req, res, next) => {
  try {
    const creating = !req.params.id;
    const table = creating ? new Table() : await findById(Table, req.params.id);
    if (!table) return next(new ApiError(404, 'Table not found.'));

    const { number, capacity, isActive } = req.body;
    if (creating || number !== undefined) {
      const tableId = String(number || '').trim().toUpperCase();
      if (!/^[A-Z0-9_-]{1,20}$/.test(tableId)) return sendError(res, 400, 'Table number may use letters, digits, - and _ (e.g. T11).');
      if (await Table.exists({ tableId, _id: { $ne: table._id } })) return sendError(res, 409, `Table ${tableId} already exists.`);
      if (!creating && tableId !== table.tableId && (await Order.exists({ table: table._id, status: { $in: OPEN_STATUSES } }))) {
        return sendError(res, 400, 'This table has an open order. Rename it after the order is completed.');
      }
      table.tableId = tableId;
      table.qrIdentifier = `chinu-${tableId}`;
      const digits = Number((tableId.match(/\d+/) || [])[0]);
      table.tableNumber = digits > 0 ? digits : table.tableNumber || (await Table.countDocuments()) + 1;
    }
    if (capacity !== undefined) {
      if (!(Number.isInteger(Number(capacity)) && Number(capacity) >= 1)) return sendError(res, 400, 'Capacity must be a whole number of 1 or more.');
      table.capacity = Number(capacity);
    }
    if (isActive !== undefined) table.status = isActive ? 'active' : 'inactive';
    await table.save();
    const [formatted] = await formatTables([table]);
    return sendSuccess(res, creating ? 201 : 200, `Table ${creating ? 'created' : 'updated'} successfully.`, formatted);
  } catch (error) {
    return next(error);
  }
};

const setTableStatus = async (req, res, next) => {
  try {
    if (!TABLE_STATUSES.includes(req.body.status)) return sendError(res, 400, `Status must be one of: ${TABLE_STATUSES.join(', ')}.`);
    const table = await findById(Table, req.params.id);
    if (!table) return next(new ApiError(404, 'Table not found.'));
    table.floorStatus = req.body.status;
    await table.save();
    const [formatted] = await formatTables([table]);
    return sendSuccess(res, 200, 'Table status updated successfully.', formatted);
  } catch (error) {
    return next(error);
  }
};

const deleteTable = async (req, res, next) => {
  try {
    const table = await findById(Table, req.params.id);
    if (!table) return next(new ApiError(404, 'Table not found.'));
    if (await Order.exists({ table: table._id })) {
      return sendError(res, 400, 'This table has orders. Mark it inactive instead of deleting it.');
    }
    await table.deleteOne();
    return sendSuccess(res, 200, 'Table deleted successfully.', { id: String(table._id) });
  } catch (error) {
    return next(error);
  }
};

// ---------- payments ----------

const listPayments = async (req, res, next) => {
  try {
    const { status, method, from, to } = req.query;
    const filter = {};
    if (status === 'Paid') filter.status = 'paid';
    else if (status === 'Unpaid') filter.status = { $ne: 'paid' };
    else if (status) filter.status = '__none__';
    if (method) filter.method = method;
    const createdAt = dateRange(from, to);
    if (createdAt) filter.createdAt = createdAt;

    const { page, limit, skip } = paging(req.query);
    const [payments, total] = await Promise.all([
      Payment.find(filter).populate('order', 'tableId').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Payment.countDocuments(filter),
    ]);
    return sendSuccess(res, 200, 'Payments fetched successfully.', payments.map((p) => formatPayment(p, p.order)), { meta: meta(page, limit, total) });
  } catch (error) {
    return next(error);
  }
};

// ---------- staff (admin only) ----------

const listStaff = async (req, res, next) => {
  try {
    const staff = await User.find({ role: { $in: Object.keys(ROLE_OUT) } }).sort({ role: 1, name: 1 });
    return sendSuccess(res, 200, 'Staff fetched successfully.', staff.map(formatUser));
  } catch (error) {
    return next(error);
  }
};

const saveStaff = async (req, res, next) => {
  try {
    const creating = !req.params.id;
    const user = creating ? new User() : await findById(User, req.params.id);
    if (!user || (!creating && !ROLE_OUT[user.role])) return next(new ApiError(404, 'Staff member not found.'));

    const { name, username, email, phone, role, isActive, password } = req.body;
    const self = !creating && String(user._id) === String(req.user._id);

    if (creating || name !== undefined) {
      if (!String(name || '').trim()) return sendError(res, 400, 'Name is required.');
      user.name = String(name).trim();
    }
    if (creating || username !== undefined) {
      const login = String(username || '').trim().toLowerCase();
      if (!/^[a-z0-9._@-]{3,40}$/.test(login)) return sendError(res, 400, 'Username must be 3-40 characters: letters, digits, . _ - @');
      if (await User.exists({ $or: [{ username: login }, { email: login }], _id: { $ne: user._id } })) return sendError(res, 409, 'This username is already taken.');
      user.username = login;
    }
    if (email !== undefined) {
      const value = String(email || '').trim().toLowerCase();
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return sendError(res, 400, 'Please enter a valid email.');
      if (value && (await User.exists({ $or: [{ email: value }, { username: value }], _id: { $ne: user._id } }))) return sendError(res, 409, 'This email is already used.');
      user.email = value || undefined;
    }
    if (phone !== undefined) user.phone = String(phone || '').trim();
    if (creating || role !== undefined) {
      if (!ROLE_IN[role]) return sendError(res, 400, 'Role must be admin, manager or employee.');
      if (self && ROLE_IN[role] !== 'admin') return sendError(res, 400, 'You cannot remove your own admin role.');
      user.role = ROLE_IN[role];
    }
    if (isActive !== undefined) {
      if (self && !isActive) return sendError(res, 400, 'You cannot deactivate your own account.');
      user.isActive = Boolean(isActive);
    }
    if (creating || password !== undefined) {
      if (String(password || '').length < 6) return sendError(res, 400, 'Password must be at least 6 characters.');
      user.password = password;
    }

    await user.save();
    return sendSuccess(res, creating ? 201 : 200, `Staff member ${creating ? 'created' : 'updated'} successfully.`, formatUser(user));
  } catch (error) {
    return next(error);
  }
};

const deleteStaff = async (req, res, next) => {
  try {
    const user = await findById(User, req.params.id);
    if (!user || !ROLE_OUT[user.role]) return next(new ApiError(404, 'Staff member not found.'));
    if (String(user._id) === String(req.user._id)) return sendError(res, 400, 'You cannot delete your own account.');
    await user.deleteOne();
    return sendSuccess(res, 200, 'Staff member deleted successfully.', { id: String(user._id) });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listOrders,
  getOrder,
  updateOrderStatus,
  markOrderPaid,
  dashboardStats,
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  setMenuAvailability,
  deleteMenuItem,
  listCategories,
  saveCategory,
  deleteCategory,
  listTables,
  saveTable,
  setTableStatus,
  deleteTable,
  listPayments,
  listStaff,
  saveStaff,
  deleteStaff,
};

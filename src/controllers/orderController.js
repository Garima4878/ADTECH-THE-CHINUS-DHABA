const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Table = require('../models/Table');
const MenuItem = require('../models/MenuItem');
const Payment = require('../models/Payment');
const ApiError = require('../utils/ApiError');
const { sendSuccess, sendError } = require('../utils/apiResponse');

const ORDER_STATUS_FLOW = ['Pending', 'Accepted', 'Preparing', 'Ready', 'Served/Completed'];

const generateOrderId = () => `ORD-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;

const buildItemTotals = async (items) => {
  const validatedItems = [];
  let subtotal = 0;

  for (const itemEntry of items) {
    if (!itemEntry || !itemEntry.itemId || !itemEntry.quantity || Number(itemEntry.quantity) <= 0) {
      throw new ApiError(400, 'Each item must include a valid itemId and quantity greater than zero.');
    }

    const item = await MenuItem.findById(itemEntry.itemId).populate('category');
    if (!item) {
      throw new ApiError(404, `Menu item not found for id: ${itemEntry.itemId}`);
    }

    if (!item.isAvailable) {
      throw new ApiError(400, `Menu item "${item.name}" is currently unavailable.`);
    }

    const quantity = Number(itemEntry.quantity);
    const unitPrice = Number(item.price);
    const total = unitPrice * quantity;

    validatedItems.push({
      item: item._id,
      quantity,
      unitPrice,
      total,
    });

    subtotal += total;
  }

  return { items: validatedItems, subtotal };
};

const getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find().populate('table').sort({ createdAt: -1 });
    return sendSuccess(res, 200, 'Orders fetched successfully.', { orders });
  } catch (error) {
    return next(error);
  }
};

const getPendingOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ status: 'Pending' }).populate('table').sort({ createdAt: -1 });
    return sendSuccess(res, 200, 'Pending orders fetched successfully.', { orders });
  } catch (error) {
    return next(error);
  }
};

const getOrdersByTable = async (req, res, next) => {
  try {
    const table = await Table.findOne({ tableId: req.params.tableId });
    if (!table) {
      return next(new ApiError(404, 'Table not found.'));
    }

    const orders = await Order.find({ table: table._id }).populate('table').sort({ createdAt: -1 });
    return sendSuccess(res, 200, 'Orders for table fetched successfully.', { orders });
  } catch (error) {
    return next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('table');

    if (!order) {
      return next(new ApiError(404, 'Order not found.'));
    }

    return sendSuccess(res, 200, 'Order fetched successfully.', { order });
  } catch (error) {
    return next(error);
  }
};

const createOrder = async (req, res, next) => {
  try {
    const { tableId, items, customerName } = req.body;

    if (!tableId) {
      return sendError(res, 400, 'Table ID is required to create an order.');
    }

    if (!Array.isArray(items) || items.length === 0) {
      return sendError(res, 400, 'Order items are required.');
    }

    const table = await Table.findOne({ tableId });
    if (!table) {
      return next(new ApiError(404, 'Invalid table ID. This table does not exist.'));
    }

    if (table.status !== 'active') {
      return next(new ApiError(400, 'This table is currently inactive.'));
    }

    const { items: validatedItems, subtotal } = await buildItemTotals(items);
    const tax = Number((subtotal * 0.05).toFixed(2));
    const totalAmount = Number((subtotal + tax).toFixed(2));

    const orderId = generateOrderId();
    const order = await Order.create({
      orderId,
      table: table._id,
      tableId: table.tableId,
      customerName: customerName || 'Guest',
      items: validatedItems,
      subtotal,
      tax,
      totalAmount,
      status: 'Pending',
      paymentStatus: 'Unpaid',
    });

    return sendSuccess(res, 201, 'Order created successfully.', { order });
  } catch (error) {
    return next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Pending', 'Accepted', 'Preparing', 'Ready', 'Served/Completed', 'Cancelled'];

    if (!status || !validStatuses.includes(status)) {
      return sendError(res, 400, 'Please provide a valid order status.');
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return next(new ApiError(404, 'Order not found.'));
    }

    if (order.status === 'Cancelled') {
      return sendError(res, 400, 'This order is already cancelled and cannot be updated.');
    }

    if (order.status === 'Served/Completed' && status !== 'Served/Completed') {
      return sendError(res, 400, 'A served order cannot be moved backward or cancelled.');
    }

    const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);
    const nextIndex = status === 'Cancelled' ? -1 : ORDER_STATUS_FLOW.indexOf(status);

    if (status !== 'Cancelled' && nextIndex < currentIndex) {
      return sendError(res, 400, 'Invalid status transition.');
    }

    if (status === 'Cancelled') {
      order.status = 'Cancelled';
      order.paymentStatus = 'Cancelled';
    } else {
      order.status = status;
    }

    await order.save();
    return sendSuccess(res, 200, 'Order status updated successfully.', { order });
  } catch (error) {
    return next(error);
  }
};

const createPaymentForOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('table');
    if (!order) {
      return next(new ApiError(404, 'Order not found.'));
    }

    if (order.paymentStatus === 'Paid') {
      return sendError(res, 400, 'This order has already been paid for.');
    }

    const existingPayment = await Payment.findOne({ order: order._id });
    if (existingPayment && existingPayment.status === 'paid') {
      return sendError(res, 409, 'A paid payment already exists for this order.');
    }

    const payment = await Payment.create({
      order: order._id,
      orderId: order.orderId,
      amount: order.totalAmount,
      currency: 'INR',
      status: 'pending',
      gateway: 'razorpay',
    });

    return sendSuccess(res, 201, 'Payment created successfully.', { payment, order });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getOrders,
  getPendingOrders,
  getOrdersByTable,
  getOrderById,
  createOrder,
  updateOrderStatus,
  createPaymentForOrder,
};

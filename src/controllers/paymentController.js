const crypto = require('crypto');
const razorpay = require('../config/razorpay');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');
const { sendSuccess, sendError } = require('../utils/apiResponse');

const createPayment = async (req, res, next) => {
  try {
    const { orderId, amount, currency = 'INR' } = req.body;

    if (!orderId || !amount) {
      return sendError(res, 400, 'Order ID and amount are required.');
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return next(new ApiError(404, 'Order not found.'));
    }

    if (Number(amount) !== Number(order.totalAmount)) {
      return sendError(res, 400, 'Payment amount does not match the order total.');
    }

    if (!razorpay) {
      return sendError(res, 503, 'Payment gateway is not configured.');
    }

    const existingPayment = await Payment.findOne({ order: order._id, status: 'paid' });
    if (existingPayment) {
      return sendError(res, 409, 'This order has already been paid.');
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(Number(amount) * 100),
      currency,
      receipt: order.orderId,
      notes: {
        orderId: order.orderId,
      },
    });

    const payment = await Payment.findOneAndUpdate(
      { order: order._id },
      {
        order: order._id,
        orderId: order.orderId,
        gateway: 'razorpay',
        gatewayOrderId: razorpayOrder.id,
        amount: Number(amount),
        currency,
        status: 'pending',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return sendSuccess(res, 201, 'Payment order created successfully.', {
      payment,
      order: {
        id: order._id,
        orderId: order.orderId,
        amount: order.totalAmount,
      },
      razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    const { orderId, paymentId, signature } = req.body;

    if (!orderId || !paymentId || !signature) {
      return sendError(res, 400, 'orderId, paymentId, and signature are required.');
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return next(new ApiError(404, 'Order not found.'));
    }

    const paymentRecord = await Payment.findOne({ order: order._id });
    if (!paymentRecord) {
      return next(new ApiError(404, 'Payment record not found for this order.'));
    }

    if (paymentRecord.paymentId && paymentRecord.paymentId !== paymentId) {
      const existingPaymentForId = await Payment.findOne({ paymentId, _id: { $ne: paymentRecord._id } });
      if (existingPaymentForId) {
        return sendError(res, 409, 'This Razorpay payment ID has already been used for a different order.');
      }
    }

    if (paymentRecord.status === 'paid') {
      return sendSuccess(res, 200, 'Payment already verified.', {
        orderId: order.orderId,
        paymentStatus: 'paid',
      });
    }

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${paymentRecord.gatewayOrderId}|${paymentId}`)
      .digest('hex');

    if (generatedSignature !== signature) {
      paymentRecord.status = 'failed';
      await paymentRecord.save();
      order.paymentStatus = 'Failed';
      await order.save();
      return sendError(res, 400, 'Payment verification failed: invalid signature.');
    }

    paymentRecord.paymentId = paymentId;
    paymentRecord.signature = signature;
    paymentRecord.status = 'paid';
    await paymentRecord.save();

    order.paymentStatus = 'Paid';
    order.status = 'Accepted';
    await order.save();

    return sendSuccess(res, 200, 'Payment verified successfully.', {
      orderId: order.orderId,
      paymentStatus: 'paid',
      orderStatus: order.status,
    });
  } catch (error) {
    return next(error);
  }
};

const getPaymentByOrder = async (req, res, next) => {
  try {
    const payment = await Payment.findOne({ orderId: req.params.orderId }).populate('order');
    if (!payment) {
      return next(new ApiError(404, 'Payment record not found.'));
    }

    return sendSuccess(res, 200, 'Payment fetched successfully.', { payment });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createPayment,
  verifyPayment,
  getPaymentByOrder,
};

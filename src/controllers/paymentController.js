const crypto = require('crypto');
const razorpay = require('../config/razorpay');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { toWebsiteStatus } = require('../utils/websiteFormat');
const { isAllowedOrigin } = require('../config/clientOrigins');

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
    paymentRecord.paidAt = new Date();
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

// ---- Hosted checkout for the customer website (Razorpay Payment Links) ----
// The website (app.js) redirects the customer to `checkoutUrl` and, after payment, calls /verify with only the
// orderId. The amount always comes from the server-side order total, and verification asks Razorpay directly,
// so nothing the browser sends is trusted as proof of payment.

const PAYMENT_LINK_PREFIX = 'plink_';
const RAZORPAY_METHODS = { upi: 'UPI', card: 'Card', emi: 'Card', netbanking: 'NetBanking', bank_transfer: 'NetBanking', wallet: 'Wallet' };

const parseReturnUrl = (returnUrl) => {
  let url;
  try {
    url = new URL(String(returnUrl || ''));
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  return isAllowedOrigin(url.origin) ? url.toString() : null;
};

const linkPayments = (link) => {
  if (Array.isArray(link.payments)) return link.payments;
  return link.payments ? [link.payments] : [];
};

const initiatePayment = async (req, res, next) => {
  try {
    const { orderId, returnUrl } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return next(new ApiError(404, 'Order not found.'));
    }

    if (order.paymentStatus === 'Paid') {
      return sendError(res, 409, 'This order has already been paid.');
    }

    if (order.status === 'Cancelled') {
      return sendError(res, 400, 'This order has been cancelled.');
    }

    const callbackUrl = parseReturnUrl(returnUrl);
    if (!callbackUrl) {
      return sendError(res, 400, 'returnUrl must be a page on the restaurant website.');
    }

    if (!razorpay) {
      return sendError(res, 503, 'Payment gateway is not configured.');
    }

    const amountInPaise = Math.round(Number(order.totalAmount) * 100);
    const existing = await Payment.findOne({ order: order._id });

    // Retrying checkout reuses the open link instead of creating a second one for the same order.
    if (existing && existing.status === 'pending' && existing.gatewayOrderId.startsWith(PAYMENT_LINK_PREFIX)) {
      const link = await razorpay.paymentLink.fetch(existing.gatewayOrderId);
      if (link.status === 'created' && Number(link.amount) === amountInPaise) {
        return sendSuccess(res, 200, 'Payment link fetched.', { checkoutUrl: link.short_url }, { orderId: order.orderId, checkoutUrl: link.short_url });
      }
    }

    const link = await razorpay.paymentLink.create({
      amount: amountInPaise,
      currency: 'INR',
      accept_partial: false,
      // reference_id must be unique per link, so retries after an expired link get a new suffix.
      reference_id: `${order.orderId}-${Date.now().toString(36)}`.slice(0, 40),
      description: `Chinu Family Restaurant & Dhaba - order ${order.orderId}`,
      callback_url: callbackUrl,
      callback_method: 'get',
      notes: { orderId: order.orderId, tableId: order.tableId },
    });

    await Payment.findOneAndUpdate(
      { order: order._id },
      {
        order: order._id,
        orderId: order.orderId,
        gateway: 'razorpay',
        gatewayOrderId: link.id,
        amount: order.totalAmount,
        currency: 'INR',
        status: 'pending',
        notes: 'payment_link',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return sendSuccess(res, 201, 'Payment link created.', { checkoutUrl: link.short_url }, { orderId: order.orderId, checkoutUrl: link.short_url });
  } catch (error) {
    return next(error);
  }
};

const verifyPaymentLink = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return next(new ApiError(404, 'Order not found.'));
    }

    const paymentRecord = await Payment.findOne({ order: order._id });
    if (!paymentRecord || !paymentRecord.gatewayOrderId.startsWith(PAYMENT_LINK_PREFIX)) {
      return next(new ApiError(404, 'No online payment was started for this order.'));
    }

    const respond = (message, paymentStatus) =>
      sendSuccess(
        res,
        200,
        message,
        { orderId: order.orderId, paymentStatus, orderStatus: toWebsiteStatus(order.status) },
        { orderId: order.orderId, paymentStatus, orderStatus: toWebsiteStatus(order.status) }
      );

    if (paymentRecord.status === 'paid') {
      return respond('Payment already verified.', 'paid');
    }

    if (!razorpay) {
      return sendError(res, 503, 'Payment gateway is not configured.');
    }

    const link = await razorpay.paymentLink.fetch(paymentRecord.gatewayOrderId);
    const captured = linkPayments(link).find((payment) => payment.status === 'captured');
    const expectedPaise = Math.round(Number(order.totalAmount) * 100);
    const fullyPaid = Number(link.amount) === expectedPaise && Number(link.amount_paid) >= expectedPaise;

    if (link.status === 'paid' && captured && fullyPaid) {
      const reused = await Payment.findOne({ paymentId: captured.payment_id, _id: { $ne: paymentRecord._id } });
      if (reused) {
        return sendError(res, 409, 'This Razorpay payment ID has already been used for a different order.');
      }

      paymentRecord.paymentId = captured.payment_id;
      paymentRecord.status = 'paid';
      paymentRecord.paidAt = new Date();
      paymentRecord.method = RAZORPAY_METHODS[captured.method] || null;
      await paymentRecord.save();

      order.paymentStatus = 'Paid';
      if (order.status === 'Pending') order.status = 'Accepted';
      await order.save();
      return respond('Payment verified successfully.', 'paid');
    }

    if (link.status === 'cancelled' || link.status === 'expired') {
      paymentRecord.status = 'failed';
      await paymentRecord.save();
      order.paymentStatus = 'Failed';
      await order.save();
      return respond('Payment was not completed.', 'failed');
    }

    return respond('Payment has not been completed yet.', 'pending');
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
  initiatePayment,
  verifyPaymentLink,
  getPaymentByOrder,
};

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
    },
    gateway: {
      type: String,
      enum: ['razorpay', 'manual'],
      default: 'razorpay',
    },
    orderId: {
      type: String,
      required: true,
      index: true,
    },
    // No default: a sparse unique index skips missing values but not '', so a '' default
    // allowed only one unpaid payment at a time (E11000 duplicate key for the next customer).
    paymentId: {
      type: String,
      index: { unique: true, sparse: true },
    },
    gatewayOrderId: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'cancelled'],
      default: 'pending',
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    signature: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);

const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema(
  {
    tableNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    tableId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    qrIdentifier: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    capacity: {
      type: Number,
      default: 4,
      min: 1,
    },
    // Set by staff on the admin dashboard. "Occupied" is also shown automatically while the table has an open order.
    floorStatus: {
      type: String,
      enum: ['Free', 'Occupied', 'Reserved', 'Cleaning'],
      default: 'Free',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Table', tableSchema);

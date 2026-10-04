const express = require('express');
const { body, param } = require('express-validator');
const { createPayment, verifyPayment, getPaymentByOrder } = require('../controllers/paymentController');
const { handleValidationErrors } = require('../middleware/validate');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.post(
  '/create',
  [
    body('orderId').notEmpty().withMessage('Order ID is required.'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number.'),
  ],
  handleValidationErrors,
  createPayment
);

router.post(
  '/verify',
  [
    body('orderId').notEmpty().withMessage('Order ID is required.'),
    body('paymentId').notEmpty().withMessage('paymentId is required.'),
    body('signature').notEmpty().withMessage('signature is required.'),
  ],
  handleValidationErrors,
  verifyPayment
);

router.get(
  '/order/:orderId',
  protect,
  authorize('admin', 'staff'),
  [param('orderId').notEmpty().withMessage('Order ID is required.')],
  handleValidationErrors,
  getPaymentByOrder
);

module.exports = router;

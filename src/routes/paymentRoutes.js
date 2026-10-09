const express = require('express');
const { body, param } = require('express-validator');
const {
  createPayment,
  verifyPayment,
  initiatePayment,
  verifyPaymentLink,
  getPaymentByOrder,
} = require('../controllers/paymentController');
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

// Hosted checkout used by the customer website: returns { checkoutUrl } for a Razorpay Payment Link.
router.post(
  '/initiate',
  [
    body('orderId').notEmpty().withMessage('Order ID is required.'),
    body('returnUrl').notEmpty().withMessage('returnUrl is required.'),
  ],
  handleValidationErrors,
  initiatePayment
);

// Razorpay Checkout popup (signature from the client); requests without a signature
// fall through to the Payment Link check below.
router.post(
  '/verify',
  (req, res, next) => (req.body && req.body.signature ? next() : next('route')),
  [
    body('orderId').notEmpty().withMessage('Order ID is required.'),
    body('paymentId').notEmpty().withMessage('paymentId is required.'),
    body('signature').notEmpty().withMessage('signature is required.'),
  ],
  handleValidationErrors,
  verifyPayment
);

router.post(
  '/verify',
  [body('orderId').notEmpty().withMessage('Order ID is required.')],
  handleValidationErrors,
  verifyPaymentLink
);

router.get(
  '/order/:orderId',
  protect,
  authorize('admin', 'manager', 'staff'),
  [param('orderId').notEmpty().withMessage('Order ID is required.')],
  handleValidationErrors,
  getPaymentByOrder
);

module.exports = router;

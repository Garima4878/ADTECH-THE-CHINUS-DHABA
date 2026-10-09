const express = require('express');
const { body, param } = require('express-validator');
const { protect, authorize } = require('../middleware/authMiddleware');
const { handleValidationErrors } = require('../middleware/validate');
const {
  getOrders,
  getPendingOrders,
  getOrdersByTable,
  getOrderById,
  getOrderStatusForCustomer,
  createOrder,
  updateOrderStatus,
  createPaymentForOrder,
} = require('../controllers/orderController');

const router = express.Router();

router.get('/', protect, authorize('admin', 'manager', 'staff'), getOrders);
router.get('/pending', protect, authorize('admin', 'manager', 'staff'), getPendingOrders);
router.get('/table/:tableId', protect, authorize('admin', 'manager', 'staff'), getOrdersByTable);
router.get('/:orderId', getOrderStatusForCustomer);
router.get('/:id', protect, authorize('admin', 'manager', 'staff'), [param('id').isMongoId().withMessage('Invalid order ID.')], handleValidationErrors, getOrderById);

router.post(
  '/',
  [
    body('tableId').notEmpty().withMessage('Table ID is required.'),
    body('items').isArray({ min: 1 }).withMessage('At least one menu item is required.'),
  ],
  handleValidationErrors,
  createOrder
);
router.patch(
  '/:id/status',
  protect,
  authorize('admin', 'manager', 'staff'),
  [
    param('id').isMongoId().withMessage('Invalid order ID.'),
    body('status').isIn(['Pending', 'Accepted', 'Preparing', 'Ready', 'Served/Completed', 'Cancelled']).withMessage('Invalid order status.'),
  ],
  handleValidationErrors,
  updateOrderStatus
);
router.post(
  '/:id/payment',
  protect,
  authorize('admin', 'manager', 'staff'),
  [param('id').isMongoId().withMessage('Invalid order ID.')],
  handleValidationErrors,
  createPaymentForOrder
);

module.exports = router;

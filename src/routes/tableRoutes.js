const express = require('express');
const { body, param } = require('express-validator');
const { protect, authorize } = require('../middleware/authMiddleware');
const { handleValidationErrors } = require('../middleware/validate');
const {
  getTables,
  getTableById,
  createTable,
  updateTable,
  validateTable,
} = require('../controllers/tableController');

const router = express.Router();

router.get('/', protect, authorize('admin', 'manager', 'staff'), getTables);
router.get(
  '/validate/:tableId',
  [param('tableId').notEmpty().withMessage('Table ID is required.')],
  handleValidationErrors,
  validateTable
);
router.get(
  '/:id',
  protect,
  authorize('admin', 'manager', 'staff'),
  [param('id').isMongoId().withMessage('Invalid table ID.')],
  handleValidationErrors,
  getTableById
);
router.post(
  '/',
  protect,
  authorize('admin', 'manager', 'staff'),
  [
    body('tableNumber').isInt({ min: 1 }).withMessage('Table number must be a positive integer.'),
  ],
  handleValidationErrors,
  createTable
);
router.put(
  '/:id',
  protect,
  authorize('admin', 'manager', 'staff'),
  [
    param('id').isMongoId().withMessage('Invalid table ID.'),
    body('tableNumber').optional().isInt({ min: 1 }).withMessage('Table number must be a positive integer.'),
  ],
  handleValidationErrors,
  updateTable
);

module.exports = router;

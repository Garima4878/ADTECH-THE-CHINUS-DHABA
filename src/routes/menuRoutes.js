const express = require('express');
const { body, param, query } = require('express-validator');
const { protect, authorize } = require('../middleware/authMiddleware');
const { handleValidationErrors } = require('../middleware/validate');
const {
  getMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleAvailability,
} = require('../controllers/menuController');

const router = express.Router();

router.get(
  '/',
  [
    query('category').optional().isMongoId().withMessage('Category must be a valid Mongo ID.'),
    query('availableOnly').optional().isBoolean().withMessage('availableOnly must be a boolean.'),
  ],
  handleValidationErrors,
  getMenuItems
);
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid menu item ID.')],
  handleValidationErrors,
  getMenuItemById
);
router.post(
  '/',
  protect,
  authorize('admin', 'manager', 'staff'),
  [
    body('name').isString().trim().notEmpty().withMessage('Menu item name is required.'),
    body('category').isMongoId().withMessage('Category is required and must be a valid Mongo ID.'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number.'),
  ],
  handleValidationErrors,
  createMenuItem
);
router.put(
  '/:id',
  protect,
  authorize('admin', 'manager', 'staff'),
  [
    param('id').isMongoId().withMessage('Invalid menu item ID.'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a non-negative number.'),
  ],
  handleValidationErrors,
  updateMenuItem
);
router.patch(
  '/:id/availability',
  protect,
  authorize('admin', 'manager', 'staff'),
  [
    param('id').isMongoId().withMessage('Invalid menu item ID.'),
    body('isAvailable').isBoolean().withMessage('isAvailable must be a boolean.'),
  ],
  handleValidationErrors,
  toggleAvailability
);
router.delete(
  '/:id',
  protect,
  authorize('admin', 'manager', 'staff'),
  [param('id').isMongoId().withMessage('Invalid menu item ID.')],
  handleValidationErrors,
  deleteMenuItem
);

module.exports = router;

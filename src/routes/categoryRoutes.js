const express = require('express');
const { body, param } = require('express-validator');
const { protect, authorize } = require('../middleware/authMiddleware');
const { handleValidationErrors } = require('../middleware/validate');
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');

const router = express.Router();

router.get('/', getCategories);
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid category ID.')],
  handleValidationErrors,
  getCategoryById
);
router.post(
  '/',
  protect,
  authorize('admin', 'manager', 'staff'),
  [
    body('name').isString().trim().notEmpty().withMessage('Category name is required.'),
  ],
  handleValidationErrors,
  createCategory
);
router.put(
  '/:id',
  protect,
  authorize('admin', 'manager', 'staff'),
  [
    param('id').isMongoId().withMessage('Invalid category ID.'),
    body('name').optional().isString().trim().notEmpty().withMessage('Category name cannot be empty.'),
  ],
  handleValidationErrors,
  updateCategory
);
router.delete(
  '/:id',
  protect,
  authorize('admin', 'manager', 'staff'),
  [param('id').isMongoId().withMessage('Invalid category ID.')],
  handleValidationErrors,
  deleteCategory
);

module.exports = router;

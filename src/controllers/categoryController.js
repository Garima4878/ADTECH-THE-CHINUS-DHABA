const Category = require('../models/Category');
const ApiError = require('../utils/ApiError');
const { sendSuccess, sendError } = require('../utils/apiResponse');

const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    return sendSuccess(res, 200, 'Categories fetched successfully.', { categories });
  } catch (error) {
    return next(error);
  }
};

const getCategoryById = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return next(new ApiError(404, 'Category not found.'));
    }

    return sendSuccess(res, 200, 'Category fetched successfully.', { category });
  } catch (error) {
    return next(error);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const { name, description, isActive } = req.body;

    if (!name || !name.trim()) {
      return sendError(res, 400, 'Category name is required.');
    }

    const category = await Category.create({
      name: name.trim(),
      description: description || '',
      isActive: typeof isActive === 'boolean' ? isActive : true,
    });

    return sendSuccess(res, 201, 'Category created successfully.', { category });
  } catch (error) {
    return next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return next(new ApiError(404, 'Category not found.'));
    }

    const { name, description, isActive } = req.body;

    if (name !== undefined && !name.trim()) {
      return sendError(res, 400, 'Category name cannot be empty.');
    }

    if (name) category.name = name.trim();
    if (description !== undefined) category.description = description;
    if (typeof isActive === 'boolean') category.isActive = isActive;

    await category.save();

    return sendSuccess(res, 200, 'Category updated successfully.', { category });
  } catch (error) {
    return next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      return next(new ApiError(404, 'Category not found.'));
    }

    return sendSuccess(res, 200, 'Category deleted successfully.', { category });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};

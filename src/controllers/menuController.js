const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const ApiError = require('../utils/ApiError');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { menuItemForWebsite } = require('../utils/websiteFormat');

const getMenuItems = async (req, res, next) => {
  try {
    const { category, availableOnly } = req.query;
    const filter = {};

    if (category) {
      filter.category = category;
    }

    if (availableOnly === 'true') {
      filter.isAvailable = true;
    }

    const menu = await MenuItem.find(filter).populate('category').sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Menu fetched successfully.', { menu }, { items: menu.map(menuItemForWebsite) });
  } catch (error) {
    return next(error);
  }
};

const getMenuItemById = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id).populate('category');

    if (!item) {
      return next(new ApiError(404, 'Menu item not found.'));
    }

    return sendSuccess(res, 200, 'Menu item fetched successfully.', { item });
  } catch (error) {
    return next(error);
  }
};

const createMenuItem = async (req, res, next) => {
  try {
    const { name, category, price, description, imageUrl, isAvailable } = req.body;

    if (!name || !name.trim()) {
      return sendError(res, 400, 'Menu item name is required.');
    }

    if (!category) {
      return sendError(res, 400, 'Category is required.');
    }

    if (price === undefined || Number(price) < 0) {
      return sendError(res, 400, 'Valid price is required.');
    }

    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return next(new ApiError(404, 'Category not found.'));
    }

    const item = await MenuItem.create({
      name: name.trim(),
      category,
      price: Number(price),
      description: description || '',
      imageUrl: imageUrl || '',
      isAvailable: typeof isAvailable === 'boolean' ? isAvailable : true,
    });

    const populatedItem = await item.populate('category');
    return sendSuccess(res, 201, 'Menu item created successfully.', { item: populatedItem });
  } catch (error) {
    return next(error);
  }
};

const updateMenuItem = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id);

    if (!item) {
      return next(new ApiError(404, 'Menu item not found.'));
    }

    const { name, category, price, description, imageUrl, isAvailable } = req.body;

    if (name !== undefined && !name.trim()) {
      return sendError(res, 400, 'Menu item name cannot be empty.');
    }

    if (category) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return next(new ApiError(404, 'Category not found.'));
      }
      item.category = category;
    }

    if (name) item.name = name.trim();
    if (price !== undefined) item.price = Number(price);
    if (description !== undefined) item.description = description || '';
    if (imageUrl !== undefined) item.imageUrl = imageUrl || '';
    if (typeof isAvailable === 'boolean') item.isAvailable = isAvailable;

    await item.save();
    const populatedItem = await item.populate('category');

    return sendSuccess(res, 200, 'Menu item updated successfully.', { item: populatedItem });
  } catch (error) {
    return next(error);
  }
};

const deleteMenuItem = async (req, res, next) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);

    if (!item) {
      return next(new ApiError(404, 'Menu item not found.'));
    }

    return sendSuccess(res, 200, 'Menu item deleted successfully.', { item });
  } catch (error) {
    return next(error);
  }
};

const toggleAvailability = async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id);

    if (!item) {
      return next(new ApiError(404, 'Menu item not found.'));
    }

    const { isAvailable } = req.body;
    if (typeof isAvailable !== 'boolean') {
      return sendError(res, 400, 'isAvailable must be a boolean.');
    }

    item.isAvailable = isAvailable;
    await item.save();

    return sendSuccess(res, 200, 'Availability updated successfully.', { item });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleAvailability,
};

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return next(new ApiError(401, 'Authentication token is required.'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    const user = await User.findById(decoded._id).select('-password');

    if (!user) {
      return next(new ApiError(401, 'User no longer exists.'));
    }

    req.user = user;
    next();
  } catch (error) {
    return next(new ApiError(401, 'Authentication failed or token is invalid.'));
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new ApiError(403, 'You do not have permission to perform this action.'));
  }

  next();
};

module.exports = { protect, authorize };

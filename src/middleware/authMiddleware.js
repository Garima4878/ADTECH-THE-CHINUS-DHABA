const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

// Prototype mode (PROTOTYPE_OPEN_ADMIN=true): requests without a login act as the first active admin, so the
// dashboard needs no username/password. Anyone with the link gets full admin access, so turn it off before
// real use. Requests that do send a token are still checked normally.
const prototypeOpenAdmin = () => String(process.env.PROTOTYPE_OPEN_ADMIN || '').toLowerCase() === 'true';

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token && prototypeOpenAdmin()) {
      const admin = await User.findOne({ role: 'admin', isActive: { $ne: false } }).select('-password');
      if (!admin) {
        return next(new ApiError(503, 'Prototype mode needs an admin account: run npm run seed.'));
      }
      req.user = admin;
      return next();
    }

    if (!token) {
      return next(new ApiError(401, 'Authentication token is required.'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    const user = await User.findById(decoded._id).select('-password');

    if (!user || user.isActive === false) {
      return next(new ApiError(401, 'User no longer exists or has been deactivated.'));
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

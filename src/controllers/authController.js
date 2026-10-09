const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { sendSuccess, sendError } = require('../utils/apiResponse');

const generateToken = (user) =>
  jwt.sign(
    {
      _id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '7d' }
  );

const STAFF_ROLES = ['admin', 'manager', 'staff'];

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  username: user.username || user.email,
  email: user.email,
  role: user.role,
});

// Admin only (see authRoutes): previously this route was public and gave every new account the admin role.
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return sendError(res, 400, 'Name, email, and password are required.');
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return sendError(res, 409, 'User with this email already exists.');
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: STAFF_ROLES.includes(role) ? role : 'staff',
    });

    const token = generateToken(user);

    return sendSuccess(res, 201, 'User registered successfully.', {
      token,
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

// Accepts { email, password } or { username, password }; the username field may also hold an email.
const login = async (req, res, next) => {
  try {
    const { password } = req.body;
    const identifier = String(req.body.username || req.body.email || '').trim().toLowerCase();

    if (!identifier || !password) {
      return sendError(res, 400, 'Username or email and password are required.');
    }

    const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] });
    if (!user || !user.isActive) {
      return sendError(res, 401, 'Invalid username or password.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return sendError(res, 401, 'Invalid username or password.');
    }

    const token = generateToken(user);

    return sendSuccess(res, 200, 'Login successful.', {
      token,
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

const getCurrentUser = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new ApiError(401, 'User not authenticated.'));
    }

    return sendSuccess(res, 200, 'Profile fetched successfully.', {
      user: publicUser(req.user),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { register, login, getCurrentUser };

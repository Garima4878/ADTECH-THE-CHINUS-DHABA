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
      role: role === 'staff' ? 'staff' : 'admin',
    });

    const token = generateToken(user);

    return sendSuccess(res, 201, 'User registered successfully.', {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 400, 'Email and password are required.');
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return sendError(res, 401, 'Invalid email or password.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return sendError(res, 401, 'Invalid email or password.');
    }

    const token = generateToken(user);

    return sendSuccess(res, 200, 'Login successful.', {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
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
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { register, login, getCurrentUser };

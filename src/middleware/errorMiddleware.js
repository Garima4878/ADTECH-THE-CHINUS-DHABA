const { sendError } = require('../utils/apiResponse');

const notFound = (req, res) => {
  sendError(res, 404, 'Route not found.');
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Unexpected server error.';

  const payload = {
    success: false,
    message,
    errors: err.errors || [],
  };

  if (process.env.NODE_ENV !== 'production') {
    payload.stack = err.stack;
  }

  return res.status(statusCode).json(payload);
};

module.exports = { notFound, errorHandler };

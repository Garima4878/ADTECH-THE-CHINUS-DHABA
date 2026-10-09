// `extra` adds top-level fields for clients that read a flat response (the customer website).
const sendSuccess = (res, statusCode = 200, message, data = {}, extra = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...extra,
  });
};

const sendError = (res, statusCode = 400, message, errors = []) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

module.exports = { sendSuccess, sendError };

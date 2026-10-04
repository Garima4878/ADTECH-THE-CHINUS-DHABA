const { validationResult } = require('express-validator');
const { sendError } = require('../utils/apiResponse');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return sendError(
      res,
      400,
      'Validation failed.',
      errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
      }))
    );
  }

  return next();
};

module.exports = { handleValidationErrors };

const Table = require('../models/Table');
const ApiError = require('../utils/ApiError');
const { sendSuccess, sendError } = require('../utils/apiResponse');

const getTables = async (req, res, next) => {
  try {
    const tables = await Table.find().sort({ tableNumber: 1 });
    return sendSuccess(res, 200, 'Tables fetched successfully.', { tables });
  } catch (error) {
    return next(error);
  }
};

const getTableById = async (req, res, next) => {
  try {
    const table = await Table.findById(req.params.id);

    if (!table) {
      return next(new ApiError(404, 'Table not found.'));
    }

    return sendSuccess(res, 200, 'Table fetched successfully.', { table });
  } catch (error) {
    return next(error);
  }
};

const createTable = async (req, res, next) => {
  try {
    const { tableNumber, status } = req.body;

    if (!tableNumber || Number(tableNumber) < 1) {
      return sendError(res, 400, 'A valid table number is required.');
    }

    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const tableId = `TBL-${uniqueSuffix}`;
    const qrIdentifier = `QR-${uniqueSuffix}`;

    const table = await Table.create({
      tableNumber: Number(tableNumber),
      tableId,
      qrIdentifier,
      status: status || 'active',
    });

    return sendSuccess(res, 201, 'Table created successfully.', { table });
  } catch (error) {
    return next(error);
  }
};

const updateTable = async (req, res, next) => {
  try {
    const table = await Table.findById(req.params.id);

    if (!table) {
      return next(new ApiError(404, 'Table not found.'));
    }

    const { tableNumber, status } = req.body;

    if (tableNumber !== undefined) {
      table.tableNumber = Number(tableNumber);
    }

    if (status && ['active', 'inactive'].includes(status)) {
      table.status = status;
    }

    await table.save();
    return sendSuccess(res, 200, 'Table updated successfully.', { table });
  } catch (error) {
    return next(error);
  }
};

const validateTable = async (req, res, next) => {
  try {
    const tableIdentifier = req.params.tableId || req.body.tableId || req.body.qrIdentifier;

    if (!tableIdentifier) {
      return sendError(res, 400, 'Table identifier is required.');
    }

    const table = await Table.findOne({
      $or: [{ tableId: tableIdentifier }, { qrIdentifier: tableIdentifier }],
    });

    if (!table) {
      return sendError(res, 404, 'Invalid or unknown table ID.');
    }

    if (table.status !== 'active') {
      return sendError(res, 400, 'This table is inactive and cannot place orders.');
    }

    return sendSuccess(res, 200, 'Table validated successfully.', { table });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getTables,
  getTableById,
  createTable,
  updateTable,
  validateTable,
};

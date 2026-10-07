'use strict';

const env = require('../config/env');
const { ApiError } = require('../lib/http');

const notFoundHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} does not exist.`));
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (error, req, res, _next) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Something went wrong';
  let details = error.details;

  if (error.name === 'ValidationError') {
    statusCode = 422;
    message = 'Validation failed';
    details = Object.fromEntries(Object.entries(error.errors || {}).map(([key, value]) => [key, value.message]));
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for "${error.path}"`;
  } else if (error.code === 11000) {
    statusCode = 409;
    const field = Object.keys(error.keyValue || { field: '' })[0];
    message = `An account/record with this ${field} already exists.`;
  }

  if (statusCode >= 500) {
    console.error('\x1b[31m✖ Server error\x1b[0m', error);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(env.nodeEnv === 'development' && statusCode >= 500 ? { stack: error.stack } : {}),
  });
};

module.exports = { notFoundHandler, errorHandler };

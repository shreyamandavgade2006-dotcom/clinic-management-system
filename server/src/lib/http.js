'use strict';

class ApiError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message);
  }
  static forbidden(message = 'You do not have access to this resource') {
    return new ApiError(403, message);
  }
  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }
  static conflict(message) {
    return new ApiError(409, message);
  }
  static unprocessable(message, details) {
    return new ApiError(422, message, details);
  }
}

/** Wraps async route handlers so rejected promises reach the error middleware. */
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

/** Uniform success envelope: { success: true, data, meta? } */
const ok = (res, data, meta) => {
  const payload = { success: true, data };
  if (meta) payload.meta = meta;
  return res.json(payload);
};

const created = (res, data) => res.status(201).json({ success: true, data });

module.exports = { ApiError, asyncHandler, ok, created };

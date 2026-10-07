'use strict';

const mongoose = require('mongoose');
const { ApiError } = require('../lib/http');

/**
 * Tiny declarative validator (no external dependency) used across the API.
 *
 *   router.post('/', validate({ body: { email: 'email|required', marks: 'number|min:0|max:100' } }), handler)
 *
 * Supported rules: required, email, number, integer, boolean, string, array,
 * date, min:n, max:n, minlength:n, maxlength:n, in:a|b|c, mongoId
 */
const isValidMongoId = (value) => {
  if (mongoose.Types.ObjectId.isValid(value)) return true;
  return /^[a-f0-9]{24}$/i.test(String(value));
};

const checkRule = (rule, value, field) => {
  const [name, rawArg] = rule.split(':');
  const arg = rawArg;

  switch (name) {
    case 'required':
      return value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)
        ? null
        : `${field} is required`;
    case 'email':
      return value === undefined || value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ? null
        : `${field} must be a valid email address`;
    case 'number':
      return value === undefined || value === '' || !Number.isNaN(Number(value)) ? null : `${field} must be a number`;
    case 'integer':
      return value === undefined || value === '' || Number.isInteger(Number(value)) ? null : `${field} must be a whole number`;
    case 'boolean':
      return value === undefined || typeof value === 'boolean' || ['true', 'false', 0, 1, '0', '1'].includes(value)
        ? null
        : `${field} must be true or false`;
    case 'string':
      return value === undefined || typeof value === 'string' ? null : `${field} must be text`;
    case 'array':
      return value === undefined || Array.isArray(value) ? null : `${field} must be a list`;
    case 'date':
      return value === undefined || value === '' || !Number.isNaN(new Date(value).getTime()) ? null : `${field} must be a valid date`;
    case 'mongoId':
      return value === undefined || value === '' || isValidMongoId(value) ? null : `${field} must be a valid id`;
    case 'min':
      return value === undefined || value === '' || Number(value) >= Number(arg) ? null : `${field} must be at least ${arg}`;
    case 'max':
      return value === undefined || value === '' || Number(value) <= Number(arg) ? null : `${field} must be at most ${arg}`;
    case 'minlength':
      return value === undefined || String(value).length >= Number(arg) ? null : `${field} must be at least ${arg} characters`;
    case 'maxlength':
      return value === undefined || String(value).length <= Number(arg) ? null : `${field} must be at most ${arg} characters`;
    case 'in': {
      const allowed = String(arg).split('|');
      if (value === undefined || value === '') return null;
      const values = Array.isArray(value) ? value : [value];
      return values.every((v) => allowed.includes(String(v)))
        ? null
        : `${field} must be one of: ${allowed.join(', ')}`;
    }
    default:
      return null;
  }
};

const runRules = (spec, payload, prefix = '') => {
  const errors = {};
  for (const [field, ruleString] of Object.entries(spec)) {
    const rules = String(ruleString).split('|').map((r) => r.trim()).filter(Boolean);
    const value = payload ? payload[field] : undefined;
    for (const rule of rules) {
      const message = checkRule(rule, value, prefix ? `${prefix}.${field}` : field);
      if (message) {
        errors[field] = message;
        break;
      }
    }
  }
  return errors;
};

const validate = (schema) => (req, _res, next) => {
  const errors = {
    ...(schema.body ? runRules(schema.body, req.body) : {}),
    ...(schema.params ? runRules(schema.params, req.params, 'params') : {}),
    ...(schema.query ? runRules(schema.query, req.query, 'query') : {}),
  };
  if (Object.keys(errors).length > 0) {
    return next(ApiError.unprocessable('Please fix the highlighted fields.', errors));
  }
  return next();
};

module.exports = { validate, isValidMongoId };

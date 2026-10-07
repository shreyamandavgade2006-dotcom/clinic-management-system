'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { ApiError, asyncHandler } = require('../lib/http');
const User = require('../models/User');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');

const signToken = (user) =>
  jwt.sign({ id: String(user._id), role: user.role, email: user.email }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });

const readToken = (req) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.query && req.query.token) return String(req.query.token);
  return null;
};

/** Verifies the JWT and attaches `req.user` plus the role profile (`req.student` / `req.teacher`). */
const protect = asyncHandler(async (req, _res, next) => {
  const token = readToken(req);
  if (!token) throw ApiError.unauthorized('No token provided — please sign in.');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (error) {
    throw ApiError.unauthorized(
      error.name === 'TokenExpiredError' ? 'Session expired — please sign in again.' : 'Invalid token.'
    );
  }

  const user = await User.findById(payload.id);
  if (!user) throw ApiError.unauthorized('Account no longer exists.');
  if (user.isActive === false) throw ApiError.forbidden('Your account has been deactivated. Contact the admin.');

  req.user = user;
  if (user.role === 'student') {
    req.student = await Student.findOne({ user: user._id });
    if (!req.student) throw ApiError.forbidden('Student profile is missing for this account.');
  } else if (user.role === 'teacher') {
    req.teacher = await Teacher.findOne({ user: user._id });
    if (!req.teacher) throw ApiError.forbidden('Teacher profile is missing for this account.');
  }
  return next();
});

/** Role guard: `allow('teacher')` */
const allow =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`This action is only available to ${roles.join(' / ')} accounts.`));
    }
    return next();
  };

const teacherOnly = allow('teacher');
const studentOnly = allow('student');

module.exports = { signToken, protect, allow, teacherOnly, studentOnly };

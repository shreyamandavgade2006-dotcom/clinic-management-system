'use strict';

const express = require('express');
const { asyncHandler } = require('../lib/http');
const { protect, teacherOnly, studentOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const auth = require('../controllers/authController');

const router = express.Router();

router.get('/config', asyncHandler(auth.publicConfig));

router.post(
  '/register',
  validate({
    body: {
      name: 'required|minlength:3',
      email: 'required|email',
      password: 'required|minlength:6',
      role: 'required|in:student|teacher',
    },
  }),
  asyncHandler(auth.register)
);

router.post(
  '/login',
  validate({ body: { email: 'required|email', password: 'required' } }),
  asyncHandler(auth.login)
);

router.get('/me', protect, asyncHandler(auth.me));
router.patch('/profile', protect, asyncHandler(auth.updateProfile));
router.patch(
  '/password',
  protect,
  validate({ body: { currentPassword: 'required', newPassword: 'required|minlength:6' } }),
  asyncHandler(auth.changePassword)
);
router.patch('/student-profile', protect, studentOnly, asyncHandler(auth.updateStudentProfile));

module.exports = router;

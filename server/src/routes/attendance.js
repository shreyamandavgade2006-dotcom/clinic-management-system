'use strict';

const express = require('express');
const { asyncHandler } = require('../lib/http');
const { protect, teacherOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const attendance = require('../controllers/attendanceController');

const router = express.Router();

router.use(protect);

// NOTE: specific routes must come before the dynamic "/:id" routes
router.get('/session', teacherOnly, asyncHandler(attendance.sessionSheet));
router.post(
  '/mark',
  teacherOnly,
  validate({ body: { subject: 'required|mongoId', records: 'required|array' } }),
  asyncHandler(attendance.markAttendance)
);

router.get('/defaulters', asyncHandler(attendance.defaulters));
router.get('/class/:className', asyncHandler(attendance.classAttendance));
router.get('/student/:id', asyncHandler(attendance.studentAttendance));

router.get('/', asyncHandler(attendance.listAttendance));

router.put('/:id', teacherOnly, asyncHandler(attendance.updateAttendance));
router.delete('/:id', teacherOnly, asyncHandler(attendance.deleteAttendance));
router.post('/:id/notify-guardian', teacherOnly, asyncHandler(attendance.notifyGuardian));

module.exports = router;

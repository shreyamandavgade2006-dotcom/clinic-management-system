'use strict';

const express = require('express');
const { asyncHandler } = require('../lib/http');
const { protect, teacherOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const teachers = require('../controllers/teacherController');

const router = express.Router();

router.use(protect);

router.get('/me', asyncHandler(teachers.myTeacherProfile));
router.put('/me', asyncHandler(teachers.updateMyTeacherProfile));

router.get('/', asyncHandler(teachers.listTeachers));
router.post(
  '/',
  teacherOnly,
  validate({ body: { name: 'required', email: 'required|email' } }),
  asyncHandler(teachers.createTeacher)
);

router.put('/:id/subjects', teacherOnly, asyncHandler(teachers.assignSubjects));
router.get('/:id', asyncHandler(teachers.getTeacher));

module.exports = router;

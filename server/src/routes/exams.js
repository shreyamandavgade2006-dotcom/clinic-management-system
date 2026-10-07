'use strict';

const express = require('express');
const { asyncHandler } = require('../lib/http');
const { protect, teacherOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const exams = require('../controllers/examController');

const router = express.Router();

router.use(protect);

router.get('/timetable/:className', asyncHandler(exams.timetable));

router.get('/', asyncHandler(exams.listExams));
router.post(
  '/',
  teacherOnly,
  validate({ body: { title: 'required', subject: 'required|mongoId', date: 'required|date' } }),
  asyncHandler(exams.createExam)
);

router.get('/:id', asyncHandler(exams.getExam));
router.put('/:id', teacherOnly, asyncHandler(exams.updateExam));
router.delete('/:id', teacherOnly, asyncHandler(exams.deleteExam));
router.post('/:id/remind', teacherOnly, asyncHandler(exams.sendExamReminders));

module.exports = router;

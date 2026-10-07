'use strict';

const express = require('express');
const { asyncHandler } = require('../lib/http');
const { protect, teacherOnly, studentOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const assignments = require('../controllers/assignmentController');

const router = express.Router();

router.use(protect);

router.get('/', asyncHandler(assignments.listAssignments));
router.post(
  '/',
  teacherOnly,
  validate({ body: { title: 'required', subject: 'required|mongoId', dueDate: 'required|date' } }),
  asyncHandler(assignments.createAssignment)
);

router.get('/:id', asyncHandler(assignments.getAssignment));
router.put('/:id', teacherOnly, asyncHandler(assignments.updateAssignment));
router.delete('/:id', teacherOnly, asyncHandler(assignments.deleteAssignment));

router.get('/:id/submissions', teacherOnly, asyncHandler(assignments.listSubmissions));
router.post('/:id/submit', studentOnly, asyncHandler(assignments.submitAssignment));
router.put('/:id/grade/:submissionId', teacherOnly, asyncHandler(assignments.gradeSubmission));
router.post('/:id/remind', teacherOnly, asyncHandler(assignments.remindPending));

module.exports = router;

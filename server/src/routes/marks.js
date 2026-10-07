'use strict';

const express = require('express');
const { asyncHandler } = require('../lib/http');
const { protect, teacherOnly } = require('../middleware/auth');
const marks = require('../controllers/markController');

const router = express.Router();

router.use(protect);

router.get('/class/:className', asyncHandler(marks.classPerformance));
router.get('/subject/:subjectId', asyncHandler(marks.subjectMarks));
router.get('/student/:id', asyncHandler(marks.studentPerformance));

router.get('/', asyncHandler(marks.listMarks));
router.post('/', teacherOnly, asyncHandler(marks.createMarks));

router.put('/:id', teacherOnly, asyncHandler(marks.updateMark));
router.delete('/:id', teacherOnly, asyncHandler(marks.deleteMark));

module.exports = router;

'use strict';

const express = require('express');
const { asyncHandler } = require('../lib/http');
const { protect, teacherOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const subjects = require('../controllers/subjectController');

const router = express.Router();

router.use(protect);

router.get('/', asyncHandler(subjects.listSubjects));
router.post(
  '/',
  teacherOnly,
  validate({ body: { code: 'required', name: 'required', className: 'required' } }),
  asyncHandler(subjects.createSubject)
);

router.get('/:id', asyncHandler(subjects.getSubject));
router.put('/:id', teacherOnly, asyncHandler(subjects.updateSubject));
router.delete('/:id', teacherOnly, asyncHandler(subjects.deleteSubject));

// syllabus (units + topics) used as the source list for the AI generator
router.get('/:id/units', asyncHandler(subjects.subjectUnits));
router.put('/:id/units', teacherOnly, asyncHandler(subjects.saveUnits));

module.exports = router;

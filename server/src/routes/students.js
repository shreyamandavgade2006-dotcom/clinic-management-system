'use strict';

const express = require('express');
const { asyncHandler } = require('../lib/http');
const { protect, teacherOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const students = require('../controllers/studentController');

const router = express.Router();

router.use(protect);

router.get('/me', asyncHandler(students.myProfile));
router.get('/meta/classes', asyncHandler(students.classMeta));

router.get('/', asyncHandler(students.listStudents));
router.post(
  '/',
  teacherOnly,
  validate({ body: { name: 'required', email: 'required|email', rollNo: 'required', className: 'required' } }),
  asyncHandler(students.createStudent)
);
router.post('/bulk', teacherOnly, asyncHandler(students.bulkImport));

router.get('/:id', asyncHandler(students.getStudent));
router.put('/:id', teacherOnly, asyncHandler(students.updateStudent));
router.delete('/:id', teacherOnly, asyncHandler(students.deleteStudent));

module.exports = router;

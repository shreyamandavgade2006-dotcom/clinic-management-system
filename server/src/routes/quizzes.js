'use strict';

const express = require('express');
const { asyncHandler } = require('../lib/http');
const { protect, teacherOnly, studentOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const quizzes = require('../controllers/quizController');

const router = express.Router();

router.use(protect);

/* ------------------------- AI generation (teacher) ------------------------- */
router.post(
  '/generate',
  teacherOnly,
  validate({ body: { subject: 'required|mongoId', count: 'number|min:1|max:30', totalMarks: 'number|min:1|max:200' } }),
  asyncHandler(quizzes.generateQuiz)
);
router.post('/generate/preview', teacherOnly, asyncHandler(quizzes.previewGeneration));

/* ------------------------------ attempts ------------------------------ */
router.get('/attempts/me', studentOnly, asyncHandler(quizzes.myAttempts));
router.get('/attempts/:attemptId', asyncHandler(quizzes.getAttempt));
router.put('/attempts/:attemptId/review', teacherOnly, asyncHandler(quizzes.reviewAttempt));

/* -------------------------------- CRUD -------------------------------- */
router.get('/', asyncHandler(quizzes.listQuizzes));
router.get('/:id', asyncHandler(quizzes.getQuiz));
router.put('/:id', teacherOnly, asyncHandler(quizzes.updateQuiz));
router.delete('/:id', teacherOnly, asyncHandler(quizzes.deleteQuiz));

/* ------------------------------- attempts ------------------------------- */
router.post('/:id/start', studentOnly, asyncHandler(quizzes.startAttempt));
router.post('/:id/submit', studentOnly, asyncHandler(quizzes.submitAttempt));

module.exports = router;

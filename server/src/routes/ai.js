'use strict';

const express = require('express');
const { asyncHandler } = require('../lib/http');
const { protect, teacherOnly } = require('../middleware/auth');
const Subject = require('../models/Subject');
const Quiz = require('../models/Quiz');
const { providerStatus } = require('../services/aiService');
const { ok, ApiError } = require('../lib/http');

const router = express.Router();

router.use(protect, teacherOnly);

/** GET /api/ai/status — which provider is active and whether a key is configured */
router.get(
  '/status',
  asyncHandler(async (_req, res) => ok(res, providerStatus()))
);

/**
 * GET /api/ai/options?subject=<id>
 * Everything the generator form needs: subjects → units → topics, plus limits.
 */
router.get(
  '/options',
  asyncHandler(async (req, res) => {
    const filter = { isActive: true };
    if (req.query.subject) filter._id = req.query.subject;
    else if (req.teacher?.classes?.length) filter.className = { $in: req.teacher.classes };

    const subjects = await Subject.find(filter).select('name code shortName className units color').lean();
    const allTopics = subjects.flatMap((subject) =>
      (subject.units || []).flatMap((unit) => (unit.topics || []).map((topic) => ({ topic, unit: unit.title, subject: subject.name })))
    );

    return ok(res, {
      provider: providerStatus(),
      subjects,
      topics: allTopics,
      limits: { maxQuestions: 30, maxMarks: 200 },
      difficulties: ['easy', 'medium', 'hard', 'mixed'],
      questionTypes: [
        { value: 'mcq', label: 'Multiple Choice (MCQ)' },
        { value: 'true-false', label: 'True / False' },
        { value: 'short-answer', label: 'Short Answer' },
        { value: 'long-answer', label: 'Long Answer / Descriptive' },
        { value: 'fill-blank', label: 'Fill in the Blanks' },
        { value: 'numerical', label: 'Numerical Problems' },
        { value: 'mixed', label: 'Mixed' },
      ],
      paperTypes: [
        { value: 'quiz', label: 'Quiz (auto-graded, instant results)' },
        { value: 'assessment', label: 'Assessment' },
        { value: 'question-paper', label: 'Question Paper (for exams)' },
      ],
    });
  })
);

/** GET /api/ai/history — previously generated papers */
router.get(
  '/history',
  asyncHandler(async (req, res) => {
    const quizzes = await Quiz.find({ teacher: req.teacher._id, aiGenerated: true })
      .populate('subject', 'name code color')
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 20)
      .lean();
    return ok(res, quizzes);
  })
);

/** GET /api/ai/topics/:subjectId — quick topic lookup used by the form */
router.get(
  '/topics/:subjectId',
  asyncHandler(async (req, res) => {
    const subject = await Subject.findById(req.params.subjectId).lean();
    if (!subject) throw ApiError.notFound('Subject not found.');
    return ok(res, { subject: { name: subject.name, code: subject.code }, units: subject.units || [] });
  })
);

module.exports = router;

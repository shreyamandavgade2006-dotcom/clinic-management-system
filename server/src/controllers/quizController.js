'use strict';

const { ApiError, ok, created } = require('../lib/http');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Mark = require('../models/Mark');
const { computeGrade } = require('../models/Mark');
const { notifyClass, notify } = require('../services/notificationService');
const { generateAssessment, providerStatus } = require('../services/aiService');

const POPULATE = [
  { path: 'subject', select: 'name code shortName color' },
  { path: 'teacher', select: 'employeeId designation', populate: { path: 'user', select: 'name' } },
];

/* ------------------------------------------------------------------ *
 * auto evaluation
 * ------------------------------------------------------------------ */

const normalise = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^\w\s.+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'is', 'are', 'and', 'to', 'in', 'for', 'on', 'with', 'that', 'it', 'as']);

const keywords = (value) =>
  normalise(value)
    .split(' ')
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

/**
 * Scores a single answer.
 * MCQ / true-false  → exact match, full marks or zero.
 * fill-blank/short  → keyword overlap based partial credit.
 * long-answer       → flagged for manual review (teacher grades later).
 */
function evaluateAnswer(questionDoc, submitted) {
  const question = questionDoc.questionText || '';
  const type = questionDoc.type || 'mcq';
  const maxMarks = Number(questionDoc.marks) || 1;
  const given = String(submitted ?? '').trim();
  const expected = String(questionDoc.correctAnswer || questionDoc.expectedAnswer || '').trim();

  const base = {
    questionId: String(questionDoc._id),
    questionText: question,
    answer: given,
    maxMarks,
    isCorrect: false,
    marksAwarded: 0,
    needsManualReview: false,
    feedback: '',
    correctAnswer: expected,
  };

  if (!given) {
    return { ...base, feedback: 'Not attempted' };
  }

  if (type === 'mcq' || type === 'true-false') {
    const isCorrect = normalise(given) === normalise(expected);
    return {
      ...base,
      isCorrect,
      marksAwarded: isCorrect ? maxMarks : 0,
      feedback: isCorrect ? 'Correct' : `Incorrect — correct answer: ${expected}`,
    };
  }

  if (type === 'numerical') {
    const givenNum = Number(String(given).replace(/[^\d.\-]/g, ''));
    const expectedNum = Number(String(expected).replace(/[^\d.\-]/g, ''));
    const isCorrect = Number.isFinite(givenNum) && Number.isFinite(expectedNum) && Math.abs(givenNum - expectedNum) < 0.01;
    return {
      ...base,
      isCorrect,
      marksAwarded: isCorrect ? maxMarks : 0,
      feedback: isCorrect ? 'Correct' : `Expected ≈ ${expected}`,
    };
  }

  if (type === 'long-answer') {
    // descriptive answers always go to the teacher
    return {
      ...base,
      needsManualReview: true,
      marksAwarded: 0,
      feedback: 'Awaiting teacher evaluation',
      correctAnswer: expected,
      keywordHints: keywords(expected).slice(0, 6),
    };
  }

  // short-answer / fill-blank → keyword overlap
  const expectedWords = keywords(expected);
  if (expectedWords.length === 0) {
    const isCorrect = normalise(given) === normalise(expected);
    return { ...base, isCorrect, marksAwarded: isCorrect ? maxMarks : 0, needsManualReview: !isCorrect };
  }

  const givenSet = new Set(keywords(given));
  const matched = expectedWords.filter((word) => givenSet.has(word));
  const ratio = matched.length / expectedWords.length;

  if (normalise(given) === normalise(expected) || ratio >= 0.6) {
    return { ...base, isCorrect: true, marksAwarded: maxMarks, feedback: `Correct (${Math.round(ratio * 100)}% keyword match)` };
  }
  if (ratio >= 0.3) {
    const partial = Math.max(1, Math.round(maxMarks * 0.5));
    return {
      ...base,
      isCorrect: false,
      marksAwarded: partial,
      feedback: `Partially correct (${Math.round(ratio * 100)}% keyword match — ${partial}/${maxMarks} marks)`,
    };
  }

  return {
    ...base,
    isCorrect: false,
    marksAwarded: 0,
    needsManualReview: maxMarks > 2,
    feedback: `Incorrect — expected key points: ${expectedWords.slice(0, 5).join(', ')}`,
  };
}

/* ------------------------------------------------------------------ *
 * AI generation
 * ------------------------------------------------------------------ */

/** Build the generation request from the teacher's selection */
const buildGenerateRequest = async (body, teacher) => {
  const {
    subject: subjectId,
    unit = '',
    topics = [],
    difficulty = 'medium',
    questionType = 'mcq',
    count = 10,
    totalMarks = 10,
    paperType = 'quiz',
    durationMinutes = 15,
    className,
    language = 'English',
    extraInstructions = '',
  } = body;

  const subjectDoc = await Subject.findById(subjectId).lean();
  if (!subjectDoc) throw ApiError.notFound('Subject not found.');

  const numericCount = Math.min(30, Math.max(1, Number(count) || 10));
  const numericMarks = Math.min(200, Math.max(1, Number(totalMarks) || 10));

  const cleanTopics = (Array.isArray(topics) ? topics : String(topics).split(','))
    .map((topic) => String(topic).trim())
    .filter(Boolean);

  // fall back to the topics defined on the selected unit of the syllabus
  let finalTopics = cleanTopics;
  if (finalTopics.length === 0 && unit && subjectDoc.units?.length) {
    const match = subjectDoc.units.find((u) => String(u.title) === String(unit) || String(u.unitNo) === String(unit));
    if (match?.topics?.length) finalTopics = match.topics;
  }
  if (finalTopics.length === 0 && subjectDoc.units?.length) {
    finalTopics = subjectDoc.units.flatMap((u) => u.topics || []).slice(0, 6);
  }

  return {
    subject: subjectDoc.name,
    subjectCode: subjectDoc.code,
    className: className || subjectDoc.className,
    unit,
    topics: finalTopics,
    difficulty,
    questionType,
    count: numericCount,
    totalMarks: numericMarks,
    paperType,
    durationMinutes: Number(durationMinutes) || Math.max(10, numericCount * 2),
    language,
    extraInstructions,
    subjectId: String(subjectDoc._id),
    teacherId: teacher?._id,
  };
};

/**
 * POST /api/quizzes/generate
 * Teacher selects subject → unit → topic → difficulty → type → count → marks and the AI writes the paper.
 */
const generateQuiz = async (req, res) => {
  if (!req.teacher) throw ApiError.forbidden('Only teachers can generate assessments.');

  const request = await buildGenerateRequest(req.body, req.teacher);
  const generated = await generateAssessment(request);

  const shouldSave = String(req.body.save ?? 'true') !== 'false';

  const payload = {
    title: req.body.title || generated.title,
    description: req.body.description || `${generated.questions.length} ${request.questionType} question(s) on ${request.unit || request.topics[0] || request.subject}`,
    subject: request.subjectId,
    teacher: req.teacher._id,
    className: request.className,
    unit: request.unit,
    topic: request.topics.join(', '),
    difficulty: request.difficulty,
    questionType: request.questionType,
    paperType: request.paperType,
    totalMarks: generated.totalMarks || request.totalMarks,
    durationMinutes: request.durationMinutes,
    questions: generated.questions,
    instructions: generated.instructions,
    aiGenerated: true,
    aiProvider: generated.provider,
    aiModel: generated.model,
    generationPrompt: generated.prompt,
    status: req.body.status || 'draft',
    showAnswers: req.body.showAnswers ?? false,
    dueDate: req.body.dueDate || null,
    availableFrom: new Date(),
    maxAttempts: Number(req.body.maxAttempts) || 1,
  };

  if (!shouldSave) {
    return ok(res, {
      preview: true,
      ...generated,
      request: { ...request, teacherId: undefined },
      providerStatus: providerStatus(),
    });
  }

  const quiz = await Quiz.create(payload);

  if (quiz.status === 'published') {
    await notifyClass(
      quiz.className,
      {
        title: `New ${quiz.paperType === 'quiz' ? 'quiz' : 'assessment'}: ${quiz.title}`,
        message: `${quiz.questions.length} questions · ${quiz.totalMarks} marks · ${quiz.durationMinutes} minutes`,
        type: 'quiz',
        priority: 'high',
        link: `/student/quizzes/${quiz._id}`,
      },
      { studentsOnly: true }
    );
  }

  return created(res, {
    quiz: await Quiz.findById(quiz._id).populate(POPULATE),
    provider: generated.provider,
    model: generated.model,
    fallback: generated.fallback || null,
  });
};

/** POST /api/quizzes/generate/preview — generate without saving */
const previewGeneration = async (req, res) => {
  const request = await buildGenerateRequest(req.body, req.teacher);
  const generated = await generateAssessment(request);
  return ok(res, { ...generated, request: { ...request, teacherId: undefined }, providerStatus: providerStatus() });
};

/* ------------------------------------------------------------------ *
 * CRUD
 * ------------------------------------------------------------------ */

/** GET /api/quizzes */
const listQuizzes = async (req, res) => {
  const { className, subject, status, paperType } = req.query;
  const filter = {};

  if (req.user.role === 'student') {
    filter.className = req.student.className;
    filter.status = 'published';
  } else {
    if (className) filter.className = className;
    else if (req.teacher?.classes?.length) filter.className = { $in: req.teacher.classes };
    if (status) filter.status = status;
    if (req.query.mine === 'true' && req.teacher) filter.teacher = req.teacher._id;
  }
  if (subject) filter.subject = subject;
  if (paperType) filter.paperType = paperType;

  const quizzes = await Quiz.find(filter).populate(POPULATE).sort({ createdAt: -1 }).lean();
  const attempts = await QuizAttempt.find({ quiz: { $in: quizzes.map((q) => q._id) } }).lean();

  const enriched = quizzes.map((quiz) => {
    const related = attempts.filter((a) => String(a.quiz) === String(quiz._id));
    const base = {
      ...quiz,
      questionCount: quiz.questions?.length || 0,
      attemptCount: related.length,
      averageScore: related.length
        ? Math.round((related.reduce((sum, a) => sum + (a.percentage || 0), 0) / related.length) * 10) / 10
        : 0,
    };

    if (req.user.role === 'student') {
      const mine = related.filter((a) => String(a.student) === String(req.student._id));
      return {
        ...base,
        myAttempts: mine.length,
        myBestScore: mine.length ? Math.max(...mine.map((a) => a.percentage)) : null,
        canAttempt: mine.length < (quiz.maxAttempts || 1) && (!quiz.dueDate || new Date(quiz.dueDate) > new Date()),
      };
    }
    return base;
  });

  return ok(res, enriched, { total: enriched.length });
};

/** GET /api/quizzes/:id */
const getQuiz = async (req, res) => {
  const quiz = await Quiz.findById(req.params.id).populate(POPULATE);
  if (!quiz) throw ApiError.notFound('Assessment not found.');

  if (req.user.role === 'teacher') {
    const attempts = await QuizAttempt.find({ quiz: quiz._id })
      .populate({ path: 'student', select: 'rollNo className', populate: { path: 'user', select: 'name email' } })
      .lean();

    const scores = attempts.map((a) => a.percentage).filter((v) => typeof v === 'number');
    return ok(res, {
      quiz,
      attempts,
      analytics: {
        attempts: attempts.length,
        average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
        highest: scores.length ? Math.max(...scores) : 0,
        lowest: scores.length ? Math.min(...scores) : 0,
        passRate: scores.length ? Math.round((scores.filter((s) => s >= 40).length / scores.length) * 100) : 0,
        distribution: [
          { range: '90-100', count: scores.filter((s) => s >= 90).length },
          { range: '75-89', count: scores.filter((s) => s >= 75 && s < 90).length },
          { range: '60-74', count: scores.filter((s) => s >= 60 && s < 75).length },
          { range: '40-59', count: scores.filter((s) => s >= 40 && s < 60).length },
          { range: '0-39', count: scores.filter((s) => s < 40).length },
        ],
      },
    });
  }

  // students never receive the answer key before attempting
  const attempts = await QuizAttempt.find({ quiz: quiz._id, student: req.student._id }).lean();
  const latest = attempts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
  const canReveal = latest && latest.status === 'evaluated' && quiz.showAnswers;

  const safeQuestions = (quiz.questions || []).map((question) => ({
    _id: question._id,
    questionText: question.questionText,
    type: question.type,
    options: question.options,
    marks: question.marks,
    difficulty: question.difficulty,
    topic: question.topic,
    unit: question.unit,
    ...(canReveal ? { correctAnswer: question.correctAnswer, explanation: question.explanation } : {}),
  }));

  const quizObj = quiz.toObject ? quiz.toObject() : { ...quiz };
  quizObj.questions = safeQuestions;

  return ok(res, {
    quiz: quizObj,
    attempts: attempts.map((a) => ({
      _id: a._id,
      score: a.score,
      totalMarks: a.totalMarks,
      percentage: a.percentage,
      grade: a.grade,
      submittedAt: a.submittedAt,
      status: a.status,
    })),
    latestAttempt: latest,
    canAttempt:
      attempts.length < (quiz.maxAttempts || 1) && (!quiz.dueDate || new Date(quiz.dueDate) > new Date()),
  });
};

/** PUT /api/quizzes/:id */
const updateQuiz = async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) throw ApiError.notFound('Assessment not found.');

  const editable = [
    'title',
    'description',
    'unit',
    'topic',
    'difficulty',
    'questionType',
    'paperType',
    'durationMinutes',
    'instructions',
    'status',
    'showAnswers',
    'dueDate',
    'maxAttempts',
  ];
  const updates = {};
  editable.forEach((key) => {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  });

  if (req.body.questions) {
    updates.questions = req.body.questions;
    updates.totalMarks = req.body.questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  } else if (req.body.totalMarks !== undefined) {
    updates.totalMarks = Number(req.body.totalMarks);
  }

  const wasDraft = quiz.status === 'draft';
  const updated = await Quiz.findByIdAndUpdate(quiz._id, { $set: updates }, { new: true }).populate(POPULATE);

  if (wasDraft && updates.status === 'published') {
    await notifyClass(
      updated.className,
      {
        title: `New ${updated.paperType === 'quiz' ? 'quiz' : 'assessment'}: ${updated.title}`,
        message: `${updated.questions.length} questions · ${updated.totalMarks} marks`,
        type: 'quiz',
        priority: 'high',
        link: `/student/quizzes/${updated._id}`,
      },
      { studentsOnly: true }
    );
  }

  return ok(res, updated);
};

/** DELETE /api/quizzes/:id */
const deleteQuiz = async (req, res) => {
  const quiz = await Quiz.findByIdAndDelete(req.params.id);
  if (!quiz) throw ApiError.notFound('Assessment not found.');
  await QuizAttempt.deleteMany({ quiz: quiz._id });
  return ok(res, { message: 'Assessment and its attempts were deleted.' });
};

/* ------------------------------------------------------------------ *
 * attempts (student side)
 * ------------------------------------------------------------------ */

/** POST /api/quizzes/:id/start */
const startAttempt = async (req, res) => {
  const quiz = await Quiz.findById(req.params.id).populate('subject', 'name code color');
  if (!quiz) throw ApiError.notFound('Assessment not found.');
  if (quiz.status !== 'published') throw ApiError.badRequest('This assessment is not open yet.');
  if (String(quiz.className) !== String(req.student.className)) throw ApiError.forbidden('This assessment is not for your class.');
  if (quiz.dueDate && new Date(quiz.dueDate) < new Date()) throw ApiError.badRequest('The deadline for this assessment has passed.');

  const previous = await QuizAttempt.find({ quiz: quiz._id, student: req.student._id }).lean();
  const finished = previous.filter((a) => a.status !== 'in-progress');

  if (finished.length >= (quiz.maxAttempts || 1)) {
    throw ApiError.badRequest(`You have already used all ${quiz.maxAttempts} attempt(s) for this assessment.`);
  }

  // resume an in-progress attempt instead of creating a duplicate
  const inProgress = previous.find((a) => a.status === 'in-progress');
  if (inProgress) {
    const safeQuiz = { ...quiz.toObject?.() ?? quiz };
    safeQuiz.questions = (safeQuiz.questions || []).map((q) => ({
      _id: q._id,
      questionText: q.questionText,
      type: q.type,
      options: q.options,
      marks: q.marks,
      topic: q.topic,
    }));
    return ok(res, { attempt: inProgress, quiz: safeQuiz, resumed: true });
  }

  const attempt = await QuizAttempt.create({
    quiz: quiz._id,
    student: req.student._id,
    className: req.student.className,
    subject: quiz.subject?._id || quiz.subject || null,
    totalMarks: quiz.totalMarks,
    status: 'in-progress',
    startedAt: new Date(),
  });

  const safeQuiz = quiz.toObject ? quiz.toObject() : { ...quiz };
  safeQuiz.questions = (safeQuiz.questions || []).map((question) => ({
    _id: question._id,
    questionText: question.questionText,
    type: question.type,
    options: question.options,
    marks: question.marks,
    topic: question.topic,
  }));

  return created(res, { attempt, quiz: safeQuiz, resumed: false });
};

/** POST /api/quizzes/:id/submit — auto evaluation */
const submitAttempt = async (req, res) => {
  const quiz = await Quiz.findById(req.params.id).populate('subject', 'name');
  if (!quiz) throw ApiError.notFound('Assessment not found.');

  const { answers = [], attemptId, timeTakenSeconds } = req.body;

  let attempt = attemptId ? await QuizAttempt.findById(attemptId) : null;
  if (!attempt) {
    attempt = await QuizAttempt.findOne({ quiz: quiz._id, student: req.student._id, status: 'in-progress' });
  }
  if (!attempt) throw ApiError.badRequest('No active attempt found. Start the assessment first.');
  if (String(attempt.student) !== String(req.student._id)) throw ApiError.forbidden('This attempt belongs to another student.');
  if (attempt.status !== 'in-progress') throw ApiError.badRequest('This attempt has already been submitted.');

  const answerMap = new Map(
    (Array.isArray(answers) ? answers : []).map((entry) => [String(entry.questionId), entry.answer ?? entry.selectedOption ?? ''])
  );

  const evaluated = (quiz.questions || []).map((question) => {
    const submitted = answerMap.has(String(question._id)) ? answerMap.get(String(question._id)) : '';
    return evaluateAnswer(question, submitted);
  });

  const score = evaluated.reduce((sum, answer) => sum + answer.marksAwarded, 0);
  const totalMarks = evaluated.reduce((sum, answer) => sum + answer.maxMarks, 0);
  const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 1000) / 10 : 0;
  const { grade } = computeGrade(score, totalMarks || 1);

  const correctCount = evaluated.filter((a) => a.isCorrect).length;
  const skippedCount = evaluated.filter((a) => !a.answer).length;
  const needsReview = evaluated.some((a) => a.needsManualReview);

  // per-topic breakdown for the performance chart
  const topicMap = new Map();
  (quiz.questions || []).forEach((question, index) => {
    const key = question.topic || question.unit || 'General';
    const entry = topicMap.get(key) || { topic: key, correct: 0, total: 0 };
    entry.total += 1;
    if (evaluated[index]?.isCorrect) entry.correct += 1;
    topicMap.set(key, entry);
  });

  const updated = await QuizAttempt.findByIdAndUpdate(
    attempt._id,
    {
      $set: {
        answers: evaluated,
        score,
        totalMarks,
        percentage,
        grade,
        correctCount,
        wrongCount: evaluated.length - correctCount - skippedCount,
        skippedCount,
        topicBreakdown: [...topicMap.values()],
        status: needsReview ? 'submitted' : 'evaluated',
        submittedAt: new Date(),
        timeTakenSeconds: Number(timeTakenSeconds) || Math.round((Date.now() - new Date(attempt.startedAt)) / 1000),
        feedback: needsReview
          ? 'Descriptive answers are pending teacher evaluation.'
          : percentage >= 75
            ? 'Excellent work! Keep it up.'
            : percentage >= 40
              ? 'Good attempt — review the incorrect topics.'
              : 'Needs improvement — revise this unit and try again.',
      },
    },
    { new: true }
  ).populate('quiz', 'title totalMarks paperType subject');

  // refresh the aggregate quiz stats
  const allAttempts = await QuizAttempt.find({ quiz: quiz._id, status: { $ne: 'in-progress' } }).lean();
  const percentages = allAttempts.map((a) => a.percentage);
  await Quiz.findByIdAndUpdate(quiz._id, {
    $set: {
      stats: {
        attemptCount: allAttempts.length,
        averageScore: percentages.length ? Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 10) / 10 : 0,
        highestScore: percentages.length ? Math.max(...percentages) : 0,
        lowestScore: percentages.length ? Math.min(...percentages) : 0,
      },
    },
  });

  // store the score as internal assessment marks so it flows into performance analytics
  if (!needsReview && percentage >= 0) {
    const existingMark = await Mark.findOne({ student: req.student._id, subject: quiz.subject?._id || quiz.subject, examType: 'internal', title: quiz.title });
    const markPayload = {
      student: req.student._id,
      subject: quiz.subject?._id || quiz.subject,
      className: req.student.className,
      examType: 'internal',
      title: quiz.title,
      marksObtained: score,
      maxMarks: totalMarks || 1,
      weightage: 50,
      grade,
      examDate: new Date(),
      remarks: 'Auto-graded AI assessment',
    };
    if (existingMark) await Mark.findByIdAndUpdate(existingMark._id, { $set: markPayload });
    else await Mark.create(markPayload);
  }

  await notify({
    user: req.user._id,
    title: `Result ready — ${quiz.title}`,
    message: `You scored ${score}/${totalMarks} (${percentage}%, Grade ${grade}).${needsReview ? ' Descriptive answers await teacher evaluation.' : ''}`,
    type: 'result',
    link: `/student/quizzes/${quiz._id}`,
    priority: percentage >= 40 ? 'normal' : 'high',
  });

  return ok(res, {
    attempt: updated,
    result: {
      score,
      totalMarks,
      percentage,
      grade,
      correctCount,
      wrongCount: evaluated.length - correctCount - skippedCount,
      skippedCount,
      needsReview,
      topicBreakdown: [...topicMap.values()],
    },
    review: evaluated.map((answer, index) => ({
      ...answer,
      questionText: quiz.questions[index]?.questionText,
      explanation: quiz.questions[index]?.explanation,
      options: quiz.questions[index]?.options,
      showAnswer: quiz.showAnswers || quiz.paperType === 'quiz',
    })),
  });
};

/** GET /api/quizzes/attempts/me — the student's own attempt history */
const myAttempts = async (req, res) => {
  const attempts = await QuizAttempt.find({ student: req.student._id })
    .populate({ path: 'quiz', select: 'title totalMarks paperType difficulty subject', populate: { path: 'subject', select: 'name code color' } })
    .sort({ createdAt: -1 })
    .lean();

  const completed = attempts.filter((a) => a.status !== 'in-progress');
  const average = completed.length
    ? Math.round((completed.reduce((sum, a) => sum + (a.percentage || 0), 0) / completed.length) * 10) / 10
    : 0;

  const trend = completed
    .slice(0, 10)
    .reverse()
    .map((a, index) => ({ label: `#${index + 1}`, percentage: a.percentage, title: a.quiz?.title || '' }));

  const topicScores = {};
  completed.forEach((attempt) => {
    (attempt.topicBreakdown || []).forEach((entry) => {
      topicScores[entry.topic] = topicScores[entry.topic] || { topic: entry.topic, correct: 0, total: 0 };
      topicScores[entry.topic].correct += entry.correct;
      topicScores[entry.topic].total += entry.total;
    });
  });

  return ok(res, {
    attempts,
    summary: {
      total: attempts.length,
      completed: completed.length,
      average,
      best: completed.length ? Math.max(...completed.map((a) => a.percentage)) : 0,
      trend,
      topicScores: Object.values(topicScores).map((entry) => ({
        ...entry,
        percentage: entry.total ? Math.round((entry.correct / entry.total) * 100) : 0,
      })),
    },
  });
};

/** GET /api/quizzes/attempts/:attemptId */
const getAttempt = async (req, res) => {
  const attempt = await QuizAttempt.findById(req.params.attemptId).populate({
    path: 'quiz',
    select: 'title instructions showAnswers paperType totalMarks subject durationMinutes',
    populate: { path: 'subject', select: 'name code color' },
  });
  if (!attempt) throw ApiError.notFound('Attempt not found.');

  const isOwner = String(attempt.student) === String(req.student?._id || '');
  if (req.user.role === 'student' && !isOwner) throw ApiError.forbidden('You can only view your own attempts.');

  return ok(res, attempt);
};

/** PUT /api/quizzes/attempts/:attemptId/review — teacher grades descriptive answers */
const reviewAttempt = async (req, res) => {
  const { reviews = [], feedback = '' } = req.body;
  const attempt = await QuizAttempt.findById(req.params.attemptId);
  if (!attempt) throw ApiError.notFound('Attempt not found.');

  const reviewMap = new Map(reviews.map((entry) => [String(entry.questionId), entry]));
  const answers = (attempt.answers || []).map((answer) => {
    const review = reviewMap.get(String(answer.questionId));
    if (!review) return answer;
    const marks = Math.min(Number(review.marksAwarded) || 0, answer.maxMarks);
    return {
      ...answer,
      marksAwarded: marks,
      feedback: review.feedback || answer.feedback,
      isCorrect: marks >= answer.maxMarks * 0.6,
      needsManualReview: false,
    };
  });

  const score = answers.reduce((sum, a) => sum + (a.marksAwarded || 0), 0);
  const totalMarks = answers.reduce((sum, a) => sum + (a.maxMarks || 0), 0);
  const percentage = totalMarks ? Math.round((score / totalMarks) * 1000) / 10 : 0;
  const { grade } = computeGrade(score, totalMarks || 1);
  const stillPending = answers.some((a) => a.needsManualReview);

  const updated = await QuizAttempt.findByIdAndUpdate(
    attempt._id,
    {
      $set: {
        answers,
        score,
        totalMarks,
        percentage,
        grade,
        status: stillPending ? 'submitted' : 'evaluated',
        feedback: feedback || attempt.feedback,
      },
    },
    { new: true }
  );

  const studentDoc = await Student.findById(attempt.student);
  if (studentDoc && !stillPending) {
    await notify({
      user: studentDoc.user,
      title: 'Quiz evaluation completed',
      message: `Your descriptive answers were graded — final score ${score}/${totalMarks} (${percentage}%, Grade ${grade}).`,
      type: 'result',
      link: '/student/quizzes',
    });
  }

  return ok(res, updated);
};

module.exports = {
  generateQuiz,
  previewGeneration,
  listQuizzes,
  getQuiz,
  updateQuiz,
  deleteQuiz,
  startAttempt,
  submitAttempt,
  myAttempts,
  getAttempt,
  reviewAttempt,
  evaluateAnswer,
};

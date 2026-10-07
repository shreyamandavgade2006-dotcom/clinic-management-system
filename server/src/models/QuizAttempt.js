'use strict';

const mongoose = require('../lib/modelFactory').mongoose;
const { defineModel } = require('../lib/modelFactory');

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: String, default: '' },
    questionText: { type: String, default: '' },
    answer: { type: String, default: '' },
    correctAnswer: { type: String, default: '' },
    isCorrect: { type: Boolean, default: false },
    marksAwarded: { type: Number, default: 0 },
    maxMarks: { type: Number, default: 1 },
    needsManualReview: { type: Boolean, default: false },
    feedback: { type: String, default: '' },
  },
  { _id: true }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    className: { type: String, required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: null },
    timeTakenSeconds: { type: Number, default: 0 },
    answers: [answerSchema],
    score: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    grade: { type: String, default: '' },
    correctCount: { type: Number, default: 0 },
    wrongCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    status: { type: String, enum: ['in-progress', 'submitted', 'evaluated'], default: 'in-progress', index: true },
    topicBreakdown: [{ topic: { type: String, default: '' }, correct: { type: Number, default: 0 }, total: { type: Number, default: 0 } }],
    feedback: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = defineModel('QuizAttempt', quizAttemptSchema);

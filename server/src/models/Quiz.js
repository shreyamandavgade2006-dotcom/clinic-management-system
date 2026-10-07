'use strict';

const mongoose = require('../lib/modelFactory').mongoose;
const { defineModel } = require('../lib/modelFactory');

const questionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true },
    type: {
      type: String,
      enum: ['mcq', 'true-false', 'short-answer', 'long-answer', 'fill-blank', 'numerical'],
      default: 'mcq',
    },
    options: [{ type: String }],
    correctAnswer: { type: String, default: '' },
    expectedAnswer: { type: String, default: '' },
    explanation: { type: String, default: '' },
    marks: { type: Number, default: 1 },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    topic: { type: String, default: '' },
    unit: { type: String, default: '' },
  },
  { _id: true }
);

const quizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    className: { type: String, required: true, index: true },
    unit: { type: String, default: '' },
    topic: { type: String, default: '' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'mixed'], default: 'medium' },
    questionType: {
      type: String,
      enum: ['mcq', 'true-false', 'short-answer', 'long-answer', 'mixed'],
      default: 'mcq',
    },
    /** "question-paper" keeps AI answers hidden from students until the teacher publishes results */
    paperType: { type: String, enum: ['quiz', 'assessment', 'question-paper'], default: 'quiz' },
    totalMarks: { type: Number, default: 10 },
    durationMinutes: { type: Number, default: 15 },
    questions: [questionSchema],
    instructions: { type: String, default: '' },
    aiGenerated: { type: Boolean, default: true },
    aiProvider: { type: String, default: '' },
    aiModel: { type: String, default: '' },
    generationPrompt: { type: String, default: '' },
    availableFrom: { type: Date, default: Date.now },
    dueDate: { type: Date, default: null },
    status: { type: String, enum: ['draft', 'published', 'closed'], default: 'published', index: true },
    showAnswers: { type: Boolean, default: false },
    maxAttempts: { type: Number, default: 1 },
    stats: {
      attemptCount: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 },
      highestScore: { type: Number, default: 0 },
      lowestScore: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = defineModel('Quiz', quizSchema);

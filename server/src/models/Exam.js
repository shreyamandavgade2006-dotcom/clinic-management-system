'use strict';

const mongoose = require('../lib/modelFactory').mongoose;
const { defineModel } = require('../lib/modelFactory');

const examSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
    className: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['unit-test', 'mid-term', 'insem', 'endsem', 'practical', 'oral', 'viva'],
      default: 'unit-test',
    },
    date: { type: Date, required: true, index: true },
    startTime: { type: String, default: '10:00' },
    durationMinutes: { type: Number, default: 90 },
    room: { type: String, default: '' },
    totalMarks: { type: Number, default: 50 },
    passingMarks: { type: Number, default: 20 },
    syllabus: [{ type: String }],
    instructions: { type: String, default: '' },
    status: { type: String, enum: ['scheduled', 'ongoing', 'completed', 'cancelled'], default: 'scheduled', index: true },
  },
  { timestamps: true }
);

module.exports = defineModel('Exam', examSchema);

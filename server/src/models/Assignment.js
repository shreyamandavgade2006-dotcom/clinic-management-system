'use strict';

const mongoose = require('../lib/modelFactory').mongoose;
const { defineModel } = require('../lib/modelFactory');

const assignmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    className: { type: String, required: true, index: true },
    unit: { type: String, default: '' },
    topic: { type: String, default: '' },
    type: {
      type: String,
      enum: ['assignment', 'homework', 'lab', 'project', 'presentation', 'case-study'],
      default: 'assignment',
    },
    /** AI generated question paper / rubric attached to the assignment (optional) */
    questions: [
      {
        questionText: { type: String, default: '' },
        type: { type: String, default: 'short' },
        marks: { type: Number, default: 5 },
        expectedAnswer: { type: String, default: '' },
        topic: { type: String, default: '' },
      },
    ],
    attachments: [{ name: { type: String, default: '' }, url: { type: String, default: '' } }],
    totalMarks: { type: Number, default: 20 },
    dueDate: { type: Date, required: true, index: true },
    publishedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['draft', 'published', 'closed'], default: 'published', index: true },
    allowLateSubmission: { type: Boolean, default: false },
    aiGenerated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = defineModel('Assignment', assignmentSchema);

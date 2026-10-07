'use strict';

const mongoose = require('../lib/modelFactory').mongoose;
const { defineModel } = require('../lib/modelFactory');

const submissionSchema = new mongoose.Schema(
  {
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    className: { type: String, required: true, index: true },
    submittedAt: { type: Date, default: Date.now },
    content: { type: String, default: '' },
    attachmentUrl: { type: String, default: '' },
    status: {
      type: String,
      enum: ['submitted', 'late', 'graded', 'resubmit', 'pending'],
      default: 'submitted',
      index: true,
    },
    marksObtained: { type: Number, default: null },
    feedback: { type: String, default: '' },
    gradedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });

module.exports = defineModel('Submission', submissionSchema);

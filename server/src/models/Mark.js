'use strict';

const mongoose = require('../lib/modelFactory').mongoose;
const { defineModel } = require('../lib/modelFactory');

const markSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
    className: { type: String, required: true, index: true },
    semester: { type: Number, default: 5 },
    examType: {
      type: String,
      enum: ['unit-test', 'mid-term', 'insem', 'endsem', 'practical', 'oral', 'assignment', 'internal'],
      default: 'unit-test',
      index: true,
    },
    title: { type: String, default: '' },
    marksObtained: { type: Number, required: true, min: 0 },
    maxMarks: { type: Number, required: true, min: 1 },
    weightage: { type: Number, default: 100 }, // contribution to the subject total, in %
    grade: { type: String, default: '' },
    examDate: { type: Date, default: Date.now },
    remarks: { type: String, default: '' },
  },
  { timestamps: true }
);

markSchema.index({ student: 1, subject: 1, examType: 1, title: 1 }, { unique: true });

/** Grade as per a 10-point scale (used by the UI and the result sheet). */
function computeGrade(obtained, max) {
  const pct = max > 0 ? (obtained / max) * 100 : 0;
  if (pct >= 90) return { grade: 'O', points: 10 };
  if (pct >= 80) return { grade: 'A+', points: 9 };
  if (pct >= 70) return { grade: 'A', points: 8 };
  if (pct >= 60) return { grade: 'B+', points: 7 };
  if (pct >= 50) return { grade: 'B', points: 6 };
  if (pct >= 45) return { grade: 'C', points: 5 };
  if (pct >= 40) return { grade: 'P', points: 4 };
  return { grade: 'F', points: 0 };
}

const Mark = defineModel('Mark', markSchema);
Mark.computeGrade = computeGrade;

module.exports = Mark;
module.exports.computeGrade = computeGrade;

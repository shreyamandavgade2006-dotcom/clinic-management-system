'use strict';

const mongoose = require('../lib/modelFactory').mongoose;
const { defineModel } = require('../lib/modelFactory');

const subjectSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    shortName: { type: String, default: '' },
    department: { type: String, default: 'Computer Engineering' },
    semester: { type: Number, default: 5 },
    credits: { type: Number, default: 4 },
    className: { type: String, required: true, index: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null, index: true },
    // Syllabus units — used as the selectable "Unit / Chapter" list in the AI generator
    units: [
      {
        unitNo: { type: Number, default: 1 },
        title: { type: String, default: '' },
        topics: [{ type: String }],
      },
    ],
    color: { type: String, default: '#6366f1' },
    icon: { type: String, default: 'BookOpen' },
    maxMarks: { type: Number, default: 100 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = defineModel('Subject', subjectSchema);

'use strict';

const mongoose = require('../lib/modelFactory').mongoose;
const { defineModel } = require('../lib/modelFactory');

const teacherSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    employeeId: { type: String, required: true, unique: true, trim: true },
    designation: { type: String, default: 'Assistant Professor' },
    department: { type: String, default: 'Computer Engineering' },
    qualification: { type: String, default: 'M.E.' },
    experienceYears: { type: Number, default: 0 },
    phone: { type: String, default: '' },
    cabin: { type: String, default: '' },
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    classes: [{ type: String }],
    about: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = defineModel('Teacher', teacherSchema);

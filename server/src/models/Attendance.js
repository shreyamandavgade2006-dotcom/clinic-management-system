'use strict';

const mongoose = require('../lib/modelFactory').mongoose;
const { defineModel } = require('../lib/modelFactory');

const attendanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
    className: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    status: { type: String, enum: ['present', 'absent', 'late', 'excused'], default: 'present', index: true },
    period: { type: Number, default: 1 },
    method: { type: String, enum: ['manual', 'qr', 'biometric'], default: 'manual' },
    remarks: { type: String, default: '' },
  },
  { timestamps: true }
);

// one record per student / subject / date / period
attendanceSchema.index({ student: 1, subject: 1, date: 1, period: 1 }, { unique: true });

module.exports = defineModel('Attendance', attendanceSchema);

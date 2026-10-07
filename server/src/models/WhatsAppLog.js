'use strict';

const mongoose = require('../lib/modelFactory').mongoose;
const { defineModel } = require('../lib/modelFactory');

const whatsappLogSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null, index: true },
    studentName: { type: String, default: '' },
    className: { type: String, default: '' },
    to: { type: String, required: true }, // E.164 number, e.g. +919000000001
    toName: { type: String, default: '' },
    body: { type: String, required: true },
    templateName: { type: String, default: 'attendance_alert' },
    category: {
      type: String,
      enum: ['attendance-alert', 'assignment-reminder', 'exam-reminder', 'announcement', 'result', 'test'],
      default: 'attendance-alert',
      index: true,
    },
    provider: { type: String, enum: ['console', 'twilio', 'meta'], default: 'console' },
    status: { type: String, enum: ['queued', 'sent', 'failed', 'simulated'], default: 'queued', index: true },
    error: { type: String, default: '' },
    providerMessageId: { type: String, default: '' },
    attendancePercentAtAlert: { type: Number, default: null },
    sentAt: { type: Date, default: null },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = defineModel('WhatsAppLog', whatsappLogSchema);

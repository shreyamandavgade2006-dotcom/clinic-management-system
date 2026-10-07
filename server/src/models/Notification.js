'use strict';

const mongoose = require('../lib/modelFactory').mongoose;
const { defineModel } = require('../lib/modelFactory');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    type: {
      type: String,
      enum: [
        'assignment',
        'exam',
        'attendance',
        'announcement',
        'result',
        'quiz',
        'marks',
        'whatsapp',
        'system',
      ],
      default: 'system',
      index: true,
    },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
    link: { type: String, default: '' },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    meta: { type: Object, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = defineModel('Notification', notificationSchema);

'use strict';

const mongoose = require('../lib/modelFactory').mongoose;
const { defineModel } = require('../lib/modelFactory');

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
    authorName: { type: String, default: '' },
    className: { type: String, default: 'all', index: true }, // "all" or a specific class
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    audience: { type: String, enum: ['all', 'students', 'teachers'], default: 'students' },
    category: { type: String, enum: ['general', 'academic', 'exam', 'event', 'holiday', 'urgent'], default: 'general' },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
    pinned: { type: Boolean, default: false },
    attachments: [{ name: { type: String, default: '' }, url: { type: String, default: '' } }],
    publishAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    status: { type: String, enum: ['published', 'draft', 'archived'], default: 'published', index: true },
    sendNotification: { type: Boolean, default: true },
    sendWhatsApp: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = defineModel('Announcement', announcementSchema);

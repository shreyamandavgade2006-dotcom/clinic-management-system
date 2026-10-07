'use strict';

const Notification = require('../models/Notification');
const Student = require('../models/Student');
const User = require('../models/User');

/**
 * Creates a single notification.
 */
async function notify({ user, title, message = '', type = 'system', priority = 'normal', link = '', meta = {}, createdBy = null }) {
  if (!user) return null;
  return Notification.create({ user, title, message, type, priority, link, meta, createdBy });
}

/** Creates the same notification for many users at once. */
async function notifyMany(userIds, payload) {
  const unique = [...new Set((userIds || []).map(String))].filter(Boolean);
  if (unique.length === 0) return [];
  return Promise.all(unique.map((user) => notify({ ...payload, user })));
}

/** Notify every active student of one class (or all classes when omitted). */
async function notifyClass(className, payload, { studentsOnly = true } = {}) {
  const filter = { status: 'active' };
  if (className && className !== 'all') filter.className = className;
  const students = await Student.find(filter).lean();
  if (studentsOnly) {
    return notifyMany(students.map((s) => s.user), payload);
  }
  const teachers = await User.find({ role: 'teacher', isActive: true }).lean();
  return notifyMany([...students.map((s) => s.user), ...teachers.map((t) => t._id)], payload);
}

const unreadCount = (userId) => Notification.countDocuments({ user: userId, read: false });

module.exports = { notify, notifyMany, notifyClass, unreadCount };

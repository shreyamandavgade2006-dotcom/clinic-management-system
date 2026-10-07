'use strict';

const { ApiError, ok, created } = require('../lib/http');
const Notification = require('../models/Notification');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const { notifyMany } = require('../services/notificationService');

/** GET /api/notifications */
const listNotifications = async (req, res) => {
  const { type, unreadOnly, limit = 50 } = req.query;
  const filter = { user: req.user._id };
  if (type && type !== 'all') filter.type = type;
  if (unreadOnly === 'true') filter.read = false;

  const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(Math.min(200, Number(limit))).lean();
  const unread = await Notification.countDocuments({ user: req.user._id, read: false });

  const byType = notifications.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});

  return ok(res, notifications, { unread, total: notifications.length, byType });
};

/** PUT /api/notifications/:id/read */
const markRead = async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) throw ApiError.notFound('Notification not found.');
  if (String(notification.user) !== String(req.user._id)) throw ApiError.forbidden('Not your notification.');

  const updated = await Notification.findByIdAndUpdate(
    notification._id,
    { $set: { read: true, readAt: new Date() } },
    { new: true }
  );
  return ok(res, updated);
};

/** PUT /api/notifications/read-all */
const markAllRead = async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true, readAt: new Date() } });
  return ok(res, { message: 'All notifications marked as read.' });
};

/** DELETE /api/notifications/:id */
const deleteNotification = async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) throw ApiError.notFound('Notification not found.');
  if (String(notification.user) !== String(req.user._id)) throw ApiError.forbidden('Not your notification.');
  await Notification.findByIdAndDelete(notification._id);
  return ok(res, { message: 'Notification deleted.' });
};

/** DELETE /api/notifications — clear all read notifications */
const clearRead = async (req, res) => {
  const result = await Notification.deleteMany({ user: req.user._id, read: true });
  return ok(res, { removed: result.deletedCount || 0 });
};

/** POST /api/notifications/broadcast — teacher sends an in-app message */
const broadcast = async (req, res) => {
  const { title, message, className, audience = 'students', type = 'announcement', priority = 'normal', link = '' } = req.body;
  if (!title) throw ApiError.badRequest('A title is required.');

  let userIds = [];

  if (audience === 'students' || audience === 'all') {
    const filter = { status: 'active' };
    if (className && className !== 'all') filter.className = className;
    const students = await Student.find(filter).lean();
    userIds = userIds.concat(students.map((s) => s.user));
  }

  if (audience === 'teachers' || audience === 'all') {
    const teachers = await Teacher.find({}).lean();
    userIds = userIds.concat(teachers.map((t) => t.user));
  }

  const created = await notifyMany(userIds, { title, message, type, priority, link });
  return created.length ? require('../lib/http').created(res, { recipients: created.length }) : ok(res, { recipients: 0 });
};

module.exports = { listNotifications, markRead, markAllRead, deleteNotification, clearRead, broadcast };

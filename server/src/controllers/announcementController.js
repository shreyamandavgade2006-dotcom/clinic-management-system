'use strict';

const { ApiError, ok, created } = require('../lib/http');
const Announcement = require('../models/Announcement');
const Student = require('../models/Student');
const { notifyClass, notify } = require('../services/notificationService');
const { sendWhatsApp } = require('../services/whatsappService');

const POPULATE = [{ path: 'author', select: 'employeeId designation', populate: { path: 'user', select: 'name' } }];

/** GET /api/announcements */
const listAnnouncements = async (req, res) => {
  const { className, category, limit = 50 } = req.query;
  const filter = { status: 'published' };

  if (req.user.role === 'student') {
    filter.className = { $in: ['all', req.student.className] };
    filter.audience = { $in: ['all', 'students'] };
  } else {
    if (className && className !== 'all') filter.className = { $in: ['all', className] };
    else if (req.teacher?.classes?.length && req.query.mine === 'true') filter.className = { $in: ['all', ...req.teacher.classes] };
    if (req.query.includeDrafts === 'true') delete filter.status;
  }
  if (category) filter.category = category;

  const announcements = await Announcement.find(filter)
    .populate(POPULATE)
    .sort({ pinned: -1, publishAt: -1 })
    .limit(Math.min(200, Number(limit)))
    .lean();

  // hide expired announcements
  const now = Date.now();
  const visible = announcements.filter((a) => !a.expiresAt || new Date(a.expiresAt).getTime() > now);

  return ok(res, visible, { total: visible.length });
};

/** GET /api/announcements/:id */
const getAnnouncement = async (req, res) => {
  const announcement = await Announcement.findById(req.params.id).populate(POPULATE);
  if (!announcement) throw ApiError.notFound('Announcement not found.');
  return ok(res, announcement);
};

/** POST /api/announcements */
const createAnnouncement = async (req, res) => {
  const {
    title,
    content,
    className = 'all',
    category = 'general',
    priority = 'normal',
    audience = 'students',
    pinned = false,
    expiresAt = null,
    sendNotification = true,
    sendWhatsApp: alsoWhatsApp = false,
    status = 'published',
    attachments = [],
  } = req.body;

  const announcement = await Announcement.create({
    title,
    content,
    author: req.teacher?._id || null,
    authorName: req.user.name,
    className,
    audience,
    category,
    priority,
    pinned,
    attachments,
    status,
    publishAt: new Date(),
    expiresAt: expiresAt || null,
    sendNotification,
    sendWhatsApp: alsoWhatsApp,
  });

  if (status === 'published' && sendNotification) {
    await notifyClass(
      className,
      {
        title: `${category === 'exam' ? '📅' : category === 'urgent' ? '🚨' : '📢'} ${title}`,
        message: content.length > 160 ? `${content.slice(0, 157)}...` : content,
        type: 'announcement',
        priority,
        link: `/student/announcements`,
        meta: { announcementId: String(announcement._id) },
      },
      { studentsOnly: audience !== 'teachers' }
    );
  }

  let whatsappResult = null;
  if (status === 'published' && alsoWhatsApp) {
    const filter = { status: 'active' };
    if (className !== 'all') filter.className = className;
    const students = await Student.find(filter).lean();
    const results = [];

    for (const student of students) {
      if (!student.guardian?.phone || student.guardian?.whatsappOptIn === false) continue;
      const result = await sendWhatsApp({
        to: student.guardian.phone,
        body: `📢 *${title}*\n\n${content}\n\n— ${req.user.name}`,
        toName: student.guardian?.name || '',
        student: student._id,
        studentName: student.rollNo,
        className: student.className,
        category: 'announcement',
        templateName: 'announcement',
      });
      results.push(result.success);
    }
    whatsappResult = { targeted: students.length, sent: results.filter(Boolean).length };
  }

  return created(res, { announcement: await Announcement.findById(announcement._id).populate(POPULATE), whatsappResult });
};

/** PUT /api/announcements/:id */
const updateAnnouncement = async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) throw ApiError.notFound('Announcement not found.');

  const editable = [
    'title',
    'content',
    'className',
    'category',
    'priority',
    'audience',
    'pinned',
    'attachments',
    'expiresAt',
    'status',
  ];
  const updates = {};
  editable.forEach((key) => {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  });

  const updated = await Announcement.findByIdAndUpdate(announcement._id, { $set: updates }, { new: true }).populate(POPULATE);
  return ok(res, updated);
};

/** DELETE /api/announcements/:id */
const deleteAnnouncement = async (req, res) => {
  const announcement = await Announcement.findByIdAndDelete(req.params.id);
  if (!announcement) throw ApiError.notFound('Announcement not found.');
  return ok(res, { message: 'Announcement deleted.' });
};

/** GET /api/announcements/stats/summary — teacher dashboard widget */
const announcementStats = async (_req, res) => {
  const [total, pinnedCount, urgent] = await Promise.all([
    Announcement.countDocuments({ status: 'published' }),
    Announcement.countDocuments({ pinned: true, status: 'published' }),
    Announcement.countDocuments({ priority: 'urgent', status: 'published' }),
  ]);
  const recent = await Announcement.find({ status: 'published' }).sort({ publishAt: -1 }).limit(5).lean();
  return ok(res, { total, pinned: pinnedCount, urgent, recent });
};

module.exports = { listAnnouncements, getAnnouncement, createAnnouncement, updateAnnouncement, deleteAnnouncement, announcementStats };

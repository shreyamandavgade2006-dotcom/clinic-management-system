'use strict';

const env = require('../config/env');
const { ApiError, ok } = require('../lib/http');
const WhatsAppLog = require('../models/WhatsAppLog');
const Student = require('../models/Student');
const { sendWhatsApp, sendTemplate, toE164 } = require('../services/whatsappService');
const { runAttendanceAlerts, findAttendanceDefaulters } = require('../services/attendanceAlertService');

/** GET /api/whatsapp/status */
const status = async (_req, res) => {
  const [sent, failed, simulated, total] = await Promise.all([
    WhatsAppLog.countDocuments({ status: 'sent' }),
    WhatsAppLog.countDocuments({ status: 'failed' }),
    WhatsAppLog.countDocuments({ status: 'simulated' }),
    WhatsAppLog.countDocuments(),
  ]);

  return ok(res, {
    provider: env.whatsappProvider,
    threshold: env.attendanceThreshold,
    configured: {
      twilio: Boolean(env.twilio.accountSid && env.twilio.authToken),
      meta: Boolean(env.meta.phoneNumberId && env.meta.accessToken),
    },
    stats: { total, sent, failed, simulated },
    mode:
      env.whatsappProvider === 'console'
        ? 'Simulation — messages are logged to the API console and stored in the alert history. Add Twilio or Meta credentials in server/.env to send real WhatsApp messages.'
        : `Live sending through ${env.whatsappProvider}.`,
  });
};

/** GET /api/whatsapp/logs */
const logs = async (req, res) => {
  const { student, category, status: logStatus, limit = 100 } = req.query;
  const filter = {};
  if (student) filter.student = student;
  if (category) filter.category = category;
  if (logStatus) filter.status = logStatus;

  const entries = await WhatsAppLog.find(filter)
    .populate({ path: 'student', select: 'rollNo className', populate: { path: 'user', select: 'name' } })
    .sort({ createdAt: -1 })
    .limit(Math.min(500, Number(limit)))
    .lean();

  return ok(res, entries, { total: entries.length });
};

/** GET /api/whatsapp/defaulters — who would receive an alert right now */
const defaulters = async (req, res) => {
  const list = await findAttendanceDefaulters({
    className: req.query.className,
    threshold: req.query.threshold ? Number(req.query.threshold) : env.attendanceThreshold,
  });
  return ok(res, list, { count: list.length, threshold: req.query.threshold || env.attendanceThreshold });
};

/**
 * POST /api/whatsapp/attendance-alerts
 * Runs the "below 75%" alert campaign. Supports dryRun to preview the messages first.
 */
const triggerAttendanceAlerts = async (req, res) => {
  const result = await runAttendanceAlerts({
    className: req.body.className,
    threshold: req.body.threshold ? Number(req.body.threshold) : env.attendanceThreshold,
    dryRun: Boolean(req.body.dryRun),
    force: Boolean(req.body.force),
    cooldownHours: req.body.cooldownHours ? Number(req.body.cooldownHours) : undefined,
    teacherName: req.user.name,
  });
  return ok(res, result);
};

/** POST /api/whatsapp/send — manual/custom message to a guardian */
const sendManual = async (req, res) => {
  const { student: studentId, to, body, template = 'custom', templateData = {} } = req.body;

  if (!body && template === 'custom') throw ApiError.badRequest('Provide a message body.');

  let student = null;
  let phone = to;

  if (studentId) {
    student = await Student.findById(studentId).populate('user', 'name');
    if (!student) throw ApiError.notFound('Student not found.');
    phone = phone || student.guardian?.phone;
  }

  if (!phone) throw ApiError.badRequest('No WhatsApp number available for this recipient.');

  const result =
    template !== 'custom'
      ? await sendTemplate(template, {
          to: phone,
          toName: student?.guardian?.name || '',
          studentName: student?.user?.name || '',
          className: student?.className || '',
          ...templateData,
        })
      : await sendWhatsApp({
          to: phone,
          body,
          toName: student?.guardian?.name || '',
          student: student?._id || null,
          studentName: student?.user?.name || '',
          className: student?.className || '',
          category: 'announcement',
          templateName: 'custom',
        });

  return ok(res, { ...result, normalizedNumber: toE164(phone) });
};

/** POST /api/whatsapp/test — verify credentials */
const sendTest = async (req, res) => {
  const target = req.body.to || req.user.phone;
  if (!target) throw ApiError.badRequest('Provide a WhatsApp number to send the test message to.');

  const result = await sendWhatsApp({
    to: target,
    body: `✅ *Smart Student Management System*\n\nHi ${req.user.name}, your WhatsApp integration is working. Attendance alerts will be delivered to guardians on this channel.`,
    toName: req.user.name,
    category: 'test',
    templateName: 'test',
  });

  return ok(res, { ...result, provider: env.whatsappProvider, to: toE164(target) });
};

module.exports = { status, logs, defaulters, triggerAttendanceAlerts, sendManual, sendTest };

'use strict';

const env = require('../config/env');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const WhatsAppLog = require('../models/WhatsAppLog');
const { summariseAttendance, groupBy } = require('./analyticsService');
const { sendWhatsApp } = require('./whatsappService');
const { notify } = require('./notificationService');

const DEFAULT_COOLDOWN_HOURS = 72;

/**
 * Builds the list of students whose attendance is below the threshold.
 * @returns {Promise<Array>} defaulters with their overall + subject-wise percentages
 */
async function findAttendanceDefaulters({ className, subjectId, threshold = env.attendanceThreshold } = {}) {
  const studentFilter = { status: 'active' };
  if (className && className !== 'all') studentFilter.className = className;

  const students = await Student.find(studentFilter).populate('user', 'name email').lean();
  if (students.length === 0) return [];

  const attendanceFilter = {};
  if (className && className !== 'all') attendanceFilter.className = className;
  if (subjectId) attendanceFilter.subject = subjectId;

  const [records, subjects] = await Promise.all([
    Attendance.find(attendanceFilter).lean(),
    Subject.find(className && className !== 'all' ? { className } : {}).lean(),
  ]);
  const subjectMap = new Map(subjects.map((s) => [String(s._id), s]));
  const byStudent = groupBy(records, (r) => String(r.student));

  const defaulters = [];

  for (const student of students) {
    const list = byStudent[String(student._id)] || [];
    if (list.length === 0) continue;

    const summary = summariseAttendance(list);
    if (summary.percentage >= threshold) continue;

    const subjectWise = Object.entries(groupBy(list, (r) => String(r.subject)))
      .map(([key, subjectRecords]) => {
        const subject = subjectMap.get(key);
        const subjectSummary = summariseAttendance(subjectRecords);
        return {
          subjectId: key,
          name: subject?.name || 'Subject',
          code: subject?.code || '',
          percentage: subjectSummary.percentage,
          attended: subjectSummary.attended,
          total: subjectSummary.totalSessions,
        };
      })
      .sort((a, b) => a.percentage - b.percentage);

    // biggest risk subject = lowest percentage
    const worst = subjectWise[0];

    defaulters.push({
      studentId: String(student._id),
      name: student.user?.name || student.rollNo,
      rollNo: student.rollNo,
      className: student.className,
      guardianName: student.guardian?.name || '',
      guardianPhone: student.guardian?.phone || '',
      whatsappOptIn: student.guardian?.whatsappOptIn !== false,
      user: student.user?._id ? String(student.user._id) : null,
      attendance: summary,
      percentage: summary.percentage,
      shortfall: Math.max(0, Math.round((threshold - summary.percentage) * 100) / 100),
      sessionsNeeded: (() => {
        // how many consecutive present sessions are needed to reach the threshold
        let needed = 0;
        let attended = summary.attended;
        let total = summary.totalSessions;
        while (total > 0 && (attended / total) * 100 < threshold && needed < 200) {
          attended += 1;
          total += 1;
          needed += 1;
        }
        return needed;
      })(),
      subjectWise,
      worstSubject: worst,
      riskLevel: summary.percentage < threshold - 15 ? 'critical' : summary.percentage < threshold - 5 ? 'high' : 'moderate',
    });
  }

  return defaulters.sort((a, b) => a.percentage - b.percentage);
}

/** Was an alert already sent to this student recently? (cooldown guard) */
async function wasAlertedRecently(studentId, cooldownHours) {
  const since = new Date(Date.now() - cooldownHours * 3600 * 1000);
  const existing = await WhatsAppLog.findOne({
    student: studentId,
    category: 'attendance-alert',
    createdAt: { $gte: since },
    status: { $in: ['sent', 'simulated', 'queued'] },
  });
  return Boolean(existing);
}

/**
 * Sends WhatsApp attendance alerts to the guardians of every student below the threshold.
 *
 * @param {object} options
 * @param {string} [options.className]   limit to one class ("all" or omitted = every class)
 * @param {number} [options.threshold]   attendance threshold in % (default 75)
 * @param {boolean} [options.dryRun]     compute the list but do not send
 * @param {boolean} [options.force]      ignore the cooldown guard
 * @param {number} [options.cooldownHours]
 * @param {string} [options.collegeName]
 * @param {string} [options.teacherName]
 */
async function runAttendanceAlerts({
  className,
  threshold = env.attendanceThreshold,
  dryRun = false,
  force = false,
  cooldownHours = DEFAULT_COOLDOWN_HOURS,
  collegeName = 'Smart Student Management System',
  teacherName = '',
} = {}) {
  const defaulters = await findAttendanceDefaulters({ className, threshold });

  const results = {
    threshold,
    className: className || 'all',
    provider: env.whatsappProvider,
    dryRun,
    scanned: 0,
    sent: 0,
    skippedNoPhone: 0,
    skippedOptOut: 0,
    skippedCooldown: 0,
    failed: 0,
    alerts: [],
  };

  results.scanned = defaulters.length;

  for (const defaulter of defaulters) {
    const record = {
      studentId: defaulter.studentId,
      name: defaulter.name,
      rollNo: defaulter.rollNo,
      className: defaulter.className,
      percentage: defaulter.percentage,
      phone: defaulter.guardianPhone,
      guardian: defaulter.guardianName,
      status: 'pending',
    };

    if (!defaulter.guardianPhone) {
      record.status = 'skipped';
      record.reason = 'No guardian WhatsApp number saved';
      results.skippedNoPhone += 1;
      results.alerts.push(record);
      continue;
    }

    if (!defaulter.whatsappOptIn) {
      record.status = 'skipped';
      record.reason = 'Guardian opted out of WhatsApp alerts';
      results.skippedOptOut += 1;
      results.alerts.push(record);
      continue;
    }

    if (!force && !dryRun && (await wasAlertedRecently(defaulter.studentId, cooldownHours))) {
      record.status = 'skipped';
      record.reason = `Alert already sent in the last ${cooldownHours}h`;
      results.skippedCooldown += 1;
      results.alerts.push(record);
      continue;
    }

    const body = [
      `⚠️ *${collegeName} — Attendance Alert*`,
      '',
      'Dear Parent/Guardian,',
      '',
      `This is to inform you that *${defaulter.name}* (Roll No ${defaulter.rollNo}, Class ${defaulter.className}) has an overall attendance of only *${defaulter.percentage}%*, which is below the mandatory *${threshold}%*.`,
      '',
      `📊 Sessions attended: ${defaulter.attendance.attended}/${defaulter.attendance.totalSessions}`,
      defaulter.worstSubject
        ? `📉 Lowest subject: ${defaulter.worstSubject.name} (${defaulter.worstSubject.percentage}%)`
        : '',
      '',
      `To become eligible, ${defaulter.name.split(' ')[0]} must attend the next *${defaulter.sessionsNeeded}* sessions without a break.`,
      'Please ensure regular attendance so that your ward does not lose exam eligibility.',
      '',
      `— ${teacherName || 'Class Teacher'}`,
    ]
      .filter(Boolean)
      .join('\n');

    if (dryRun) {
      record.status = 'preview';
      record.preview = body;
      results.alerts.push(record);
      continue;
    }

    const sendResult = await sendWhatsApp({
      to: defaulter.guardianPhone,
      body,
      toName: defaulter.guardianName,
      student: defaulter.studentId,
      studentName: defaulter.name,
      className: defaulter.className,
      category: 'attendance-alert',
      templateName: 'attendance_alert',
      attendancePercentAtAlert: defaulter.percentage,
      meta: { rollNo: defaulter.rollNo, threshold, worstSubject: defaulter.worstSubject?.name || '' },
    });

    if (sendResult.success) {
      results.sent += 1;
      record.status = sendResult.status === 'simulated' ? 'simulated' : 'sent';
      record.messageId = sendResult.messageId;
    } else {
      results.failed += 1;
      record.status = 'failed';
      record.reason = sendResult.error;
    }

    // In-app notification for the student as well
    if (defaulter.user) {
      await notify({
        user: defaulter.user,
        title: `Attendance alert sent to your guardian (${defaulter.percentage}%)`,
        message: `Your attendance is below the required ${threshold}%. Attend the next ${defaulter.sessionsNeeded} sessions to become eligible.`,
        type: 'attendance',
        priority: defaulter.riskLevel === 'critical' ? 'urgent' : 'high',
        link: '/student/attendance',
        meta: { percentage: defaulter.percentage, threshold },
      });
    }

    results.alerts.push(record);
  }

  return results;
}

module.exports = { findAttendanceDefaulters, runAttendanceAlerts, wasAlertedRecently, DEFAULT_COOLDOWN_HOURS };

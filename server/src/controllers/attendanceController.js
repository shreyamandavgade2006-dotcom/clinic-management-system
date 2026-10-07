'use strict';

const env = require('../config/env');
const { ApiError, ok, created } = require('../lib/http');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const { notify, notifyMany } = require('../services/notificationService');
const { sendWhatsApp, templates } = require('../services/whatsappService');
const {
  summariseAttendance,
  attendanceSummaryForStudent,
  attendanceSummaryForClass,
  groupBy,
} = require('../services/analyticsService');
const { findAttendanceDefaulters } = require('../services/attendanceAlertService');

const toDateKey = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

/**
 * POST /api/attendance/mark
 * Marks attendance for a whole class + subject + period in one call.
 * Body: { subject, date, period, className, records: [{ student, status, remarks }] }
 */
const markAttendance = async (req, res) => {
  const { subject: subjectId, date = new Date(), period = 1, className, records = [], notifyStudents = false } = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    throw ApiError.badRequest('Provide at least one student record.');
  }

  const subject = await Subject.findById(subjectId).lean();
  if (!subject) throw ApiError.notFound('Subject not found.');

  const targetClass = className || subject.className;
  const attendanceDate = toDateKey(date);
  const saved = [];
  const updatedIds = [];

  for (const record of records) {
    const status = ['present', 'absent', 'late', 'excused'].includes(record.status) ? record.status : 'present';
    const existing = await Attendance.findOne({
      student: record.student,
      subject: subject._id,
      date: attendanceDate,
      period: Number(period),
    });

    if (existing) {
      const updated = await Attendance.findByIdAndUpdate(
        existing._id,
        { $set: { status, remarks: record.remarks || '', method: req.body.method || 'manual' } },
        { new: true }
      );
      updatedIds.push(String(updated._id));
      saved.push(updated);
    } else {
      const doc = await Attendance.create({
        student: record.student,
        subject: subject._id,
        teacher: req.teacher?._id || null,
        className: targetClass,
        date: attendanceDate,
        period: Number(period),
        status,
        remarks: record.remarks || '',
        method: req.body.method || 'manual',
      });
      saved.push(doc);
    }
  }

  const summary = summariseAttendance(saved);

  // optional immediate alert to the guardians of everyone absent today
  let alerts = null;
  if (req.body.sendWhatsAppAlerts) {
    alerts = await alertGuardians({
      studentIds: saved.filter((s) => s.status === 'absent').map((s) => s.student),
      subject,
      teacher: req.teacher,
    });
  }

  if (notifyStudents) {
    const absent = saved.filter((s) => s.status === 'absent');
    if (absent.length) {
      const students = await Student.find({ _id: { $in: absent.map((a) => a.student) } }).lean();
      await notifyMany(
        students.map((s) => s.user),
        {
          title: `Marked absent in ${subject.shortName || subject.name}`,
          message: `You were marked absent on ${attendanceDate.toLocaleDateString('en-IN')} (period ${period}).`,
          type: 'attendance',
          link: '/student/attendance',
          priority: 'high',
        }
      );
    }
  }

  return created(res, { saved: saved.length, summary, alerts, date: attendanceDate, subject: subject.name });
};

/** Helper: send WhatsApp alerts for a set of students in one subject */
async function alertGuardians({ studentIds, subject, teacher }) {
  const students = await Student.find({ _id: { $in: studentIds } }).populate('user', 'name').lean();
  const results = [];

  for (const student of students) {
    const phone = student.guardian?.phone;
    if (!phone || student.guardian?.whatsappOptIn === false) {
      results.push({ student: student.rollNo, status: 'skipped', reason: 'No WhatsApp number' });
      continue;
    }

    const body = [
      `⚠️ Attendance alert — ${subject.name}`,
      '',
      `Dear ${student.guardian?.name || 'Parent/Guardian'},`,
      `*${student.user?.name || student.rollNo}* (${student.rollNo}) was marked *ABSENT* in ${subject.name} on ${new Date().toLocaleDateString('en-IN')}.`,
      '',
      `— ${teacher ? `${teacher.designation} ${teacher.employeeId}` : 'Class Teacher'}`,
    ].join('\n');

    const result = await sendWhatsApp({
      to: phone,
      body,
      toName: student.guardian?.name || '',
      student: student._id,
      studentName: student.user?.name || student.rollNo,
      className: student.className,
      category: 'attendance-alert',
      templateName: 'attendance_alert',
      meta: { subject: subject.name, trigger: 'absent-marked' },
    });
    results.push({ student: student.rollNo, status: result.success ? 'sent' : 'failed', error: result.error });
  }

  return results;
}

/** GET /api/attendance — raw records with filters */
const listAttendance = async (req, res) => {
  const { student, subject, className, status, from, to, limit = 100 } = req.query;
  const filter = {};
  if (student) filter.student = student;
  if (subject) filter.subject = subject;
  if (status) filter.status = status;

  if (req.user.role === 'student') {
    filter.student = req.student._id;
  } else if (className) {
    filter.className = className;
  } else if (req.teacher?.classes?.length) {
    filter.className = { $in: req.teacher.classes };
  }
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = toDateKey(from);
    if (to) filter.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }

  const records = await Attendance.find(filter)
    .populate({ path: 'subject', select: 'name code shortName color' })
    .populate({ path: 'student', select: 'rollNo className user', populate: { path: 'user', select: 'name' } })
    .sort({ date: -1, period: -1 })
    .limit(Math.min(1000, Number(limit)))
    .lean();

  return ok(res, records);
};

/** GET /api/attendance/student/:id — summary + history */
const studentAttendance = async (req, res) => {
  const studentId = req.user.role === 'student' ? req.student._id : req.params.id;
  const student = await Student.findById(studentId).populate('user', 'name email');
  if (!student) throw ApiError.notFound('Student not found.');

  const summary = await attendanceSummaryForStudent(studentId, { from: req.query.from, to: req.query.to });
  return ok(res, { student, ...summary });
};

/** GET /api/attendance/class/:className — board + defaulters */
const classAttendance = async (req, res) => {
  const { className } = req.params;
  const summary = await attendanceSummaryForClass(className, {
    subjectId: req.query.subject,
    threshold: req.query.threshold ? Number(req.query.threshold) : env.attendanceThreshold,
  });
  return ok(res, summary);
};

/**
 * GET /api/attendance/defaulters
 * Students below the attendance threshold, enriched with the number of consecutive
 * sessions needed to recover and a risk level (used by the WhatsApp alert panel too).
 */
const defaulters = async (req, res) => {
  const className = req.query.className || (req.teacher?.classes?.length === 1 ? req.teacher.classes[0] : undefined);
  const threshold = req.query.threshold ? Number(req.query.threshold) : env.attendanceThreshold;
  const subjectFilter = req.query.subject;

  if (!className && req.teacher?.classes?.length) {
    // scan every class the teacher owns and merge the results
    const all = await Promise.all(
      req.teacher.classes.map((cls) => findAttendanceDefaulters({ className: cls, subjectId: subjectFilter, threshold }))
    );
    const merged = all.flat().sort((a, b) => a.percentage - b.percentage);
    return ok(res, { threshold, defaulters: merged, classes: req.teacher.classes, className: 'all' });
  }

  const list = await findAttendanceDefaulters({ className, subjectId: subjectFilter, threshold });
  return ok(res, { threshold, defaulters: list, className: className || 'all' });
};

/** PUT /api/attendance/:id */
const updateAttendance = async (req, res) => {
  const record = await Attendance.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        ...(req.body.status ? { status: req.body.status } : {}),
        ...(req.body.remarks !== undefined ? { remarks: req.body.remarks } : {}),
        ...(req.body.period ? { period: Number(req.body.period) } : {}),
      },
    },
    { new: true }
  );
  if (!record) throw ApiError.notFound('Attendance record not found.');
  return ok(res, record);
};

/** DELETE /api/attendance/:id */
const deleteAttendance = async (req, res) => {
  const record = await Attendance.findByIdAndDelete(req.params.id);
  if (!record) throw ApiError.notFound('Attendance record not found.');
  return ok(res, { message: 'Attendance record deleted.' });
};

/** GET /api/attendance/session?subject=&date=&period= — used to pre-fill the marking sheet */
const sessionSheet = async (req, res) => {
  const { subject: subjectId, date = new Date(), period = 1 } = req.query;
  const subject = await Subject.findById(subjectId).populate('teacher').lean();
  if (!subject) throw ApiError.notFound('Subject not found.');

  const students = await Student.find({ className: subject.className, status: 'active' })
    .populate('user', 'name email avatar')
    .sort({ rollNo: 1 })
    .lean();

  const existing = await Attendance.find({
    subject: subject._id,
    date: toDateKey(date),
    period: Number(period),
  }).lean();
  const byStudent = new Map(existing.map((record) => [String(record.student), record]));

  return ok(res, {
    subject: { _id: subject._id, name: subject.name, code: subject.code, className: subject.className },
    date: toDateKey(date),
    period: Number(period),
    alreadyMarked: existing.length > 0,
    students: students.map((student) => ({
      _id: student._id,
      rollNo: student.rollNo,
      name: student.user?.name || student.rollNo,
      avatar: student.user?.avatar || '',
      guardianPhone: student.guardian?.phone || '',
      existing: byStudent.get(String(student._id))
        ? {
            _id: byStudent.get(String(student._id))._id,
            status: byStudent.get(String(student._id)).status,
            remarks: byStudent.get(String(student._id)).remarks,
          }
        : null,
    })),
  });
};

/** POST /api/attendance/:id/notify-guardian — manual single alert */
const notifyGuardian = async (req, res) => {
  const record = await Attendance.findById(req.params.id).populate('subject').populate({ path: 'student', populate: { path: 'user' } });
  if (!record) throw ApiError.notFound('Attendance record not found.');

  const student = await Student.findById(record.student?._id || record.student).populate('user', 'name email');
  if (!student) throw ApiError.notFound('Student not found.');

  const studentName = student.user?.name || student.rollNo;
  const summary = await attendanceSummaryForStudent(student._id);
  const body = templates.attendanceAlert({
    studentName,
    className: student.className,
    percentage: summary.overall.percentage,
    threshold: summary.overall.threshold,
    subject: record.subject?.name,
    attended: summary.overall.attended,
    total: summary.overall.totalSessions,
  });

  const result = await sendWhatsApp({
    to: student.guardian?.phone,
    body,
    student: student._id,
    studentName,
    className: student.className,
    toName: student.guardian?.name || '',
    category: 'attendance-alert',
    templateName: 'attendance_alert',
    attendancePercentAtAlert: summary.overall.percentage,
  });

  await notify({
    user: student.user,
    title: 'Attendance alert sent to your guardian',
    message: `A WhatsApp alert was sent to ${student.guardian?.name || 'your guardian'} about your attendance (${summary.overall.percentage}%).`,
    type: 'attendance',
    link: '/student/attendance',
  });

  return ok(res, result);
};

module.exports = {
  markAttendance,
  listAttendance,
  studentAttendance,
  classAttendance,
  defaulters,
  updateAttendance,
  deleteAttendance,
  sessionSheet,
  notifyGuardian,
  alertGuardians,
};

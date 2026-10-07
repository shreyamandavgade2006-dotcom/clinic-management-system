'use strict';

const { ApiError, ok } = require('../lib/http');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const Notification = require('../models/Notification');
const Announcement = require('../models/Announcement');
const WhatsAppLog = require('../models/WhatsAppLog');
const Attendance = require('../models/Attendance');
const Mark = require('../models/Mark');
const Assignment = require('../models/Assignment');
const Quiz = require('../models/Quiz');
const Exam = require('../models/Exam');
const {
  studentOverview,
  teacherOverview,
  performanceForClass,
  attendanceSummaryForClass,
} = require('../services/analyticsService');
const { providerStatus } = require('../services/aiService');
const { databaseStatus } = require('../config/db');
const env = require('../config/env');

/** GET /api/dashboard/student */
const studentDashboard = async (req, res) => {
  if (!req.student) throw ApiError.forbidden('Only students have a student dashboard.');

  const [overview, notifications, announcements] = await Promise.all([
    studentOverview(req.student),
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(6).lean(),
    Announcement.find({
      status: 'published',
      className: { $in: ['all', req.student.className] },
      audience: { $in: ['all', 'students'] },
    })
      .sort({ pinned: -1, publishAt: -1 })
      .limit(5)
      .lean(),
  ]);

  return ok(res, {
    student: {
      _id: req.student._id,
      rollNo: req.student.rollNo,
      className: req.student.className,
      semester: req.student.semester,
      department: req.student.department,
      name: req.user.name,
    },
    ...overview,
    notifications,
    unreadNotifications: notifications.filter((n) => !n.read).length,
    announcements,
  });
};

/** GET /api/dashboard/teacher */
const teacherDashboard = async (req, res) => {
  if (!req.teacher) throw ApiError.forbidden('Only teachers have a teacher dashboard.');

  const [overview, notifications, announcements, recentAlerts] = await Promise.all([
    teacherOverview(req.teacher),
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(6).lean(),
    Announcement.find({ status: 'published', className: { $in: ['all', ...(req.teacher.classes || [])] } })
      .sort({ publishAt: -1 })
      .limit(5)
      .lean(),
    WhatsAppLog.find({ category: 'attendance-alert' }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  return ok(res, {
    teacher: {
      _id: req.teacher._id,
      employeeId: req.teacher.employeeId,
      designation: req.teacher.designation,
      department: req.teacher.department,
      classes: req.teacher.classes || [],
      classCount: (req.teacher.classes || []).length,
      name: req.user.name,
    },
    ...overview,
    notifications,
    unreadNotifications: notifications.filter((n) => !n.read).length,
    announcements,
    recentAlerts,
    system: { ai: providerStatus(), whatsapp: env.whatsappProvider, database: databaseStatus() },
  });
};

/** GET /api/dashboard/analytics/:className — full analytics payload for the charts */
const classAnalytics = async (req, res) => {
  const { className } = req.params;
  const threshold = req.query.threshold ? Number(req.query.threshold) : env.attendanceThreshold;

  const [performance, attendance] = await Promise.all([
    performanceForClass(className),
    attendanceSummaryForClass(className, { threshold }),
  ]);

  return ok(res, {
    className,
    threshold,
    performance,
    attendance,
    highlights: {
      classAverage: performance.classAverage,
      attendanceAverage: attendance.classAverage,
      toppers: performance.toppers,
      needsAttention: performance.needsAttention,
      defaulters: attendance.defaulters,
      strongestSubject: performance.subjectAverages[0] || null,
      weakestSubject: performance.subjectAverages[performance.subjectAverages.length - 1] || null,
    },
  });
};

/** GET /api/dashboard/admin — institution-wide snapshot */
const adminOverview = async (req, res) => {
  const classes = await Student.distinct('className');

  const [students, teachers, subjects, attendanceTotal, marksTotal, assignments, quizzes, exams, aiQuizzes, alertsSent] =
    await Promise.all([
      Student.countDocuments({ status: 'active' }),
      Teacher.countDocuments({}),
      Subject.countDocuments({ isActive: true }),
      Attendance.countDocuments({}),
      Mark.countDocuments({}),
      Assignment.countDocuments({}),
      Quiz.countDocuments({}),
      Exam.countDocuments({}),
      Quiz.countDocuments({ aiGenerated: true }),
      WhatsAppLog.countDocuments({ category: 'attendance-alert', status: { $in: ['sent', 'simulated'] } }),
    ]);

  const classSummaries = await Promise.all(
    classes.map(async (className) => {
      const [attendance, performance] = await Promise.all([
        attendanceSummaryForClass(className),
        performanceForClass(className),
      ]);
      return {
        className,
        students: attendance.totalStudents,
        attendance: attendance.classAverage,
        performance: performance.classAverage,
        defaulters: attendance.defaulters.length,
      };
    })
  );

  return ok(res, {
    counts: { students, teachers, subjects, classes: classes.length, attendanceTotal, marksTotal, assignments, quizzes, exams, aiQuizzes, alertsSent },
    classSummaries: classSummaries.sort((a, b) => a.className.localeCompare(b.className)),
    system: { database: databaseStatus(), ai: providerStatus(), whatsapp: env.whatsappProvider },
  });
};

/** GET /api/dashboard/leaderboard/:className */
const leaderboard = async (req, res) => {
  const performance = await performanceForClass(req.params.className);
  return ok(res, {
    className: req.params.className,
    leaderboard: performance.students.slice(0, Number(req.query.limit) || 10),
    classAverage: performance.classAverage,
  });
};

module.exports = { studentDashboard, teacherDashboard, classAnalytics, adminOverview, leaderboard };

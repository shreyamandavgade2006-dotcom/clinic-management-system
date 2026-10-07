'use strict';

const { ApiError, ok, created } = require('../lib/http');
const Exam = require('../models/Exam');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const { notifyClass, notify } = require('../services/notificationService');

const POPULATE = [
  { path: 'subject', select: 'name code shortName color' },
  { path: 'teacher', select: 'employeeId designation', populate: { path: 'user', select: 'name' } },
];

/** GET /api/exams */
const listExams = async (req, res) => {
  const { className, subject, status, upcoming, from, to } = req.query;
  const filter = {};

  if (req.user.role === 'student') {
    filter.className = req.student.className;
  } else {
    if (className) filter.className = className;
    else if (req.teacher?.classes?.length) filter.className = { $in: req.teacher.classes };
    if (req.query.mine === 'true' && req.teacher) filter.teacher = req.teacher._id;
  }
  if (subject) filter.subject = subject;
  if (status) filter.status = status;
  if (upcoming === 'true') filter.date = { $gte: new Date() };
  if (from || to) {
    filter.date = filter.date || {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  const exams = await Exam.find(filter).populate(POPULATE).sort({ date: 1 }).lean();

  const enriched = exams.map((exam) => ({
    ...exam,
    daysLeft: Math.ceil((new Date(exam.date) - Date.now()) / 86400000),
    isPast: new Date(exam.date) < new Date(),
  }));

  return ok(res, enriched, {
    upcomingCount: enriched.filter((e) => e.daysLeft >= 0).length,
    nextExam: enriched.find((e) => e.daysLeft >= 0) || null,
  });
};

/** GET /api/exams/:id */
const getExam = async (req, res) => {
  const exam = await Exam.findById(req.params.id).populate(POPULATE);
  if (!exam) throw ApiError.notFound('Exam not found.');
  return ok(res, exam);
};

/** POST /api/exams */
const createExam = async (req, res) => {
  const { title, subject, className, date, type = 'unit-test', totalMarks = 50, syllabus = [], instructions = '' } = req.body;

  const subjectDoc = await Subject.findById(subject).lean();
  if (!subjectDoc) throw ApiError.notFound('Subject not found.');

  const exam = await Exam.create({
    title,
    subject: subjectDoc._id,
    teacher: req.teacher?._id || null,
    className: className || subjectDoc.className,
    type,
    date: new Date(date),
    startTime: req.body.startTime || '10:00',
    durationMinutes: Number(req.body.durationMinutes) || 90,
    room: req.body.room || '',
    totalMarks: Number(totalMarks) || 50,
    passingMarks: Number(req.body.passingMarks) || Math.round(totalMarks * 0.4),
    syllabus,
    instructions,
    status: req.body.status || 'scheduled',
  });

  if (exam.status !== 'cancelled') {
    await notifyClass(
      exam.className,
      {
        title: `Exam scheduled: ${title}`,
        message: `${subjectDoc.name} on ${new Date(date).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })} at ${exam.startTime}${exam.room ? ` · ${exam.room}` : ''}`,
        type: 'exam',
        priority: 'high',
        link: '/student/exams',
      },
      { studentsOnly: true }
    );
  }

  return created(res, await Exam.findById(exam._id).populate(POPULATE));
};

/** PUT /api/exams/:id */
const updateExam = async (req, res) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam) throw ApiError.notFound('Exam not found.');

  const editable = [
    'title',
    'subject',
    'className',
    'type',
    'date',
    'startTime',
    'durationMinutes',
    'room',
    'totalMarks',
    'passingMarks',
    'syllabus',
    'instructions',
    'status',
  ];
  const updates = {};
  editable.forEach((key) => {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  });
  if (updates.date) updates.date = new Date(updates.date);

  const updated = await Exam.findByIdAndUpdate(exam._id, { $set: updates }, { new: true }).populate(POPULATE);

  if (req.body.notifyStudents) {
    await notifyClass(
      updated.className,
      {
        title: `Exam updated: ${updated.title}`,
        message: `${new Date(updated.date).toLocaleDateString('en-IN')} at ${updated.startTime}`,
        type: 'exam',
        priority: 'high',
        link: '/student/exams',
      },
      { studentsOnly: true }
    );
  }

  return ok(res, updated);
};

/** DELETE /api/exams/:id */
const deleteExam = async (req, res) => {
  const exam = await Exam.findByIdAndDelete(req.params.id);
  if (!exam) throw ApiError.notFound('Exam not found.');
  return ok(res, { message: 'Exam removed from the schedule.' });
};

/** GET /api/exams/timetable/:className — grouped day-wise schedule */
const timetable = async (req, res) => {
  const exams = await Exam.find({ className: req.params.className, status: { $ne: 'cancelled' } })
    .populate({ path: 'subject', select: 'name code shortName color' })
    .sort({ date: 1 })
    .lean();

  const days = {};
  exams.forEach((exam) => {
    const key = new Date(exam.date).toISOString().slice(0, 10);
    days[key] = days[key] || [];
    days[key].push(exam);
  });

  return ok(res, {
    className: req.params.className,
    days: Object.entries(days).map(([date, items]) => ({ date, exams: items })),
    total: exams.length,
  });
};

/** POST /api/exams/:id/remind — notify students that the exam is near */
const sendExamReminders = async (req, res) => {
  const exam = await Exam.findById(req.params.id).populate('subject', 'name');
  if (!exam) throw ApiError.notFound('Exam not found.');

  const students = await Student.find({ className: exam.className, status: 'active' }).lean();
  const daysLeft = Math.ceil((new Date(exam.date) - Date.now()) / 86400000);

  await Promise.all(
    students.map((student) =>
      notify({
        user: student.user,
        title: `Exam reminder: ${exam.title}`,
        message: `${exam.subject?.name || ''} in ${daysLeft} day(s) — ${new Date(exam.date).toLocaleDateString('en-IN')} at ${exam.startTime}.`,
        type: 'exam',
        priority: daysLeft <= 2 ? 'urgent' : 'high',
        link: '/student/exams',
      })
    )
  );

  return ok(res, { reminded: students.length, daysLeft });
};

module.exports = { listExams, getExam, createExam, updateExam, deleteExam, timetable, sendExamReminders };

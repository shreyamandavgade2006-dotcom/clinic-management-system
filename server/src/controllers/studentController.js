'use strict';

const bcrypt = require('bcryptjs');
const { ApiError, ok, created } = require('../lib/http');
const User = require('../models/User');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const Mark = require('../models/Mark');
const Submission = require('../models/Submission');
const QuizAttempt = require('../models/QuizAttempt');
const { performanceForStudent, attendanceSummaryForStudent } = require('../services/analyticsService');

const POPULATE = [
  { path: 'user', select: 'name email phone avatar isActive lastLoginAt' },
  { path: 'subjects', select: 'name code shortName color credits' },
];

/**
 * GET /api/students
 * Filters: search, className, department, semester, status, belowAttendance, page, limit, sort
 */
const listStudents = async (req, res) => {
  const {
    search = '',
    className,
    department,
    semester,
    status,
    subject,
    page = 1,
    limit = 25,
    sort = 'rollNo',
  } = req.query;

  const filter = {};
  if (className) filter.className = className;
  if (department) filter.department = department;
  if (semester) filter.semester = Number(semester);
  if (status) filter.status = status;
  if (subject) filter.subjects = subject;

  // teachers only see their own classes unless they ask for something else
  if (req.user.role === 'teacher' && req.teacher?.classes?.length) {
    if (!className) filter.className = { $in: req.teacher.classes };
  }

  let students = await Student.find(filter).populate(POPULATE).sort({ [sort]: 1 }).lean();

  if (search) {
    const needle = String(search).toLowerCase();
    students = students.filter((student) => {
      const haystack = [
        student.user?.name,
        student.user?.email,
        student.rollNo,
        student.admissionNo,
        student.className,
        student.guardian?.name,
        student.guardian?.phone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }

  // attach a light performance/attendance summary when the caller asks for it
  const withStats = String(req.query.withStats || 'true') !== 'false';
  if (withStats) {
    const ids = students.map((s) => s._id);
    const [attendance, marks] = await Promise.all([
      Attendance.find({ student: { $in: ids } }).lean(),
      Mark.find({ student: { $in: ids } }).lean(),
    ]);

    const attendanceByStudent = attendance.reduce((acc, record) => {
      const key = String(record.student);
      acc[key] = acc[key] || { attended: 0, total: 0 };
      if (record.status !== 'excused') {
        acc[key].total += 1;
        if (record.status === 'present' || record.status === 'late') acc[key].attended += 1;
      }
      return acc;
    }, {});

    students = students.map((student) => {
      const record = attendanceByStudent[String(student._id)] || { attended: 0, total: 0 };
      const studentMarks = marks.filter((m) => String(m.student) === String(student._id));
      const obtained = studentMarks.reduce((sum, m) => sum + m.marksObtained, 0);
      const max = studentMarks.reduce((sum, m) => sum + m.maxMarks, 0);
      return {
        ...student,
        attendancePercentage: record.total ? Math.round((record.attended / record.total) * 1000) / 10 : 0,
        performancePercentage: max ? Math.round((obtained / max) * 1000) / 10 : 0,
        attendanceRecords: record.total,
        marksRecords: studentMarks.length,
      };
    });

    if (req.query.belowAttendance) {
      const threshold = Number(req.query.belowAttendance) || 75;
      students = students.filter((s) => s.attendancePercentage < threshold);
    }
  }

  const total = students.length;
  const pageNum = Math.max(1, Number(page));
  const pageSize = Math.min(200, Math.max(1, Number(limit)));
  const paged = students.slice((pageNum - 1) * pageSize, pageNum * pageSize);

  return ok(res, paged, {
    total,
    page: pageNum,
    limit: pageSize,
    pages: Math.ceil(total / pageSize) || 1,
    classes: await Student.distinct('className'),
  });
};

/** GET /api/students/:id */
const getStudent = async (req, res) => {
  const student = await Student.findById(req.params.id).populate(POPULATE);
  if (!student) throw ApiError.notFound('Student not found.');

  if (req.user.role === 'student' && String(student._id) !== String(req.student?._id)) {
    throw ApiError.forbidden('You can only view your own profile.');
  }

  const [attendance, performance, submissions, attempts] = await Promise.all([
    attendanceSummaryForStudent(student._id),
    performanceForStudent(student._id),
    Submission.find({ student: student._id }).populate('assignment', 'title dueDate totalMarks subject').lean(),
    QuizAttempt.find({ student: student._id }).populate('quiz', 'title totalMarks').lean(),
  ]);

  return ok(res, { student, attendance, performance, submissions, attempts });
};

/** POST /api/students — teacher creates a student (also creates the login) */
const createStudent = async (req, res) => {
  const {
    name,
    email,
    password = 'Student@123',
    rollNo,
    className,
    department,
    semester,
    division,
    batch,
    gender,
    dateOfBirth,
    bloodGroup,
    address,
    guardian,
    phone,
  } = req.body;

  if (await User.findOne({ email: String(email).toLowerCase() })) {
    throw ApiError.conflict('A user with this email already exists.');
  }
  if (await Student.findOne({ rollNo })) throw ApiError.conflict(`Roll number ${rollNo} is already in use.`);

  const user = await User.create({
    name,
    email: String(email).toLowerCase(),
    password: await bcrypt.hash(password, 10),
    role: 'student',
    phone: phone || '',
  });

  const subjects = await Subject.find({ className, isActive: true }).lean();

  const student = await Student.create({
    user: user._id,
    rollNo,
    className,
    department: department || 'Computer Engineering',
    semester: Number(semester) || 5,
    division: division || 'A',
    batch: batch || '',
    gender: gender || '',
    dateOfBirth: dateOfBirth || null,
    bloodGroup: bloodGroup || '',
    address: address || '',
    guardian: guardian || {},
    subjects: subjects.map((s) => s._id),
  });

  return created(res, await Student.findById(student._id).populate(POPULATE));
};

/** PUT /api/students/:id */
const updateStudent = async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw ApiError.notFound('Student not found.');

  const editable = [
    'rollNo',
    'admissionNo',
    'className',
    'department',
    'semester',
    'division',
    'batch',
    'gender',
    'dateOfBirth',
    'bloodGroup',
    'address',
    'status',
    'photo',
    'notes',
    'guardian',
  ];
  const updates = {};
  editable.forEach((key) => {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  });

  if (updates.className && updates.className !== student.className) {
    const subjects = await Subject.find({ className: updates.className, isActive: true }).lean();
    updates.subjects = subjects.map((s) => s._id);
  }

  const updated = await Student.findByIdAndUpdate(student._id, { $set: updates }, { new: true }).populate(POPULATE);

  if (req.body.name || req.body.email || req.body.phone) {
    await User.findByIdAndUpdate(student.user, {
      $set: {
        ...(req.body.name ? { name: req.body.name } : {}),
        ...(req.body.email ? { email: String(req.body.email).toLowerCase() } : {}),
        ...(req.body.phone ? { phone: req.body.phone } : {}),
      },
    });
  }

  return ok(res, updated);
};

/** DELETE /api/students/:id */
const deleteStudent = async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw ApiError.notFound('Student not found.');

  await Promise.all([
    Attendance.deleteMany({ student: student._id }),
    Mark.deleteMany({ student: student._id }),
    Submission.deleteMany({ student: student._id }),
    QuizAttempt.deleteMany({ student: student._id }),
    Student.findByIdAndDelete(student._id),
    User.findByIdAndDelete(student.user),
  ]);

  return ok(res, { message: 'Student and all related records were removed.' });
};

/** GET /api/students/me */
const myProfile = async (req, res) => {
  const student = await Student.findById(req.student._id).populate(POPULATE);
  const [attendance, performance] = await Promise.all([
    attendanceSummaryForStudent(student._id),
    performanceForStudent(student._id),
  ]);
  return ok(res, { student, attendance, performance });
};

/** GET /api/students/meta/classes */
const classMeta = async (_req, res) => {
  const classes = await Student.distinct('className');
  const counts = await Promise.all(
    classes.map(async (className) => ({
      className,
      students: await Student.countDocuments({ className, status: 'active' }),
      subjects: await Subject.countDocuments({ className }),
    }))
  );
  return ok(res, { classes: classes.sort(), summary: counts });
};

/** POST /api/students/bulk — bulk import (teacher) */
const bulkImport = async (req, res) => {
  const { students = [], defaultPassword = 'Student@123' } = req.body;
  if (!Array.isArray(students) || students.length === 0) throw ApiError.badRequest('Provide a non-empty students array.');

  const results = { created: 0, skipped: 0, errors: [] };

  for (const [index, row] of students.entries()) {
    try {
      if (!row.name || !row.email || !row.rollNo || !row.className) {
        throw new Error('name, email, rollNo and className are required');
      }
      if (await User.findOne({ email: String(row.email).toLowerCase() })) {
        results.skipped += 1;
        continue;
      }
      const user = await User.create({
        name: row.name,
        email: String(row.email).toLowerCase(),
        password: await bcrypt.hash(row.password || defaultPassword, 10),
        role: 'student',
        phone: row.phone || '',
      });
      const subjects = await Subject.find({ className: row.className, isActive: true }).lean();
      await Student.create({
        user: user._id,
        rollNo: row.rollNo,
        className: row.className,
        department: row.department || 'Computer Engineering',
        semester: Number(row.semester) || 5,
        division: row.division || 'A',
        guardian: row.guardian || {},
        subjects: subjects.map((s) => s._id),
      });
      results.created += 1;
    } catch (error) {
      results.errors.push({ row: index + 1, message: error.message });
    }
  }

  return ok(res, results);
};

module.exports = {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  myProfile,
  classMeta,
  bulkImport,
};

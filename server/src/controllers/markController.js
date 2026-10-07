'use strict';

const { ApiError, ok, created } = require('../lib/http');
const Mark = require('../models/Mark');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const { notify } = require('../services/notificationService');
const { computeGrade } = require('../models/Mark');
const { performanceForStudent, performanceForClass, summariseMarks, EXAM_TYPE_LABELS } = require('../services/analyticsService');

const POPULATE = [
  { path: 'subject', select: 'name code shortName color credits' },
  { path: 'student', select: 'rollNo className user', populate: { path: 'user', select: 'name email' } },
];

/** GET /api/marks */
const listMarks = async (req, res) => {
  const { student, subject, className, examType, limit = 300 } = req.query;
  const filter = {};

  if (req.user.role === 'student') filter.student = req.student._id;
  else {
    if (student) filter.student = student;
    if (className) filter.className = className;
    else if (req.teacher?.classes?.length) filter.className = { $in: req.teacher.classes };
  }
  if (subject) filter.subject = subject;
  if (examType) filter.examType = examType;

  const marks = await Mark.find(filter)
    .populate(POPULATE)
    .sort({ examDate: -1 })
    .limit(Math.min(1000, Number(limit)))
    .lean();

  return ok(res, marks, { examTypes: Object.entries(EXAM_TYPE_LABELS).map(([value, label]) => ({ value, label })) });
};

/** POST /api/marks — single or bulk entry */
const createMarks = async (req, res) => {
  const payload = Array.isArray(req.body.marks) ? req.body.marks : [req.body];
  if (payload.length === 0) throw ApiError.badRequest('No marks provided.');

  const results = { saved: 0, updated: 0, errors: [], records: [] };

  for (const entry of payload) {
    try {
      const { student, subject, marksObtained, maxMarks, examType = 'unit-test', title = '', examDate, weightage = 100, remarks = '' } = entry;
      if (!student || !subject) throw new Error('student and subject are required');
      if (marksObtained === undefined || maxMarks === undefined) throw new Error('marksObtained and maxMarks are required');
      if (Number(marksObtained) > Number(maxMarks)) throw new Error('Obtained marks cannot exceed maximum marks');

      const subjectDoc = await Subject.findById(subject).lean();
      const studentDoc = await Student.findById(student).lean();
      if (!subjectDoc || !studentDoc) throw new Error('Invalid student or subject');

      const { grade } = computeGrade(Number(marksObtained), Number(maxMarks));

      const existing = await Mark.findOne({ student, subject, examType, title });
      let record;
      if (existing) {
        record = await Mark.findByIdAndUpdate(
          existing._id,
          { $set: { marksObtained: Number(marksObtained), maxMarks: Number(maxMarks), weightage: Number(weightage), grade,remarks, examDate: examDate || existing.examDate } },
          { new: true }
        );
        results.updated += 1;
      } else {
        record = await Mark.create({
          student,
          subject,
          teacher: req.teacher?._id || null,
          className: studentDoc.className,
          semester: studentDoc.semester,
          examType,
          title,
          marksObtained: Number(marksObtained),
          maxMarks: Number(maxMarks),
          weightage: Number(weightage),
          grade,
          remarks,
          examDate: examDate || new Date(),
        });
        results.saved += 1;
      }
      results.records.push(record);

      // notify the student only for brand-new results
      if (!existing && req.body.notifyStudents !== false) {
        await notify({
          user: studentDoc.user,
          title: `New marks published — ${subjectDoc.shortName || subjectDoc.name}`,
          message: `${title || EXAM_TYPE_LABELS[examType]}: ${marksObtained}/${maxMarks} (Grade ${grade}).`,
          type: 'marks',
          link: '/student/marks',
        });
      }
    } catch (error) {
      results.errors.push({ entry, message: error.message });
    }
  }

  return created(res, results);
};

/** PUT /api/marks/:id */
const updateMark = async (req, res) => {
  const mark = await Mark.findById(req.params.id);
  if (!mark) throw ApiError.notFound('Marks record not found.');

  const marksObtained = req.body.marksObtained !== undefined ? Number(req.body.marksObtained) : mark.marksObtained;
  const maxMarks = req.body.maxMarks !== undefined ? Number(req.body.maxMarks) : mark.maxMarks;
  if (marksObtained > maxMarks) throw ApiError.badRequest('Obtained marks cannot exceed maximum marks.');

  const updated = await Mark.findByIdAndUpdate(
    mark._id,
    {
      $set: {
        marksObtained,
        maxMarks,
        grade: computeGrade(marksObtained, maxMarks).grade,
        ...(req.body.title !== undefined ? { title: req.body.title } : {}),
        ...(req.body.examType ? { examType: req.body.examType } : {}),
        ...(req.body.remarks !== undefined ? { remarks: req.body.remarks } : {}),
        ...(req.body.weightage !== undefined ? { weightage: Number(req.body.weightage) } : {}),
        ...(req.body.examDate ? { examDate: req.body.examDate } : {}),
      },
    },
    { new: true }
  ).populate(POPULATE);

  return ok(res, updated);
};

/** DELETE /api/marks/:id */
const deleteMark = async (req, res) => {
  const mark = await Mark.findByIdAndDelete(req.params.id);
  if (!mark) throw ApiError.notFound('Marks record not found.');
  return ok(res, { message: 'Marks record deleted.' });
};

/** GET /api/marks/student/:id — performance analytics for one student */
const studentPerformance = async (req, res) => {
  const studentId = req.user.role === 'student' ? req.student._id : req.params.id;
  if (req.user.role === 'student' && req.params.id !== 'me' && String(req.student._id) !== String(req.params.id)) {
    throw ApiError.forbidden('You can only view your own performance.');
  }

  const student = await Student.findById(studentId).populate('user', 'name email avatar');
  if (!student) throw ApiError.notFound('Student not found.');

  const performance = await performanceForStudent(studentId);
  return ok(res, { student, ...performance });
};

/** GET /api/marks/class/:className — class analytics */
const classPerformance = async (req, res) => {
  const performance = await performanceForClass(req.params.className, { subjectId: req.query.subject });
  return ok(res, performance);
};

/** GET /api/marks/subject/:subjectId — score sheet for a subject */
const subjectMarks = async (req, res) => {
  const subject = await Subject.findById(req.params.subjectId).lean();
  if (!subject) throw ApiError.notFound('Subject not found.');

  const [marks, students] = await Promise.all([
    Mark.find({ subject: subject._id }).lean(),
    Student.find({ className: subject.className, status: 'active' }).populate('user', 'name').sort({ rollNo: 1 }).lean(),
  ]);

  const byStudent = marks.reduce((acc, mark) => {
    const key = String(mark.student);
    acc[key] = acc[key] || [];
    acc[key].push(mark);
    return acc;
  }, {});

  const rows = students.map((student) => {
    const list = byStudent[String(student._id)] || [];
    const summary = summariseMarks(list);
    return {
      studentId: String(student._id),
      rollNo: student.rollNo,
      name: student.user?.name || student.rollNo,
      ...summary,
      exams: list
        .sort((a, b) => new Date(a.examDate) - new Date(b.examDate))
        .map((m) => ({
          _id: m._id,
          title: m.title,
          examType: m.examType,
          examLabel: EXAM_TYPE_LABELS[m.examType] || m.examType,
          marksObtained: m.marksObtained,
          maxMarks: m.maxMarks,
          grade: m.grade,
          examDate: m.examDate,
        })),
    };
  });

  return ok(res, {
    subject: { _id: subject._id, name: subject.name, code: subject.code, className: subject.className },
    rows,
    stats: {
      average: rows.length ? Math.round((rows.reduce((sum, r) => sum + r.percentage, 0) / rows.length) * 100) / 100 : 0,
      totalRecords: marks.length,
      toppers: [...rows].sort((a, b) => b.percentage - a.percentage).slice(0, 3),
    },
  });
};

module.exports = {
  listMarks,
  createMarks,
  updateMark,
  deleteMark,
  studentPerformance,
  classPerformance,
  subjectMarks,
};

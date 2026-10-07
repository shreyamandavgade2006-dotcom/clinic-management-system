'use strict';

const { ApiError, ok, created } = require('../lib/http');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Attendance = require('../models/Attendance');
const Mark = require('../models/Mark');
const { performanceForClass, attendanceSummaryForClass } = require('../services/analyticsService');

const POPULATE = [{ path: 'teacher', select: 'employeeId designation department user', populate: { path: 'user', select: 'name email avatar' } }];

/** GET /api/subjects */
const listSubjects = async (req, res) => {
  const { className, teacher, search, semester } = req.query;
  const filter = { isActive: true };
  if (className) filter.className = className;
  if (semester) filter.semester = Number(semester);
  if (req.query.mine === 'true' && req.teacher) filter.teacher = req.teacher._id;
  else if (teacher) filter.teacher = teacher;

  let subjects = await Subject.find(filter).populate(POPULATE).sort({ code: 1 }).lean();

  if (search) {
    const needle = String(search).toLowerCase();
    subjects = subjects.filter((subject) =>
      [subject.name, subject.code, subject.shortName, subject.className].filter(Boolean).join(' ').toLowerCase().includes(needle)
    );
  }

  // attach quick counts for the teacher's subject cards
  const enriched = await Promise.all(
    subjects.map(async (subject) => ({
      ...subject,
      studentCount: await Student.countDocuments({ className: subject.className, status: 'active' }),
      attendanceRecords: await Attendance.countDocuments({ subject: subject._id }),
      marksRecords: await Mark.countDocuments({ subject: subject._id }),
    }))
  );

  return ok(res, enriched);
};

/** GET /api/subjects/:id */
const getSubject = async (req, res) => {
  const subject = await Subject.findById(req.params.id).populate(POPULATE);
  if (!subject) throw ApiError.notFound('Subject not found.');

  const [performance, attendance, students] = await Promise.all([
    performanceForClass(subject.className, { subjectId: subject._id }),
    attendanceSummaryForClass(subject.className, { subjectId: subject._id }),
    Student.find({ className: subject.className, status: 'active' })
      .populate('user', 'name email avatar')
      .select('rollNo className user guardian')
      .lean(),
  ]);

  return ok(res, { subject, performance, attendance, students });
};

/** POST /api/subjects */
const createSubject = async (req, res) => {
  const { code, name, className } = req.body;
  if (await Subject.findOne({ code: String(code).toUpperCase() })) {
    throw ApiError.conflict(`Subject code ${String(code).toUpperCase()} already exists.`);
  }

  const subject = await Subject.create({
    ...req.body,
    code: String(code).toUpperCase(),
    // a teacher created subject is automatically assigned to them
    teacher: req.body.teacher || req.teacher?._id || null,
    className,
  });

  // enroll every active student of the class into the new subject
  const students = await Student.find({ className, status: 'active' }).lean();
  await Promise.all(
    students.map((student) =>
      Student.findOneAndUpdate({ _id: student._id }, { $addToSet: { subjects: subject._id } })
    )
  );
  if (req.teacher) {
    await Teacher.findByIdAndUpdate(req.teacher._id, {
      $addToSet: { subjects: subject._id, classes: className },
    });
  }

  return created(res, await Subject.findById(subject._id).populate(POPULATE));
};

/** PUT /api/subjects/:id */
const updateSubject = async (req, res) => {
  const subject = await Subject.findById(req.params.id);
  if (!subject) throw ApiError.notFound('Subject not found.');

  const editable = [
    'name',
    'shortName',
    'department',
    'semester',
    'credits',
    'className',
    'teacher',
    'units',
    'color',
    'icon',
    'maxMarks',
    'isActive',
  ];
  const updates = {};
  editable.forEach((key) => {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  });
  if (req.body.code) updates.code = String(req.body.code).toUpperCase();

  const updated = await Subject.findByIdAndUpdate(subject._id, { $set: updates }, { new: true }).populate(POPULATE);
  return ok(res, updated);
};

/** DELETE /api/subjects/:id */
const deleteSubject = async (req, res) => {
  const subject = await Subject.findById(req.params.id);
  if (!subject) throw ApiError.notFound('Subject not found.');

  await Subject.findByIdAndUpdate(subject._id, { $set: { isActive: false } });
  return ok(res, { message: `${subject.name} has been archived.` });
};

/** GET /api/subjects/:id/units — unit + topic list for the AI generator */
const subjectUnits = async (req, res) => {
  const subject = await Subject.findById(req.params.id).lean();
  if (!subject) throw ApiError.notFound('Subject not found.');
  return ok(res, {
    subject: { _id: subject._id, name: subject.name, code: subject.code, className: subject.className },
    units: subject.units || [],
  });
};

/** PUT /api/subjects/:id/units — teachers maintain the syllabus topics used by the AI */
const saveUnits = async (req, res) => {
  const { units = [] } = req.body;
  if (!Array.isArray(units)) throw ApiError.badRequest('units must be a list.');

  const normalised = units.map((unit, index) => ({
    unitNo: Number(unit.unitNo) || index + 1,
    title: unit.title || `Unit ${index + 1}`,
    topics: (unit.topics || []).map((topic) => String(topic).trim()).filter(Boolean),
  }));

  const subject = await Subject.findByIdAndUpdate(req.params.id, { $set: { units: normalised } }, { new: true });
  if (!subject) throw ApiError.notFound('Subject not found.');
  return ok(res, subject);
};

module.exports = { listSubjects, getSubject, createSubject, updateSubject, deleteSubject, subjectUnits, saveUnits };

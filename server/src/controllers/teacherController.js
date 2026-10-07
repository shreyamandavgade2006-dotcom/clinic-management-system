'use strict';

const bcrypt = require('bcryptjs');
const { ApiError, ok, created } = require('../lib/http');
const Teacher = require('../models/Teacher');
const User = require('../models/User');
const Student = require('../models/Student');
const Subject = require('../models/Subject');

const POPULATE = [
  { path: 'user', select: 'name email phone avatar isActive lastLoginAt' },
  { path: 'subjects', select: 'name code shortName color className' },
];

/** GET /api/teachers */
const listTeachers = async (req, res) => {
  const { search, department } = req.query;
  const filter = {};
  if (department) filter.department = department;

  let teachers = await Teacher.find(filter).populate(POPULATE).sort({ employeeId: 1 }).lean();

  if (search) {
    const needle = String(search).toLowerCase();
    teachers = teachers.filter((teacher) =>
      [teacher.user?.name, teacher.user?.email, teacher.employeeId, teacher.department, teacher.designation]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }

  const enriched = await Promise.all(
    teachers.map(async (teacher) => ({
      ...teacher,
      subjectCount: await Subject.countDocuments({ teacher: teacher._id }),
      studentCount: teacher.classes?.length
        ? await Student.countDocuments({ className: { $in: teacher.classes }, status: 'active' })
        : 0,
    }))
  );

  return ok(res, enriched, { total: enriched.length });
};

/** GET /api/teachers/:id */
const getTeacher = async (req, res) => {
  const teacher = await Teacher.findById(req.params.id).populate(POPULATE);
  if (!teacher) throw ApiError.notFound('Teacher not found.');

  const subjects = await Subject.find({ teacher: teacher._id }).lean();
  const classSizes = await Promise.all(
    (teacher.classes || []).map(async (className) => ({
      className,
      students: await Student.countDocuments({ className, status: 'active' }),
    }))
  );

  return ok(res, { teacher, subjects, classSizes });
};

/** GET /api/teachers/me */
const myTeacherProfile = async (req, res) => {
  const teacher = await Teacher.findById(req.teacher._id).populate(POPULATE);
  if (!teacher) throw ApiError.notFound('Teacher profile not found.');
  const subjects = await Subject.find({ teacher: teacher._id }).lean();
  return ok(res, { teacher, subjects });
};

/** PUT /api/teachers/me */
const updateMyTeacherProfile = async (req, res) => {
  const editable = ['designation', 'department', 'qualification', 'experienceYears', 'phone', 'cabin', 'about', 'classes'];
  const updates = {};
  editable.forEach((key) => {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  });

  if (req.body.name) await User.findByIdAndUpdate(req.user._id, { $set: { name: req.body.name } });
  if (req.body.phone) await User.findByIdAndUpdate(req.user._id, { $set: { phone: req.body.phone } });
  if (req.body.avatar !== undefined) await User.findByIdAndUpdate(req.user._id, { $set: { avatar: req.body.avatar } });

  const teacher = await Teacher.findByIdAndUpdate(req.teacher._id, { $set: updates }, { new: true }).populate(POPULATE);
  return ok(res, teacher);
};

/** POST /api/teachers — create a teacher account (admin-style helper) */
const createTeacher = async (req, res) => {
  const { name, email, password = 'Teacher@123', employeeId, department, designation, phone = '', classes = [] } = req.body;

  if (await User.findOne({ email: String(email).toLowerCase() })) throw ApiError.conflict('A user with this email already exists.');

  const user = await User.create({
    name,
    email: String(email).toLowerCase(),
    password: await bcrypt.hash(password, 10),
    role: 'teacher',
    phone,
  });

  const teacher = await Teacher.create({
    user: user._id,
    employeeId: employeeId || `FAC-${String((await Teacher.countDocuments({})) + 1).padStart(3, '0')}`,
    department: department || 'Computer Engineering',
    designation: designation || 'Assistant Professor',
    phone,
    classes,
  });

  return created(res, await Teacher.findById(teacher._id).populate(POPULATE));
};

/** PUT /api/teachers/:id/subjects — assign subjects/classes to a teacher */
const assignSubjects = async (req, res) => {
  const { subjects = [], classes = [] } = req.body;
  const teacher = await Teacher.findByIdAndUpdate(
    req.params.id,
    { $set: { subjects, classes } },
    { new: true }
  ).populate(POPULATE);
  if (!teacher) throw ApiError.notFound('Teacher not found.');

  await Subject.updateMany({ _id: { $in: subjects } }, { $set: { teacher: teacher._id } });
  return ok(res, teacher);
};

module.exports = { listTeachers, getTeacher, myTeacherProfile, updateMyTeacherProfile, createTeacher, assignSubjects };

'use strict';

const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { signToken } = require('../middleware/auth');
const { ApiError, ok, created } = require('../lib/http');
const { notify } = require('../services/notificationService');
const { providerStatus } = require('../services/aiService');
const { databaseStatus } = require('../config/db');

const User = require('../models/User');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Subject = require('../models/Subject');

const hash = (plain) => bcrypt.hash(plain, 10);

const buildSession = async (user) => {
  const profile =
    user.role === 'student'
      ? await Student.findOne({ user: user._id }).populate('subjects', 'name code shortName color')
      : await Teacher.findOne({ user: user._id }).populate('subjects', 'name code shortName color');

  return {
    token: signToken(user),
    user: user.toSafeJSON ? user.toSafeJSON() : { _id: user._id, name: user.name, email: user.email, role: user.role },
    profile: profile || null,
  };
};

/** POST /api/auth/register */
const register = async (req, res) => {
  const { name, email, password, role, phone = '', inviteCode = '', className, rollNo, employeeId, department, semester } = req.body;

  const existing = await User.findOne({ email: String(email).toLowerCase() });
  if (existing) throw ApiError.conflict('An account with this email already exists.');

  // Role based access: privileged roles require the shared code from the institution.
  if (role === 'teacher' && inviteCode !== env.teacherInviteCode) {
    throw ApiError.forbidden('Invalid teacher invite code. Please contact your institution administrator.');
  }
  if (role === 'student' && inviteCode !== env.studentClassCode) {
    throw ApiError.forbidden('Invalid class code. Please ask your teacher for the current class code.');
  }

  const user = await User.create({
    name,
    email: String(email).toLowerCase(),
    password: await hash(password),
    role,
    phone,
    avatar: '',
  });

  let profile = null;

  if (role === 'student') {
    const generatedRoll =
      rollNo ||
      `${String(className || 'GEN').replace(/[^A-Za-z0-9]/g, '').toUpperCase()}-${String(
        (await Student.countDocuments({ className })) + 1
      ).padStart(3, '0')}`;

    profile = await Student.create({
      user: user._id,
      rollNo: generatedRoll,
      className: className || 'TE-A',
      department: department || 'Computer Engineering',
      semester: Number(semester) || 5,
      status: 'active',
    });

    // auto-enroll into the subjects of the class
    const subjects = await Subject.find({ className: profile.className, isActive: true }).lean();
    if (subjects.length) {
      await Student.findOneAndUpdate({ _id: profile._id }, { $set: { subjects: subjects.map((s) => s._id) } });
      profile.subjects = subjects;
    }

    await notify({
      user: user._id,
      title: 'Welcome to the Smart Student Management System 🎓',
      message: `Your student account is ready. Roll number: ${profile.rollNo}, Class: ${profile.className}.`,
      type: 'system',
      link: '/student',
    });
  } else {
    profile = await Teacher.create({
      user: user._id,
      employeeId: employeeId || `FAC-${String((await Teacher.countDocuments({})) + 1).padStart(3, '0')}`,
      department: department || 'Computer Engineering',
      phone,
    });
  }

  const session = await buildSession(user);
  return created(res, { ...session, profile });
};

/** POST /api/auth/login */
const login = async (req, res) => {
  const { email, password, role } = req.body;

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  if (!user) throw ApiError.unauthorized('No account found with these credentials.');

  const matches = await user.comparePassword(password);
  if (!matches) throw ApiError.unauthorized('Incorrect email or password.');

  if (role && user.role !== role) {
    throw ApiError.forbidden(`This account is registered as a ${user.role}. Please use the ${user.role} login.`);
  }
  if (user.isActive === false) throw ApiError.forbidden('Your account has been deactivated.');

  await User.findByIdAndUpdate(user._id, { $set: { lastLoginAt: new Date() } });

  const session = await buildSession(user);
  return ok(res, session);
};

/** GET /api/auth/me */
const me = async (req, res) => {
  const session = await buildSession(req.user);
  return ok(res, {
    ...session,
    student: req.student || null,
    teacher: req.teacher || null,
    system: { database: databaseStatus(), ai: providerStatus() },
  });
};

/** PATCH /api/auth/profile — basic user fields */
const updateProfile = async (req, res) => {
  const allowed = ['name', 'phone', 'avatar'];
  const updates = {};
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  });

  const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true });
  return ok(res, user.toSafeJSON ? user.toSafeJSON() : user);
};

/** PATCH /api/auth/password */
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  const matches = await user.comparePassword(currentPassword);
  if (!matches) throw ApiError.badRequest('Your current password is incorrect.');

  await User.findByIdAndUpdate(user._id, { $set: { password: await hash(newPassword) } });
  return ok(res, { message: 'Password updated successfully.' });
};

/** PATCH /api/auth/student-profile — students manage their own academic/contact details */
const updateStudentProfile = async (req, res) => {
  if (!req.student) throw ApiError.forbidden('Only students have a student profile.');

  const studentFields = ['address', 'dateOfBirth', 'bloodGroup', 'gender', 'photo', 'batch'];
  const updates = {};
  studentFields.forEach((key) => {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  });

  if (req.body.guardian) {
    const current = req.student.guardian || {};
    updates.guardian = {
      name: req.body.guardian.name ?? current.name,
      relation: req.body.guardian.relation ?? current.relation,
      phone: req.body.guardian.phone ?? current.phone,
      email: req.body.guardian.email ?? current.email,
      whatsappOptIn: req.body.guardian.whatsappOptIn ?? current.whatsappOptIn ?? true,
    };
  }

  if (Object.keys(updates).length === 0) throw ApiError.badRequest('Nothing to update.');

  const student = await Student.findByIdAndUpdate(req.student._id, { $set: updates }, { new: true }).populate(
    'user',
    'name email phone avatar'
  );

  if (req.body.name || req.body.phone) {
    await User.findByIdAndUpdate(req.user._id, {
      $set: {
        ...(req.body.name ? { name: req.body.name } : {}),
        ...(req.body.phone ? { phone: req.body.phone } : {}),
      },
    });
  }

  return ok(res, student);
};

/** GET /api/auth/config — public: what the login screen should show (demo creds, providers) */
const publicConfig = async (_req, res) =>
  ok(res, {
    collegeName: 'Smart Student Management System',
    attendanceThreshold: env.attendanceThreshold,
    roles: ['student', 'teacher'],
    ai: providerStatus(),
    whatsapp: { provider: env.whatsappProvider },
    database: databaseStatus(),
    demoAccounts: [
      { role: 'teacher', email: 'priya.sharma@ssms.edu', password: env.seedPasswordTeacher },
      { role: 'student', email: 'aarav.patil@ssms.edu', password: env.seedPasswordStudent },
      { role: 'student', email: 'meera.nair@ssms.edu', password: env.seedPasswordStudent },
    ],
  });

module.exports = { register, login, me, updateProfile, changePassword, updateStudentProfile, publicConfig };

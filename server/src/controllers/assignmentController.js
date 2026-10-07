'use strict';

const { ApiError, ok, created } = require('../lib/http');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const { notifyClass, notify } = require('../services/notificationService');
const { generateAssessment } = require('../services/aiService');

const POPULATE = [
  { path: 'subject', select: 'name code shortName color' },
  { path: 'teacher', select: 'employeeId designation', populate: { path: 'user', select: 'name email' } },
];

/** GET /api/assignments */
const listAssignments = async (req, res) => {
  const { className, subject, status, upcoming } = req.query;
  const filter = {};

  if (req.user.role === 'student') {
    filter.className = req.student.className;
    filter.status = { $ne: 'draft' };
  } else {
    if (className) filter.className = className;
    else if (req.teacher?.classes?.length) filter.className = { $in: req.teacher.classes };
    if (status) filter.status = status;
    if (req.query.mine === 'true' && req.teacher) filter.teacher = req.teacher._id;
  }
  if (subject) filter.subject = subject;
  if (upcoming === 'true') filter.dueDate = { $gte: new Date() };

  const assignments = await Assignment.find(filter).populate(POPULATE).sort({ dueDate: -1 }).lean();
  const ids = assignments.map((a) => a._id);

  const submissions = await Submission.find({ assignment: { $in: ids } }).lean();

  const enriched = assignments.map((assignment) => {
    const related = submissions.filter((s) => String(s.assignment) === String(assignment._id));
    const graded = related.filter((s) => s.status === 'graded');
    const base = {
      ...assignment,
      submissionCount: related.length,
      gradedCount: graded.length,
      pendingCount: related.length - graded.length,
      overdue: new Date(assignment.dueDate) < new Date() && assignment.status === 'published',
    };

    if (req.user.role === 'student') {
      const mine = related.find((s) => String(s.student) === String(req.student._id));
      return {
        ...base,
        mySubmission: mine || null,
        myStatus: mine ? mine.status : new Date(assignment.dueDate) < new Date() ? 'missed' : 'pending',
        daysLeft: Math.ceil((new Date(assignment.dueDate) - Date.now()) / 86400000),
      };
    }
    return base;
  });

  return ok(res, enriched, { total: enriched.length });
};

/** GET /api/assignments/:id */
const getAssignment = async (req, res) => {
  const assignment = await Assignment.findById(req.params.id).populate(POPULATE);
  if (!assignment) throw ApiError.notFound('Assignment not found.');

  const submissions = await Submission.find({ assignment: assignment._id })
    .populate({ path: 'student', select: 'rollNo className', populate: { path: 'user', select: 'name email' } })
    .lean();

  if (req.user.role === 'student') {
    const mine = submissions.find((s) => String(s.student?._id) === String(req.student._id));
    return ok(res, { assignment, mySubmission: mine || null });
  }

  const students = await Student.find({ className: assignment.className, status: 'active' })
    .populate('user', 'name email')
    .sort({ rollNo: 1 })
    .lean();

  const submittedIds = new Set(submissions.map((s) => String(s.student?._id)));
  return ok(res, {
    assignment,
    submissions,
    notSubmitted: students
      .filter((s) => !submittedIds.has(String(s._id)))
      .map((s) => ({ _id: s._id, rollNo: s.rollNo, name: s.user?.name || s.rollNo })),
    stats: {
      total: students.length,
      submitted: submissions.length,
      graded: submissions.filter((s) => s.status === 'graded').length,
      late: submissions.filter((s) => s.status === 'late').length,
    },
  });
};

/** POST /api/assignments */
const createAssignment = async (req, res) => {
  const {
    title,
    description = '',
    subject,
    className,
    dueDate,
    totalMarks = 20,
    type = 'assignment',
    unit = '',
    topic = '',
    questions = [],
    aiGenerated = false,
    aiRequest,
    status = 'published',
  } = req.body;

  const subjectDoc = await Subject.findById(subject).lean();
  if (!subjectDoc) throw ApiError.notFound('Subject not found.');
  if (!req.teacher) throw ApiError.forbidden('Only teachers can create assignments.');

  let finalQuestions = questions;

  // optional: generate the question set with AI in the same request
  if (aiRequest && finalQuestions.length === 0) {
    const generated = await generateAssessment({
      subject: subjectDoc.name,
      subjectCode: subjectDoc.code,
      unit: aiRequest.unit || unit,
      topics: aiRequest.topics || (topic ? [topic] : []),
      difficulty: aiRequest.difficulty || 'medium',
      questionType: aiRequest.questionType || 'short-answer',
      count: aiRequest.count || 5,
      totalMarks: aiRequest.totalMarks || totalMarks,
      paperType: 'question-paper',
      className: className || subjectDoc.className,
    });
    finalQuestions = generated.questions;
  }

  const assignment = await Assignment.create({
    title,
    description,
    subject: subjectDoc._id,
    teacher: req.teacher._id,
    className: className || subjectDoc.className,
    unit,
    topic,
    type,
    questions: finalQuestions,
    totalMarks: Number(totalMarks) || 20,
    dueDate: new Date(dueDate),
    status,
    aiGenerated: aiGenerated || Boolean(aiRequest),
    allowLateSubmission: req.body.allowLateSubmission ?? false,
  });

  if (status === 'published') {
    await notifyClass(
      assignment.className,
      {
        title: `New ${type}: ${title}`,
        message: `${subjectDoc.name} · due ${new Date(dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · ${totalMarks} marks`,
        type: 'assignment',
        priority: 'high',
        link: `/student/assignments/${assignment._id}`,
      },
      { studentsOnly: true }
    );
  }

  return created(res, await Assignment.findById(assignment._id).populate(POPULATE));
};

/** PUT /api/assignments/:id */
const updateAssignment = async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) throw ApiError.notFound('Assignment not found.');

  const editable = [
    'title',
    'description',
    'subject',
    'className',
    'unit',
    'topic',
    'type',
    'questions',
    'totalMarks',
    'dueDate',
    'status',
    'allowLateSubmission',
    'attachments',
  ];
  const updates = {};
  editable.forEach((key) => {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  });
  if (updates.dueDate) updates.dueDate = new Date(updates.dueDate);

  const updated = await Assignment.findByIdAndUpdate(assignment._id, { $set: updates }, { new: true }).populate(POPULATE);
  return ok(res, updated);
};

/** DELETE /api/assignments/:id */
const deleteAssignment = async (req, res) => {
  const assignment = await Assignment.findByIdAndDelete(req.params.id);
  if (!assignment) throw ApiError.notFound('Assignment not found.');
  await Submission.deleteMany({ assignment: assignment._id });
  return ok(res, { message: 'Assignment deleted.' });
};

/** POST /api/assignments/:id/submit — student */
const submitAssignment = async (req, res) => {
  const assignment = await Assignment.findById(req.params.id).populate('subject', 'name');
  if (!assignment) throw ApiError.notFound('Assignment not found.');
  if (assignment.status === 'draft') throw ApiError.badRequest('This assignment is not published yet.');
  if (String(assignment.className) !== String(req.student.className)) {
    throw ApiError.forbidden('This assignment is not for your class.');
  }

  const late = new Date(assignment.dueDate) < new Date();
  if (late && !assignment.allowLateSubmission) {
    throw ApiError.badRequest('The deadline has passed and late submissions are not allowed.');
  }

  const existing = await Submission.findOne({ assignment: assignment._id, student: req.student._id });
  const payload = {
    content: req.body.content || '',
    attachmentUrl: req.body.attachmentUrl || '',
    status: late ? 'late' : 'submitted',
    submittedAt: new Date(),
  };

  let submission;
  if (existing) {
    if (existing.status === 'graded') throw ApiError.conflict('This assignment is already graded.');
    submission = await Submission.findByIdAndUpdate(existing._id, { $set: payload }, { new: true });
  } else {
    submission = await Submission.create({
      assignment: assignment._id,
      student: req.student._id,
      className: req.student.className,
      ...payload,
    });
  }

  // let the teacher know a submission came in
  const teacherProfile = await Teacher.findById(assignment.teacher);
  if (teacherProfile) {
    await notify({
      user: teacherProfile.user,
      title: `Submission received — ${assignment.title}`,
      message: `${req.student.rollNo} submitted${late ? ' (late)' : ''}.`,
      type: 'assignment',
      link: `/teacher/assignments/${assignment._id}`,
    });
  }

  return created(res, submission);
};

/** PUT /api/assignments/:id/grade/:submissionId — teacher */
const gradeSubmission = async (req, res) => {
  const { marksObtained, feedback = '', status } = req.body;
  const submission = await Submission.findById(req.params.submissionId).populate('assignment');
  if (!submission) throw ApiError.notFound('Submission not found.');

  const max = submission.assignment?.totalMarks || 20;
  if (marksObtained !== undefined && Number(marksObtained) > max) {
    throw ApiError.badRequest(`Marks cannot exceed the assignment total of ${max}.`);
  }

  const updated = await Submission.findByIdAndUpdate(
    submission._id,
    {
      $set: {
        ...(marksObtained !== undefined ? { marksObtained: Number(marksObtained) } : {}),
        feedback,
        status: status || (marksObtained !== undefined ? 'graded' : submission.status),
        gradedAt: new Date(),
      },
    },
    { new: true }
  ).populate({ path: 'student', select: 'rollNo user', populate: { path: 'user', select: 'name' } });

  const studentDoc = await Student.findById(submission.student._id || submission.student);
  if (studentDoc) {
    await notify({
      user: studentDoc.user,
      title: `Assignment graded — ${submission.assignment?.title || ''}`,
      message:
        marksObtained !== undefined
          ? `You scored ${marksObtained}/${max}. ${feedback}`.trim()
          : `Feedback: ${feedback}`,
      type: 'assignment',
      link: `/student/assignments/${submission.assignment?._id || ''}`,
    });
  }

  return ok(res, updated);
};

/** GET /api/assignments/:id/submissions */
const listSubmissions = async (req, res) => {
  const submissions = await Submission.find({ assignment: req.params.id })
    .populate({ path: 'student', select: 'rollNo className', populate: { path: 'user', select: 'name email' } })
    .sort({ submittedAt: -1 })
    .lean();
  return ok(res, submissions);
};

/** POST /api/assignments/:id/remind — WhatsApp + in-app reminder for pending students */
const remindPending = async (req, res) => {
  const assignment = await Assignment.findById(req.params.id).populate('subject', 'name');
  if (!assignment) throw ApiError.notFound('Assignment not found.');

  const students = await Student.find({ className: assignment.className, status: 'active' }).lean();
  const submissions = await Submission.find({ assignment: assignment._id }).lean();
  const submitted = new Set(submissions.map((s) => String(s.student)));
  const pending = students.filter((s) => !submitted.has(String(s._id)));

  await Promise.all(
    pending.map((student) =>
      notify({
        user: student.user,
        title: `Reminder: ${assignment.title}`,
        message: `Due ${new Date(assignment.dueDate).toLocaleDateString('en-IN')} — not submitted yet.`,
        type: 'assignment',
        priority: 'high',
        link: `/student/assignments/${assignment._id}`,
      })
    )
  );

  return ok(res, { reminded: pending.length, students: pending.map((s) => s.rollNo) });
};

module.exports = {
  listAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  gradeSubmission,
  listSubmissions,
  remindPending,
};

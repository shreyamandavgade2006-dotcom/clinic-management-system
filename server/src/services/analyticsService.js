'use strict';

const env = require('../config/env');
const Attendance = require('../models/Attendance');
const Mark = require('../models/Mark');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Exam = require('../models/Exam');
const { computeGrade } = require('../models/Mark');

/* ------------------------------------------------------------------ *
 * attendance
 * ------------------------------------------------------------------ */

/**
 * Attendance policy used everywhere in the app:
 *   • `present` and `late` count as attended.
 *   • `excused` (approved leave) is excluded from the denominator.
 *   • `absent` lowers the percentage.
 */
const ATTENDANCE_POLICY = {
  attendedStatuses: ['present', 'late'],
  countsAsAbsent: ['absent'],
  excludedFromDenominator: ['excused'],
  threshold: env.attendanceThreshold,
};

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const pct = (part, total) => (total > 0 ? round((part / total) * 100) : 0);

const isCountedSession = (record) => !ATTENDANCE_POLICY.excludedFromDenominator.includes(record.status);
const isAttended = (record) => ATTENDANCE_POLICY.attendedStatuses.includes(record.status);

/** Aggregate a list of raw attendance records into a summary object. */
function summariseAttendance(records) {
  const counted = records.filter(isCountedSession);
  const present = counted.filter((r) => r.status === 'present').length;
  const late = counted.filter((r) => r.status === 'late').length;
  const absent = counted.filter((r) => r.status === 'absent').length;
  const excused = records.length - counted.length;
  const attended = present + late;

  return {
    totalSessions: counted.length,
    attended,
    present,
    late,
    absent,
    excused,
    percentage: pct(attended, counted.length),
    belowThreshold: counted.length > 0 && pct(attended, counted.length) < ATTENDANCE_POLICY.threshold,
    threshold: ATTENDANCE_POLICY.threshold,
  };
}

const groupBy = (items, keyFn) =>
  items.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

const monthKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthlyTrend(records, months = 6) {
  const buckets = groupBy(records, (r) => monthKey(r.date));
  return Object.keys(buckets)
    .sort()
    .slice(-months)
    .map((key) => {
      const summary = summariseAttendance(buckets[key]);
      const [year, month] = key.split('-');
      return {
        key,
        month: `${MONTH_LABELS[Number(month) - 1]} ${year}`,
        percentage: summary.percentage,
        present: summary.attended,
        total: summary.totalSessions,
      };
    });
}

/** Full attendance picture for one student (optionally filtered). */
async function attendanceSummaryForStudent(studentId, { subjectId, from, to } = {}) {
  const query = { student: studentId };
  if (subjectId) query.subject = subjectId;
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }

  const records = await Attendance.find(query).populate('subject', 'name code shortName color').lean();
  const overall = summariseAttendance(records);

  const bySubject = groupBy(records, (r) => String(r.subject?._id || r.subject));
  const subjectWise = Object.entries(bySubject)
    .map(([key, list]) => {
      const summary = summariseAttendance(list);
      const subject = list[0]?.subject;
      return {
        subjectId: key,
        name: subject?.name || 'Subject',
        code: subject?.code || '',
        shortName: subject?.shortName || subject?.code || 'Subject',
        color: subject?.color || '#6366f1',
        ...summary,
      };
    })
    .sort((a, b) => a.percentage - b.percentage);

  const monthly = monthlyTrend(records);

  const recent = [...records]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 20)
    .map((r) => ({
      _id: r._id,
      date: r.date,
      status: r.status,
      period: r.period,
      subject: r.subject?.name || '',
      subjectCode: r.subject?.code || '',
      remarks: r.remarks,
    }));

  return { overall, subjectWise, monthly, recent, policy: ATTENDANCE_POLICY };
}

/** Class-level attendance board + defaulters (< threshold). */
async function attendanceSummaryForClass(className, { subjectId, threshold = ATTENDANCE_POLICY.threshold } = {}) {
  const students = await Student.find({ className, status: 'active' })
    .populate('user', 'name email avatar phone')
    .populate('subjects', 'name code shortName color')
    .lean();

  const query = { className };
  if (subjectId) query.subject = subjectId;
  const records = await Attendance.find(query).lean();

  const byStudent = groupBy(records, (r) => String(r.student));
  const subjectMap = new Map((await Subject.find({ className }).lean()).map((s) => [String(s._id), s]));

  const rows = students.map((student) => {
    const list = byStudent[String(student._id)] || [];
    const summary = summariseAttendance(list);
    const bySubject = groupBy(list, (r) => String(r.subject));
    const subjects = Object.entries(bySubject).map(([subjectIdKey, subjectRecords]) => {
      const subject = subjectMap.get(subjectIdKey);
      return {
        subjectId: subjectIdKey,
        code: subject?.code || '',
        name: subject?.name || 'Subject',
        percentage: summariseAttendance(subjectRecords).percentage,
        attended: summariseAttendance(subjectRecords).attended,
        total: summariseAttendance(subjectRecords).totalSessions,
      };
    });

    return {
      studentId: String(student._id),
      name: student.user?.name || student.rollNo,
      rollNo: student.rollNo,
      email: student.user?.email || '',
      avatar: student.user?.avatar || '',
      guardianPhone: student.guardian?.phone || '',
      ...summary,
      subjects,
      isDefaulter: summary.totalSessions > 0 && summary.percentage < threshold,
    };
  });

  const counted = records.filter(isCountedSession);
  const classAverage = rows.length
    ? round(rows.reduce((sum, row) => sum + row.percentage, 0) / rows.length)
    : 0;

  return {
    className,
    threshold,
    classAverage,
    totalStudents: rows.length,
    totalRecords: counted.length,
    defaulters: rows.filter((row) => row.isDefaulter).sort((a, b) => a.percentage - b.percentage),
    rows: rows.sort((a, b) => a.percentage - b.percentage),
    today: summariseAttendance(
      records.filter((r) => new Date(r.date).toDateString() === new Date().toDateString())
    ),
  };
}

/* ------------------------------------------------------------------ *
 * marks & performance
 * ------------------------------------------------------------------ */

const EXAM_TYPE_LABELS = {
  'unit-test': 'Unit Test',
  'mid-term': 'Mid Term',
  insem: 'In-Semester',
  endsem: 'End Semester',
  practical: 'Practical',
  oral: 'Oral',
  assignment: 'Assignment',
  internal: 'Internal',
};

/** Convert raw marks into weighted subject percentages + grades. */
function summariseMarks(marks) {
  if (!marks.length) {
    return { totalObtained: 0, totalMax: 0, percentage: 0, grade: '', gradePoints: 0, count: 0 };
  }

  // Group by exam type and weigh each exam type once, so 2 unit tests don't outweigh the endsem.
  const byType = groupBy(marks, (m) => m.examType);
  let weightedSum = 0;
  let weightTotal = 0;
  let rawObtained = 0;
  let rawMax = 0;

  for (const [examType, list] of Object.entries(byType)) {
    const obtained = list.reduce((sum, m) => sum + m.marksObtained, 0);
    const max = list.reduce((sum, m) => sum + m.maxMarks, 0);
    rawObtained += obtained;
    rawMax += max;
    const weight = Math.min(...list.map((m) => (m.weightage ?? 100) / 100)) || 1;
    weightedSum += (max > 0 ? obtained / max : 0) * weight;
    weightTotal += weight;
    void examType;
  }

  const percentage = weightTotal > 0 ? round((weightedSum / weightTotal) * 100) : pct(rawObtained, rawMax);
  const { grade, points } = computeGrade(percentage, 100);

  return {
    totalObtained: round(rawObtained),
    totalMax: round(rawMax),
    percentage,
    grade,
    gradePoints: points,
    count: marks.length,
  };
}

async function performanceForStudent(studentId) {
  const marks = await Mark.find({ student: studentId })
    .populate('subject', 'name code shortName color credits')
    .sort({ examDate: 1 })
    .lean();

  const bySubject = groupBy(marks, (m) => String(m.subject?._id || m.subject));
  const subjects = Object.entries(bySubject)
    .map(([key, list]) => {
      const subject = list[0]?.subject;
      const summary = summariseMarks(list);
      return {
        subjectId: key,
        name: subject?.name || 'Subject',
        code: subject?.code || '',
        shortName: subject?.shortName || subject?.code || 'Subject',
        color: subject?.color || '#6366f1',
        credits: subject?.credits || 4,
        ...summary,
        exams: list.map((m) => ({
          _id: m._id,
          examType: m.examType,
          examLabel: EXAM_TYPE_LABELS[m.examType] || m.examType,
          title: m.title,
          marksObtained: m.marksObtained,
          maxMarks: m.maxMarks,
          percentage: pct(m.marksObtained, m.maxMarks),
          examDate: m.examDate,
        })),
      };
    })
    .sort((a, b) => b.percentage - a.percentage);

  const graded = subjects.filter((s) => s.count > 0);
  const creditTotal = graded.reduce((sum, s) => sum + s.credits, 0);
  const weightedPoints = graded.reduce((sum, s) => sum + s.gradePoints * s.credits, 0);
  const cgpa = creditTotal > 0 ? round(weightedPoints / creditTotal, 2) : 0;
  const overallPercentage = graded.length
    ? round(graded.reduce((sum, s) => sum + s.percentage, 0) / graded.length)
    : 0;

  const trend = (() => {
    const byDate = {};
    marks.forEach((m) => {
      const key = monthKey(m.examDate);
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(m);
    });
    return Object.keys(byDate)
      .sort()
      .map((key) => {
        const list = byDate[key];
        const obtained = list.reduce((sum, m) => sum + m.marksObtained, 0);
        const max = list.reduce((sum, m) => sum + m.maxMarks, 0);
        const [year, month] = key.split('-');
        return {
          key,
          month: `${MONTH_LABELS[Number(month) - 1]} ${year}`,
          percentage: pct(obtained, max),
        };
      });
  })();

  const byExamType = Object.entries(groupBy(marks, (m) => m.examType)).map(([examType, list]) => {
    const obtained = list.reduce((sum, m) => sum + m.marksObtained, 0);
    const max = list.reduce((sum, m) => sum + m.maxMarks, 0);
    return {
      examType,
      label: EXAM_TYPE_LABELS[examType] || examType,
      percentage: pct(obtained, max),
      obtained: round(obtained),
      max: round(max),
      count: list.length,
    };
  });

  return {
    overallPercentage,
    cgpa,
    totalExams: marks.length,
    subjects: graded,
    allSubjects: subjects,
    strongSubjects: [...graded].sort((a, b) => b.percentage - a.percentage).slice(0, 3),
    weakSubjects: [...graded].sort((a, b) => a.percentage - b.percentage).slice(0, 3),
    trend,
    byExamType,
    results: graded.map((s) => ({
      subjectId: s.subjectId,
      subject: s.shortName,
      name: s.name,
      credits: s.credits,
      percentage: s.percentage,
      grade: s.grade,
      gradePoints: s.gradePoints,
      status: s.percentage >= 40 ? 'PASS' : 'FAIL',
    })),
    creditsEarned: graded.filter((s) => s.percentage >= 40).reduce((sum, s) => sum + s.credits, 0),
    creditsTotal: graded.reduce((sum, s) => sum + s.credits, 0),
  };
}

/** Class analytics: subject averages, toppers, distribution, grade spread. */
async function performanceForClass(className, { subjectId } = {}) {
  const students = await Student.find({ className, status: 'active' })
    .populate('user', 'name email avatar')
    .lean();
  const subjects = await Subject.find({ className }).lean();

  const markQuery = { className };
  if (subjectId) markQuery.subject = subjectId;
  const marks = await Mark.find(markQuery).lean();

  const subjectMap = new Map(subjects.map((s) => [String(s._id), s]));
  const byStudent = groupBy(marks, (m) => String(m.student));
  const bySubject = groupBy(marks, (m) => String(m.subject));

  const studentRows = students
    .map((student) => {
      const list = byStudent[String(student._id)] || [];
      const summary = summariseMarks(list);
      return {
        studentId: String(student._id),
        name: student.user?.name || student.rollNo,
        rollNo: student.rollNo,
        avatar: student.user?.avatar || '',
        percentage: summary.percentage,
        grade: summary.grade,
        exams: summary.count,
      };
    })
    .filter((row) => row.exams > 0)
    .sort((a, b) => b.percentage - a.percentage)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const subjectAverages = Object.entries(bySubject).map(([key, list]) => {
    const subject = subjectMap.get(key) || list[0].subject;
    const summary = summariseMarks(list);
    return {
      subjectId: key,
      name: subject?.name || 'Subject',
      shortName: subject?.shortName || subject?.code || 'Subject',
      code: subject?.code || '',
      color: subject?.color || '#6366f1',
      average: summary.percentage,
      highest: round(Math.max(...list.map((m) => pct(m.marksObtained, m.maxMarks)))),
      lowest: round(Math.min(...list.map((m) => pct(m.marksObtained, m.maxMarks)))),
      attempts: list.length,
    };
  });

  const distribution = [
    { range: '90-100', label: 'O', count: studentRows.filter((r) => r.percentage >= 90).length },
    { range: '80-89', label: 'A+', count: studentRows.filter((r) => r.percentage >= 80 && r.percentage < 90).length },
    { range: '70-79', label: 'A', count: studentRows.filter((r) => r.percentage >= 70 && r.percentage < 80).length },
    { range: '60-69', label: 'B+', count: studentRows.filter((r) => r.percentage >= 60 && r.percentage < 70).length },
    { range: '50-59', label: 'B', count: studentRows.filter((r) => r.percentage >= 50 && r.percentage < 60).length },
    { range: '40-49', label: 'C', count: studentRows.filter((r) => r.percentage >= 40 && r.percentage < 50).length },
    { range: '0-39', label: 'F', count: studentRows.filter((r) => r.percentage < 40).length },
  ];

  const classAverage = studentRows.length
    ? round(studentRows.reduce((sum, r) => sum + r.percentage, 0) / studentRows.length)
    : 0;

  return {
    className,
    classAverage,
    passPercentage: studentRows.length
      ? pct(studentRows.filter((r) => r.percentage >= 40).length, studentRows.length)
      : 0,
    subjectAverages: subjectAverages.sort((a, b) => b.average - a.average),
    students: studentRows,
    toppers: studentRows.slice(0, 5),
    needsAttention: [...studentRows].sort((a, b) => a.percentage - b.percentage).slice(0, 5),
    distribution,
    totalMarksRecords: marks.length,
  };
}

/* ---------------------------------------------------------------- *
 * toppers / aggregates used by dashboards
 * ---------------------------------------------------------------- */

async function rankStudents(className, limit = 5) {
  const { students } = await performanceForClass(className);
  return students.slice(0, limit);
}

/** Everything a teacher dashboard needs in one call. */
async function teacherOverview(teacher) {
  const classes = teacher.classes && teacher.classes.length ? teacher.classes : await Student.distinct('className');
  const subjects = await Subject.find({ teacher: teacher._id }).lean();

  const [studentCount, attendanceRecords, assignments, pendingGrading, quizzes, exams] = await Promise.all([
    Student.countDocuments({ className: { $in: classes }, status: 'active' }),
    Attendance.find({ className: { $in: classes } }).lean(),
    Assignment.find({ teacher: teacher._id, status: 'published' }).populate('subject', 'name code color').sort({ dueDate: -1 }).limit(5).lean(),
    Submission.countDocuments({ status: { $in: ['submitted', 'late'] } }),
    Quiz.find({ teacher: teacher._id }).sort({ createdAt: -1 }).limit(5).lean(),
    Exam.find({ className: { $in: classes }, date: { $gte: new Date() } }).populate('subject', 'name code color').sort({ date: 1 }).limit(5).lean(),
  ]);

  const overall = summariseAttendance(attendanceRecords);
  const byDate = groupBy(attendanceRecords, (r) => new Date(r.date).toDateString());
  const recentTrend = Object.entries(byDate)
    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
    .slice(-10)
    .map(([date, list]) => ({
      date,
      label: new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      percentage: summariseAttendance(list).percentage,
    }));

  const classSummaries = [];
  for (const className of classes.slice(0, 6)) {
    const summary = await attendanceSummaryForClass(className);
    classSummaries.push({
      className,
      students: summary.totalStudents,
      attendance: summary.classAverage,
      defaulters: summary.defaulters.length,
    });
  }

  return {
    classes,
    classCount: classes.length,
    subjectCount: subjects.length,
    studentCount,
    attendance: overall,
    attendanceTrend: recentTrend,
    classSummaries,
    defaultersCount: classSummaries.reduce((sum, c) => sum + c.defaulters, 0),
    recentAssignments: assignments,
    pendingGrading,
    recentQuizzes: quizzes,
    upcomingExams: exams,
    toppers: await rankStudents(classes[0] || '', 5),
  };
}

/** Everything a student dashboard needs in one call. */
async function studentOverview(student) {
  const [attendance, performance, assignments, submissions, upcomingExams, quizzes, attempts] = await Promise.all([
    attendanceSummaryForStudent(student._id),
    performanceForStudent(student._id),
    Assignment.find({ className: student.className, status: 'published' })
      .populate('subject', 'name code color shortName')
      .sort({ dueDate: 1 })
      .lean(),
    Submission.find({ student: student._id }).lean(),
    Exam.find({ className: student.className, date: { $gte: new Date() }, status: 'scheduled' })
      .populate('subject', 'name code color')
      .sort({ date: 1 })
      .lean(),
    Quiz.find({ className: student.className, status: 'published' })
      .populate('subject', 'name code color')
      .sort({ dueDate: 1 })
      .lean(),
    QuizAttempt.find({ student: student._id }).populate('quiz', 'title totalMarks subject').lean(),
  ]);

  const submittedAssignmentIds = new Set(submissions.map((s) => String(s.assignment)));
  const pendingAssignments = assignments.filter((a) => !submittedAssignmentIds.has(String(a._id)));
  const overdue = pendingAssignments.filter((a) => new Date(a.dueDate) < new Date());
  const now = Date.now();
  const attemptedQuizIds = new Set(attempts.map((a) => String(a.quiz?._id || a.quiz)));
  const pendingQuizzes = quizzes.filter((q) => !attemptedQuizIds.has(String(q._id)));
  const averageQuizScore = attempts.length
    ? round(attempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / attempts.length)
    : 0;

  return {
    attendance: attendance.overall,
    attendanceBySubject: attendance.subjectWise,
    attendanceTrend: attendance.monthly,
    performance: {
      overallPercentage: performance.overallPercentage,
      cgpa: performance.cgpa,
      strongSubjects: performance.strongSubjects,
      weakSubjects: performance.weakSubjects,
      trend: performance.trend,
      subjects: performance.subjects,
      results: performance.results,
    },
    assignments: {
      total: assignments.length,
      pending: pendingAssignments.length,
      overdue: overdue.length,
      upcoming: pendingAssignments
        .filter((a) => new Date(a.dueDate) >= new Date())
        .slice(0, 5)
        .map((a) => ({
          _id: a._id,
          title: a.title,
          subject: a.subject?.name || '',
          subjectCode: a.subject?.code || '',
          color: a.subject?.color || '#6366f1',
          dueDate: a.dueDate,
          daysLeft: Math.ceil((new Date(a.dueDate) - now) / 86400000),
        })),
    },
    exams: {
      upcoming: upcomingExams.slice(0, 5).map((e) => ({
        _id: e._id,
        title: e.title,
        subject: e.subject?.name || '',
        color: e.subject?.color || '#6366f1',
        date: e.date,
        startTime: e.startTime,
        daysLeft: Math.ceil((new Date(e.date) - now) / 86400000),
        type: e.type,
        room: e.room,
      })),
      total: upcomingExams.length,
    },
    quizzes: {
      total: quizzes.length,
      pending: pendingQuizzes.length,
      attempted: attempts.length,
      averageScore: averageQuizScore,
      recent: attempts
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map((a) => ({
          _id: a._id,
          title: a.quiz?.title || 'Quiz',
          score: a.score,
          totalMarks: a.totalMarks,
          percentage: a.percentage,
          grade: a.grade,
          submittedAt: a.submittedAt,
        })),
    },
  };
}

module.exports = {
  ATTENDANCE_POLICY,
  EXAM_TYPE_LABELS,
  round,
  pct,
  summariseAttendance,
  summariseMarks,
  attendanceSummaryForStudent,
  attendanceSummaryForClass,
  performanceForStudent,
  performanceForClass,
  teacherOverview,
  studentOverview,
  monthlyTrend,
  monthKey,
  groupBy,
};

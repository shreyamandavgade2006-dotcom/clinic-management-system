'use strict';

/**
 * Demo data for the Smart Student Management System.
 *
 * Generates a realistic semester for one class (TE-A, Computer Engineering):
 *   • 3 teachers + 12 students with guardian WhatsApp numbers
 *   • 5 subjects with units/topics (used by the AI generator)
 *   • ~8 weeks of attendance (3 students deliberately below 75%)
 *   • marks for unit tests, insem and practicals
 *   • assignments + submissions, exams, announcements, quizzes + attempts
 */

const bcrypt = require('bcryptjs');
const env = require('../config/env');
const User = require('../models/User');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const Mark = require('../models/Mark');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Exam = require('../models/Exam');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Announcement = require('../models/Announcement');
const Notification = require('../models/Notification');
const WhatsAppLog = require('../models/WhatsAppLog');
const { computeGrade } = require('../models/Mark');
const { generateLocally } = require('../services/aiService');

const CLASS_NAME = 'TE-A';
const DEPARTMENT = 'Computer Engineering';

/* --------------------------- deterministic RNG --------------------------- */
let seed = 20240517;
const random = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const randInt = (min, max) => Math.floor(random() * (max - min + 1)) + min;
const pick = (list) => list[randInt(0, list.length - 1)];

/* ------------------------------- people ------------------------------- */
const TEACHERS = [
  {
    name: 'Dr. Priya Sharma',
    email: 'priya.sharma@ssms.edu',
    employeeId: 'FAC-001',
    designation: 'Associate Professor',
    qualification: 'Ph.D. (Computer Engineering)',
    experienceYears: 12,
    phone: '+919820011001',
    cabin: 'B-204',
    classes: [CLASS_NAME],
    about: 'Database systems and data engineering. Believes in project-based learning.',
  },
  {
    name: 'Prof. Rahul Deshmukh',
    email: 'rahul.deshmukh@ssms.edu',
    employeeId: 'FAC-002',
    designation: 'Assistant Professor',
    qualification: 'M.E. (Computer Science)',
    experienceYears: 7,
    phone: '+919820011002',
    cabin: 'B-206',
    classes: [CLASS_NAME],
    about: 'Algorithms, AI and competitive programming mentor.',
  },
  {
    name: 'Dr. Anjali Menon',
    email: 'anjali.menon@ssms.edu',
    employeeId: 'FAC-003',
    designation: 'Professor',
    qualification: 'Ph.D. (Networks)',
    experienceYears: 15,
    phone: '+919820011003',
    cabin: 'B-201',
    classes: [CLASS_NAME],
    about: 'Computer networks and distributed systems researcher.',
  },
];

const STUDENTS = [
  { name: 'Aarav Patil', rollNo: 'TE-A-001', gender: 'male', guardian: { name: 'Suresh Patil', relation: 'Father', phone: '+919000000001' } },
  { name: 'Isha Kulkarni', rollNo: 'TE-A-002', gender: 'female', guardian: { name: 'Vaishali Kulkarni', relation: 'Mother', phone: '+919000000002' } },
  { name: 'Rohan Jadhav', rollNo: 'TE-A-003', gender: 'male', guardian: { name: 'Mahesh Jadhav', relation: 'Father', phone: '+919000000003' } },
  { name: 'Sara Khan', rollNo: 'TE-A-004', gender: 'female', guardian: { name: 'Imran Khan', relation: 'Father', phone: '+919000000004' } },
  { name: 'Meera Nair', rollNo: 'TE-A-005', gender: 'female', guardian: { name: 'Suresh Nair', relation: 'Father', phone: '+919000000005' } },
  { name: 'Aditya Rane', rollNo: 'TE-A-006', gender: 'male', guardian: { name: 'Prakash Rane', relation: 'Father', phone: '+919000000006' } },
  { name: 'Neha Bhosale', rollNo: 'TE-A-007', gender: 'female', guardian: { name: 'Sunil Bhosale', relation: 'Father', phone: '+919000000007' } },
  { name: 'Kabir Singh', rollNo: 'TE-A-008', gender: 'male', guardian: { name: 'Harpreet Singh', relation: 'Mother', phone: '+919000000008' } },
  { name: 'Ananya Iyer', rollNo: 'TE-A-009', gender: 'female', guardian: { name: 'Raghav Iyer', relation: 'Father', phone: '+919000000009' } },
  { name: 'Yash Chavan', rollNo: 'TE-A-010', gender: 'male', guardian: { name: 'Dilip Chavan', relation: 'Father', phone: '+919000000010' } },
  { name: 'Diya Mehta', rollNo: 'TE-A-011', gender: 'female', guardian: { name: 'Nilesh Mehta', relation: 'Father', phone: '+919000000011' } },
  { name: 'Vivaan Joshi', rollNo: 'TE-A-012', gender: 'male', guardian: { name: 'Anil Joshi', relation: 'Father', phone: '+919000000012' } },
];

/* attendance profile: index → attendance probability (three students below 75%) */
const ATTENDANCE_PROFILE = [0.93, 0.95, 0.62, 0.88, 0.97, 0.58, 0.9, 0.85, 0.92, 0.7, 0.94, 0.89];

/* ------------------------------ subjects ------------------------------ */
const SUBJECTS = [
  {
    code: 'CS501',
    name: 'Database Management Systems',
    shortName: 'DBMS',
    color: '#6366f1',
    credits: 4,
    teacherIndex: 0,
    units: [
      { unitNo: 1, title: 'Unit 1 — Introduction & ER Modelling', topics: ['Database architecture', 'ER model', 'Entity relationship diagrams', 'Keys and constraints'] },
      { unitNo: 2, title: 'Unit 2 — Relational Model & SQL', topics: ['Relational algebra', 'SQL joins', 'Nested queries', 'Views and indexes'] },
      { unitNo: 3, title: 'Unit 3 — Normalization', topics: ['Functional dependencies', '1NF 2NF 3NF', 'BCNF', 'Decomposition'] },
      { unitNo: 4, title: 'Unit 4 — Transactions & Concurrency', topics: ['ACID properties', 'Concurrency control', 'Deadlock handling', 'Recovery techniques'] },
      { unitNo: 5, title: 'Unit 5 — NoSQL & Big Data', topics: ['CAP theorem', 'MongoDB document model', 'Sharding and replication'] },
    ],
  },
  {
    code: 'CS502',
    name: 'Design and Analysis of Algorithms',
    shortName: 'DAA',
    color: '#0ea5e9',
    credits: 4,
    teacherIndex: 1,
    units: [
      { unitNo: 1, title: 'Unit 1 — Complexity Analysis', topics: ['Asymptotic notation', 'Recurrence relations', 'Master theorem'] },
      { unitNo: 2, title: 'Unit 2 — Divide and Conquer', topics: ['Merge sort', 'Quick sort', 'Binary search', 'Strassen algorithm'] },
      { unitNo: 3, title: 'Unit 3 — Greedy & Dynamic Programming', topics: ['Knapsack problem', 'Huffman coding', 'LCS', 'Matrix chain multiplication'] },
      { unitNo: 4, title: 'Unit 4 — Graph Algorithms', topics: ['Dijkstra algorithm', 'Minimum spanning tree', 'Floyd Warshall', 'Network flow'] },
      { unitNo: 5, title: 'Unit 5 — NP Completeness', topics: ['P versus NP', 'Reductions', 'Approximation algorithms'] },
    ],
  },
  {
    code: 'CS503',
    name: 'Computer Networks',
    shortName: 'CN',
    color: '#10b981',
    credits: 4,
    teacherIndex: 2,
    units: [
      { unitNo: 1, title: 'Unit 1 — Network Fundamentals', topics: ['OSI model', 'TCP/IP stack', 'Transmission media', 'Switching techniques'] },
      { unitNo: 2, title: 'Unit 2 — Data Link Layer', topics: ['Error detection', 'Sliding window protocol', 'Ethernet', 'MAC addressing'] },
      { unitNo: 3, title: 'Unit 3 — Network Layer', topics: ['IPv4 and IPv6 addressing', 'Routing algorithms', 'Subnetting', 'ICMP'] },
      { unitNo: 4, title: 'Unit 4 — Transport Layer', topics: ['TCP three-way handshake', 'Congestion control', 'UDP', 'Sockets'] },
      { unitNo: 5, title: 'Unit 5 — Application Layer & Security', topics: ['HTTP and DNS', 'TLS handshake', 'Firewalls', 'VPN'] },
    ],
  },
  {
    code: 'CS504',
    name: 'Operating Systems',
    shortName: 'OS',
    color: '#f59e0b',
    credits: 3,
    teacherIndex: 0,
    units: [
      { unitNo: 1, title: 'Unit 1 — Processes & Threads', topics: ['Process lifecycle', 'Context switching', 'Threads', 'Inter process communication'] },
      { unitNo: 2, title: 'Unit 2 — CPU Scheduling', topics: ['Round robin', 'Priority scheduling', 'Deadlock avoidance', 'Semaphores'] },
      { unitNo: 3, title: 'Unit 3 — Memory Management', topics: ['Paging', 'Segmentation', 'Virtual memory', 'Page replacement algorithms'] },
      { unitNo: 4, title: 'Unit 4 — File Systems', topics: ['File allocation methods', 'Disk scheduling', 'Journaling'] },
    ],
  },
  {
    code: 'CS505',
    name: 'Software Engineering & Project Management',
    shortName: 'SEPM',
    color: '#ec4899',
    credits: 3,
    teacherIndex: 1,
    units: [
      { unitNo: 1, title: 'Unit 1 — SDLC Models', topics: ['Waterfall model', 'Agile and Scrum', 'Spiral model', 'Requirement engineering'] },
      { unitNo: 2, title: 'Unit 2 — Design & Testing', topics: ['UML diagrams', 'Design patterns', 'Unit testing', 'Black box testing'] },
      { unitNo: 3, title: 'Unit 3 — Project Management', topics: ['COCOMO estimation', 'Risk management', 'Configuration management', 'DevOps basics'] },
    ],
  },
];

/* ------------------------------ helpers ------------------------------ */
const startOfDay = (date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

const isWorkingDay = (date) => date.getDay() !== 0; // Sunday off

/* ------------------------------- seeding ------------------------------- */
async function seedDatabase({ fresh = false } = {}) {
  if (fresh) {
    await Promise.all([
      User.deleteMany({}),
      Student.deleteMany({}),
      Teacher.deleteMany({}),
      Subject.deleteMany({}),
      Attendance.deleteMany({}),
      Mark.deleteMany({}),
      Assignment.deleteMany({}),
      Submission.deleteMany({}),
      Exam.deleteMany({}),
      Quiz.deleteMany({}),
      QuizAttempt.deleteMany({}),
      Announcement.deleteMany({}),
      Notification.deleteMany({}),
      WhatsAppLog.deleteMany({}),
    ]);
  }

  seed = 20240517;
  const today = startOfDay(new Date());
  const counts = {};

  /* ------------------------------ teachers ------------------------------ */
  const teacherDocs = [];
  for (const teacher of TEACHERS) {
    const user = await User.create({
      name: teacher.name,
      email: teacher.email,
      password: await bcrypt.hash(env.seedPasswordTeacher, 10),
      role: 'teacher',
      phone: teacher.phone,
    });
    const doc = await Teacher.create({
      user: user._id,
      employeeId: teacher.employeeId,
      designation: teacher.designation,
      department: DEPARTMENT,
      qualification: teacher.qualification,
      experienceYears: teacher.experienceYears,
      phone: teacher.phone,
      cabin: teacher.cabin,
      classes: teacher.classes,
      about: teacher.about,
    });
    teacherDocs.push({ doc, user });
  }
  counts.teachers = teacherDocs.length;

  /* ------------------------------ subjects ------------------------------ */
  const subjectDocs = [];
  for (const subject of SUBJECTS) {
    const teacherIndex = subject.teacherIndex ?? subjectDocs.length % teacherDocs.length;
    const doc = await Subject.create({
      code: subject.code,
      name: subject.name,
      shortName: subject.shortName,
      department: DEPARTMENT,
      semester: 5,
      credits: subject.credits,
      className: CLASS_NAME,
      teacher: teacherDocs[teacherIndex].doc._id,
      units: subject.units,
      color: subject.color,
      maxMarks: 100,
    });
    subjectDocs.push(doc);
    await Teacher.findByIdAndUpdate(teacherDocs[teacherIndex].doc._id, { $addToSet: { subjects: doc._id, classes: CLASS_NAME } });
  }
  counts.subjects = subjectDocs.length;

  /* ------------------------------ students ------------------------------ */
  const studentDocs = [];
  for (const [index, student] of STUDENTS.entries()) {
    const email = `${student.name.toLowerCase().replace(/[^a-z]+/g, '.')}@ssms.edu`;
    const user = await User.create({
      name: student.name,
      email,
      password: await bcrypt.hash(env.seedPasswordStudent, 10),
      role: 'student',
      phone: `+91900000${String(index + 100).padStart(4, '0')}`,
    });

    const doc = await Student.create({
      user: user._id,
      rollNo: student.rollNo,
      admissionNo: `ADM2023${String(index + 1).padStart(3, '0')}`,
      className: CLASS_NAME,
      department: DEPARTMENT,
      semester: 5,
      division: 'A',
      batch: index % 3 === 0 ? 'B1' : index % 3 === 1 ? 'B2' : 'B3',
      gender: student.gender,
      dateOfBirth: new Date(2004, index % 12, randInt(1, 27)),
      bloodGroup: pick(['A+', 'B+', 'O+', 'AB+', 'O-']),
      address: `${randInt(1, 120)}, Shivaji Nagar, Pune 411005`,
      guardian: { ...student.guardian, email: `${student.guardian.name.split(' ')[0].toLowerCase()}@gmail.com`, whatsappOptIn: true },
      subjects: subjectDocs.map((s) => s._id),
      status: 'active',
    });
    studentDocs.push({ doc, user, attendanceRate: ATTENDANCE_PROFILE[index] ?? 0.9 });
  }
  counts.students = studentDocs.length;

  /* ----------------------------- attendance ----------------------------- */
  const periods = [1, 2, 3, 4];
  const attendanceRecords = [];
  const WEEKS = 9;

  let dayIndex = 0;
  for (let dayOffset = WEEKS * 7; dayOffset >= 0; dayOffset -= 1) {
    const date = addDays(today, -dayOffset);
    if (!isWorkingDay(date) || date > today) continue;
    dayIndex += 1;

    // every subject gets one lecture on the day, rotating across the four periods
    for (const [subjectIndex, subject] of subjectDocs.entries()) {
      const period = periods[(subjectIndex + dayIndex) % periods.length];

      for (const student of studentDocs) {
        // a little per-subject variation around the student's base rate
        const variation = (subjectIndex % 3) * 0.03 - 0.03;
        const probability = Math.min(0.99, Math.max(0.35, student.attendanceRate + variation));
        const roll = random();
        let status = 'present';
        if (roll > probability) status = 'absent';
        else if (roll > probability - 0.04) status = 'late';

        attendanceRecords.push({
          student: student.doc._id,
          subject: subject._id,
          teacher: subject.teacher,
          className: CLASS_NAME,
          date: startOfDay(date),
          period,
          status,
          method: 'manual',
          remarks: '',
        });
      }
    }
  }

  // insert in chunks (works for both MongoDB and the in-memory store)
  const chunkSize = 500;
  for (let i = 0; i < attendanceRecords.length; i += chunkSize) {
    await Attendance.insertMany(attendanceRecords.slice(i, i + chunkSize));
  }
  counts.attendanceRecords = attendanceRecords.length;

  /* ------------------------------- marks ------------------------------- */
  const examPlan = [
    { examType: 'unit-test', title: 'Unit Test 1', offsetDays: -45, maxMarks: 20, weightage: 20 },
    { examType: 'unit-test', title: 'Unit Test 2', offsetDays: -20, maxMarks: 20, weightage: 20 },
    { examType: 'insem', title: 'In-Semester Exam', offsetDays: -30, maxMarks: 30, weightage: 30 },
    { examType: 'practical', title: 'Practical Exam', offsetDays: -7, maxMarks: 25, weightage: 30 },
  ];

  const marksRecords = [];
  for (const [studentIndex, student] of studentDocs.entries()) {
    const ability = 0.55 + ((studentIndex * 7) % 40) / 100; // 0.55 → 0.94

    for (const subject of subjectDocs) {
      for (const exam of examPlan) {
        if (random() < 0.06) continue; // a few missing entries look realistic
        const noise = (random() - 0.5) * 0.25;
        const ratio = Math.min(0.99, Math.max(0.28, ability + noise));
        const marksObtained = Math.round(ratio * exam.maxMarks);
        const { grade } = computeGrade(marksObtained, exam.maxMarks);
        marksRecords.push({
          student: student.doc._id,
          subject: subject._id,
          teacher: subject.teacher,
          className: CLASS_NAME,
          semester: 5,
          examType: exam.examType,
          title: exam.title,
          marksObtained,
          maxMarks: exam.maxMarks,
          weightage: exam.weightage,
          grade,
          examDate: startOfDay(addDays(today, exam.offsetDays)),
          remarks: '',
        });
      }
    }
  }
  for (let i = 0; i < marksRecords.length; i += chunkSize) {
    await Mark.insertMany(marksRecords.slice(i, i + chunkSize));
  }
  counts.marksRecords = marksRecords.length;

  /* ---------------------------- assignments ---------------------------- */
  const assignmentPlan = [
    { title: 'ER Diagram for Library System', subjectIndex: 0, topic: 'Entity relationship diagrams', dueInDays: -3, totalMarks: 20, type: 'assignment' },
    { title: 'SQL Query Practice Set', subjectIndex: 0, topic: 'SQL joins', dueInDays: -12, totalMarks: 15, type: 'lab' },
    { title: 'Divide and Conquer Lab Report', subjectIndex: 1, topic: 'Merge sort', dueInDays: -15, totalMarks: 20, type: 'lab' },
    { title: 'Dynamic Programming Problem Set', subjectIndex: 1, topic: 'Knapsack problem', dueInDays: 3, totalMarks: 25, type: 'homework' },
    { title: 'Subnetting Worksheet', subjectIndex: 2, topic: 'Subnetting', dueInDays: -8, totalMarks: 15, type: 'assignment' },
    { title: 'Wireshark Packet Analysis', subjectIndex: 2, topic: 'TCP three-way handshake', dueInDays: 5, totalMarks: 20, type: 'lab' },
    { title: 'CPU Scheduling Simulation', subjectIndex: 3, topic: 'Round robin', dueInDays: -5, totalMarks: 20, type: 'project' },
    { title: 'SRS Document for Mini Project', subjectIndex: 4, topic: 'Requirement engineering', dueInDays: 7, totalMarks: 30, type: 'project' },
  ];

  const assignmentDocs = [];
  for (const plan of assignmentPlan) {
    const subject = subjectDocs[plan.subjectIndex];
    const doc = await Assignment.create({
      title: plan.title,
      description: `Complete "${plan.title}" covering ${plan.topic}. Submit a well-formatted PDF with your name and roll number.`,
      subject: subject._id,
      teacher: subject.teacher,
      className: CLASS_NAME,
      unit: subject.units[1]?.title || subject.units[0].title,
      topic: plan.topic,
      type: plan.type,
      totalMarks: plan.totalMarks,
      dueDate: startOfDay(addDays(today, plan.dueInDays)),
      status: 'published',
      allowLateSubmission: plan.dueInDays > 0,
      aiGenerated: false,
    });
    assignmentDocs.push(doc);
  }
  counts.assignments = assignmentDocs.length;

  for (const assignment of assignmentDocs) {
    for (const [studentIndex, student] of studentDocs.entries()) {
      const submissionProbability = 0.82 + (student.attendanceRate - 0.9) * 0.3;
      if (random() > submissionProbability) continue;

      const isPast = new Date(assignment.dueDate) < today;
      const late = isPast && random() < 0.12;
      const graded = isPast && random() < 0.75;
      const obtained = graded ? Math.max(4, Math.round((0.5 + ((studentIndex * 5) % 45) / 100 + (random() - 0.5) * 0.2) * assignment.totalMarks)) : null;

      await Submission.create({
        assignment: assignment._id,
        student: student.doc._id,
        className: CLASS_NAME,
        submittedAt: addDays(new Date(assignment.dueDate), late ? 1 : -randInt(1, 4)),
        content: `Submitted: ${assignment.title} by ${student.doc.rollNo}.`,
        status: graded ? 'graded' : late ? 'late' : 'submitted',
        marksObtained: obtained,
        feedback: graded ? pick(['Well structured answer.', 'Good effort — add more examples.', 'Excellent work!', 'Revise the basics.']) : '',
        gradedAt: graded ? new Date() : null,
      });
    }
  }

  /* ------------------------------- exams ------------------------------- */
  const examSchedule = [
    { title: 'DBMS Unit Test 3', subjectIndex: 0, inDays: 4, type: 'unit-test', totalMarks: 20, room: 'B-301' },
    { title: 'DAA Mid Semester', subjectIndex: 1, inDays: 9, type: 'mid-term', totalMarks: 30, room: 'B-302' },
    { title: 'CN Practical Viva', subjectIndex: 2, inDays: 13, type: 'practical', totalMarks: 25, room: 'Network Lab' },
    { title: 'OS Unit Test 2', subjectIndex: 3, inDays: -6, type: 'unit-test', totalMarks: 20, room: 'B-301' },
    { title: 'SEPM End Semester', subjectIndex: 4, inDays: 26, type: 'endsem', totalMarks: 70, room: 'Exam Hall 2' },
  ];

  for (const exam of examSchedule) {
    const subject = subjectDocs[exam.subjectIndex];
    await Exam.create({
      title: exam.title,
      subject: subject._id,
      teacher: subject.teacher,
      className: CLASS_NAME,
      type: exam.type,
      date: startOfDay(addDays(today, exam.inDays)),
      startTime: pick(['10:00', '11:30', '14:00']),
      durationMinutes: exam.type === 'endsem' ? 180 : 90,
      room: exam.room,
      totalMarks: exam.totalMarks,
      passingMarks: Math.round(exam.totalMarks * 0.4),
      syllabus: subject.units.slice(0, 3).map((unit) => unit.title),
      instructions: 'Bring your own stationery. Mobile phones are not allowed in the exam hall.',
      status: exam.inDays < 0 ? 'completed' : 'scheduled',
    });
  }
  counts.exams = examSchedule.length;

  /* --------------------------- AI quizzes --------------------------- */
  const quizPlan = [
    {
      teacherIndex: 0,
      subjectIndex: 0,
      unit: 'Unit 3 — Normalization',
      topics: ['Functional dependencies', '1NF 2NF 3NF', 'BCNF'],
      difficulty: 'medium',
      questionType: 'mcq',
      count: 6,
      totalMarks: 6,
      paperType: 'quiz',
      status: 'published',
      showAnswers: true,
      dueInDays: 6,
      attemptRate: 0.8,
    },
    {
      teacherIndex: 1,
      subjectIndex: 1,
      unit: 'Unit 4 — Graph Algorithms',
      topics: ['Dijkstra algorithm', 'Minimum spanning tree'],
      difficulty: 'hard',
      questionType: 'mcq',
      count: 5,
      totalMarks: 10,
      paperType: 'assessment',
      status: 'published',
      showAnswers: true,
      dueInDays: 10,
      attemptRate: 0.65,
    },
    {
      teacherIndex: 2,
      subjectIndex: 2,
      unit: 'Unit 1 — Network Fundamentals',
      topics: ['OSI model', 'TCP/IP stack'],
      difficulty: 'easy',
      questionType: 'mcq',
      count: 5,
      totalMarks: 5,
      paperType: 'quiz',
      status: 'published',
      showAnswers: true,
      dueInDays: 4,
      attemptRate: 0.7,
    },
    {
      teacherIndex: 2,
      subjectIndex: 4,
      unit: 'Unit 1 — Software Process Models',
      topics: ['Agile process', 'Software requirement specification'],
      difficulty: 'medium',
      questionType: 'mcq',
      count: 5,
      totalMarks: 5,
      paperType: 'quiz',
      status: 'published',
      showAnswers: true,
      dueInDays: 9,
      attemptRate: 0.45,
    },
    // deliberately left unattempted so the demo students always have a quiz to try
    {
      teacherIndex: 0,
      subjectIndex: 0,
      unit: 'Unit 2 — Relational Model & SQL',
      topics: ['SQL joins', 'Views and indexes'],
      difficulty: 'easy',
      questionType: 'mcq',
      count: 5,
      totalMarks: 5,
      paperType: 'quiz',
      status: 'published',
      showAnswers: true,
      dueInDays: 12,
      attemptRate: 0,
    },
    {
      teacherIndex: 0,
      subjectIndex: 3,
      unit: 'Unit 2 — CPU Scheduling',
      topics: ['Round robin', 'Semaphores'],
      difficulty: 'medium',
      questionType: 'mixed',
      count: 6,
      totalMarks: 20,
      paperType: 'question-paper',
      status: 'draft',
      showAnswers: false,
      dueInDays: 15,
      attemptRate: 0,
    },
  ];

  const quizDocs = [];
  for (const plan of quizPlan) {
    const subject = subjectDocs[plan.subjectIndex];
    const generated = generateLocally({
      subject: subject.name,
      unit: plan.unit,
      topics: plan.topics,
      difficulty: plan.difficulty,
      questionType: plan.questionType,
      count: plan.count,
      totalMarks: plan.totalMarks,
      paperType: plan.paperType,
      durationMinutes: plan.count * 2,
    });

    const doc = await Quiz.create({
      title: generated.title,
      description: `AI generated ${plan.paperType} covering ${plan.topics.join(', ')}.`,
      subject: subject._id,
      teacher: teacherDocs[plan.teacherIndex].doc._id,
      className: CLASS_NAME,
      unit: plan.unit,
      topic: plan.topics.join(', '),
      difficulty: plan.difficulty,
      questionType: plan.questionType,
      paperType: plan.paperType,
      totalMarks: generated.totalMarks,
      durationMinutes: plan.count * 2,
      questions: generated.questions,
      instructions: generated.instructions,
      aiGenerated: true,
      aiProvider: 'local',
      aiModel: 'built-in-template-generator',
      status: plan.status,
      showAnswers: plan.showAnswers,
      availableFrom: addDays(today, -5),
      dueDate: addDays(today, plan.dueInDays),
      maxAttempts: 1,
    });
    quizDocs.push({ doc, plan, subject });
  }
  counts.quizzes = quizDocs.length;

  /* --------------------------- quiz attempts --------------------------- */
  let attemptTotal = 0;
  for (const { doc: quiz, plan } of quizDocs) {
    if (plan.status !== 'published') continue;

    for (const [studentIndex, student] of studentDocs.entries()) {
      if (random() > plan.attemptRate) continue;

      const answerQuality = Math.min(0.98, Math.max(0.2, 0.45 + ((studentIndex * 9) % 50) / 100 + (random() - 0.5) * 0.2));
      const answers = quiz.questions.map((question, index) => {
        const isCorrect = random() < answerQuality;
        const correctIndex = question.options.indexOf(question.correctAnswer);
        let answer = question.correctAnswer;
        if (!isCorrect) {
          const wrongOptions = question.options.filter((option, optionIndex) => optionIndex !== correctIndex);
          answer = wrongOptions.length ? pick(wrongOptions) : 'Not attempted';
        }
        void index;
        return {
          questionId: String(question._id),
          questionText: question.questionText,
          answer,
          correctAnswer: question.correctAnswer,
          isCorrect: answer === question.correctAnswer,
          marksAwarded: answer === question.correctAnswer ? question.marks : 0,
          maxMarks: question.marks,
          needsManualReview: false,
          feedback: answer === question.correctAnswer ? 'Correct' : `Incorrect — correct answer: ${question.correctAnswer}`,
        };
      });

      const score = answers.reduce((sum, a) => sum + a.marksAwarded, 0);
      const totalMarks = quiz.questions.reduce((sum, q) => sum + q.marks, 0);
      const percentage = Math.round((score / (totalMarks || 1)) * 1000) / 10;
      const { grade } = computeGrade(score, totalMarks || 1);
      const correctCount = answers.filter((a) => a.isCorrect).length;

      const topicMap = new Map();
      quiz.questions.forEach((question, index) => {
        const key = question.topic || quiz.unit;
        const entry = topicMap.get(key) || { topic: key, correct: 0, total: 0 };
        entry.total += 1;
        if (answers[index].isCorrect) entry.correct += 1;
        topicMap.set(key, entry);
      });

      await QuizAttempt.create({
        quiz: quiz._id,
        student: student.doc._id,
        className: CLASS_NAME,
        subject: quiz.subject,
        startedAt: addDays(today, -randInt(1, 5)),
        submittedAt: addDays(today, -randInt(0, 4)),
        timeTakenSeconds: randInt(60, quiz.durationMinutes * 60),
        answers,
        score,
        totalMarks,
        percentage,
        grade,
        correctCount,
        wrongCount: answers.length - correctCount,
        skippedCount: 0,
        status: 'evaluated',
        topicBreakdown: [...topicMap.values()],
        feedback: percentage >= 75 ? 'Excellent work! Keep it up.' : 'Good attempt — review the incorrect topics.',
      });
      attemptTotal += 1;
    }

    const attempts = await QuizAttempt.find({ quiz: quiz._id }).lean();
    if (attempts.length) {
      const percentages = attempts.map((a) => a.percentage);
      await Quiz.findByIdAndUpdate(quiz._id, {
        $set: {
          stats: {
            attemptCount: attempts.length,
            averageScore: Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 10) / 10,
            highestScore: Math.max(...percentages),
            lowestScore: Math.min(...percentages),
          },
        },
      });
    }
  }
  counts.quizAttempts = attemptTotal;

  /* ---------------------------- announcements ---------------------------- */
  const announcements = [
    {
      title: 'Mid-semester exam timetable published',
      content:
        'The in-semester examination timetable for Semester 5 is now available on the Exams page. Please check your subject-wise dates and report 15 minutes before the scheduled time with your hall ticket.',
      category: 'exam',
      priority: 'high',
      pinned: true,
    },
    {
      title: 'DBMS practical submission deadline extended',
      content: 'The DBMS practical file submission deadline has been extended by three days. Submit the printed file to the department office before 4:00 PM.',
      category: 'academic',
      priority: 'normal',
      pinned: false,
    },
    {
      title: 'Attendance below 75% — detention warning',
      content:
        'Students with attendance below 75% will not be allowed to appear for the end-semester examination as per the university ordinance. Guardians of such students have been notified on WhatsApp.',
      category: 'urgent',
      priority: 'urgent',
      pinned: true,
    },
    {
      title: 'Industrial visit to C-DAC Pune',
      content: 'An industrial visit to C-DAC Pune is planned next Friday. Interested students should register with their class representative before Wednesday.',
      category: 'event',
      priority: 'normal',
      pinned: false,
    },
    {
      title: 'AI-assisted quiz practice available',
      content: 'Topic-wise AI generated quizzes are now available for DBMS, DAA and CN. Attempting them counts towards your internal assessment marks.',
      category: 'academic',
      priority: 'normal',
      pinned: false,
    },
  ];

  for (const announcement of announcements) {
    const authorIndex = randInt(0, teacherDocs.length - 1);
    await Announcement.create({
      ...announcement,
      className: 'all',
      audience: 'students',
      author: teacherDocs[authorIndex].doc._id,
      authorName: teacherDocs[authorIndex].user.name,
      publishAt: addDays(today, -randInt(0, 6)),
      status: 'published',
    });
  }
  counts.announcements = announcements.length;

  /* ---------------------------- notifications ---------------------------- */
  const notifications = [];
  for (const student of studentDocs) {
    notifications.push({
      user: student.user._id,
      title: 'Welcome to Smart Student Management System',
      message: 'Your academic dashboard, attendance and results are now available online.',
      type: 'system',
      link: '/student',
      read: true,
    });
    notifications.push({
      user: student.user._id,
      title: 'New AI quiz published — attempt before the deadline',
      message: 'A topic-wise quiz is available for your class. Attempt it before the due date to secure internal marks.',
      type: 'quiz',
      priority: 'high',
      link: '/student/quizzes',
      read: false,
    });
  }
  for (const teacher of teacherDocs) {
    notifications.push({
      user: teacher.user._id,
      title: 'Attendance alert run completed',
      message: 'WhatsApp alerts were generated for students below the 75% threshold.',
      type: 'attendance',
      link: '/teacher/whatsapp-alerts',
      read: false,
    });
  }
  for (const notification of notifications) await Notification.create(notification);
  counts.notifications = notifications.length;

  return counts;
}

/** Seeds only when the database looks empty (called on server start). */
async function ensureSeedData() {
  const userCount = await User.countDocuments({});
  if (userCount > 0) return { seeded: false, counts: { students: 0, teachers: 0, subjects: 0, attendanceRecords: 0 } };

  const counts = await seedDatabase({ fresh: false });
  return { seeded: true, counts };
}

module.exports = { seedDatabase, ensureSeedData, CLASS_NAME, SUBJECTS, STUDENTS, TEACHERS };

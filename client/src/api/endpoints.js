import { http } from './client';

const qs = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.append(key, value);
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

export const authApi = {
  config: () => http.get('/auth/config'),
  login: (payload) => http.post('/auth/login', payload),
  register: (payload) => http.post('/auth/register', payload),
  me: () => http.get('/auth/me'),
  updateProfile: (payload) => http.patch('/auth/profile', payload),
  changePassword: (payload) => http.patch('/auth/password', payload),
  updateStudentProfile: (payload) => http.patch('/auth/student-profile', payload),
};

export const studentApi = {
  list: (params) => http.getWithMeta(`/students${qs(params)}`),
  get: (id) => http.get(`/students/${id}`),
  me: () => http.get('/students/me'),
  create: (payload) => http.post('/students', payload),
  update: (id, payload) => http.put(`/students/${id}`, payload),
  remove: (id) => http.delete(`/students/${id}`),
  classes: () => http.get('/students/meta/classes'),
  bulkImport: (students) => http.post('/students/bulk', { students }),
};

export const teacherApi = {
  list: (params) => http.get(`/teachers${qs(params)}`),
  get: (id) => http.get(`/teachers/${id}`),
  me: () => http.get('/teachers/me'),
  updateMe: (payload) => http.put('/teachers/me', payload),
};

export const subjectApi = {
  list: (params) => http.get(`/subjects${qs(params)}`),
  get: (id) => http.get(`/subjects/${id}`),
  create: (payload) => http.post('/subjects', payload),
  update: (id, payload) => http.put(`/subjects/${id}`, payload),
  remove: (id) => http.delete(`/subjects/${id}`),
  units: (id) => http.get(`/subjects/${id}/units`),
  saveUnits: (id, units) => http.put(`/subjects/${id}/units`, { units }),
};

export const attendanceApi = {
  list: (params) => http.get(`/attendance${qs(params)}`),
  mark: (payload) => http.post('/attendance/mark', payload),
  session: (params) => http.get(`/attendance/session${qs(params)}`),
  classSummary: (className, params) => http.get(`/attendance/class/${className}${qs(params)}`),
  studentSummary: (id, params) => http.get(`/attendance/student/${id}${qs(params)}`),
  defaulters: (params) => http.get(`/attendance/defaulters${qs(params)}`),
  update: (id, payload) => http.put(`/attendance/${id}`, payload),
  remove: (id) => http.delete(`/attendance/${id}`),
  notifyGuardian: (id) => http.post(`/attendance/${id}/notify-guardian`),
};

export const markApi = {
  list: (params) => http.get(`/marks${qs(params)}`),
  create: (payload) => http.post('/marks', payload),
  update: (id, payload) => http.put(`/marks/${id}`, payload),
  remove: (id) => http.delete(`/marks/${id}`),
  studentPerformance: (id) => http.get(`/marks/student/${id || 'me'}`),
  classPerformance: (className, params) => http.get(`/marks/class/${className}${qs(params)}`),
  subjectMarks: (subjectId) => http.get(`/marks/subject/${subjectId}`),
};

export const assignmentApi = {
  list: (params) => http.get(`/assignments${qs(params)}`),
  get: (id) => http.get(`/assignments/${id}`),
  create: (payload) => http.post('/assignments', payload),
  update: (id, payload) => http.put(`/assignments/${id}`, payload),
  remove: (id) => http.delete(`/assignments/${id}`),
  submit: (id, payload) => http.post(`/assignments/${id}/submit`, payload),
  grade: (id, submissionId, payload) => http.put(`/assignments/${id}/grade/${submissionId}`, payload),
  submissions: (id) => http.get(`/assignments/${id}/submissions`),
  remind: (id) => http.post(`/assignments/${id}/remind`),
};

export const examApi = {
  list: (params) => http.get(`/exams${qs(params)}`),
  get: (id) => http.get(`/exams/${id}`),
  create: (payload) => http.post('/exams', payload),
  update: (id, payload) => http.put(`/exams/${id}`, payload),
  remove: (id) => http.delete(`/exams/${id}`),
  timetable: (className) => http.get(`/exams/timetable/${className}`),
  remind: (id) => http.post(`/exams/${id}/remind`),
};

export const quizApi = {
  list: (params) => http.get(`/quizzes${qs(params)}`),
  get: (id) => http.get(`/quizzes/${id}`),
  update: (id, payload) => http.put(`/quizzes/${id}`, payload),
  remove: (id) => http.delete(`/quizzes/${id}`),
  generate: (payload) => http.post('/quizzes/generate', payload),
  preview: (payload) => http.post('/quizzes/generate/preview', payload),
  start: (id) => http.post(`/quizzes/${id}/start`),
  submit: (id, payload) => http.post(`/quizzes/${id}/submit`, payload),
  myAttempts: () => http.get('/quizzes/attempts/me'),
  attempt: (attemptId) => http.get(`/quizzes/attempts/${attemptId}`),
  review: (attemptId, payload) => http.put(`/quizzes/attempts/${attemptId}/review`, payload),
};

export const notificationApi = {
  list: (params) => http.getWithMeta(`/notifications${qs(params)}`),
  markRead: (id) => http.put(`/notifications/${id}/read`),
  markAllRead: () => http.put('/notifications/read-all'),
  remove: (id) => http.delete(`/notifications/${id}`),
  clearRead: () => http.delete('/notifications'),
  broadcast: (payload) => http.post('/notifications/broadcast', payload),
};

export const announcementApi = {
  list: (params) => http.get(`/announcements${qs(params)}`),
  get: (id) => http.get(`/announcements/${id}`),
  create: (payload) => http.post('/announcements', payload),
  update: (id, payload) => http.put(`/announcements/${id}`, payload),
  remove: (id) => http.delete(`/announcements/${id}`),
  stats: () => http.get('/announcements/stats/summary'),
};

export const whatsappApi = {
  status: () => http.get('/whatsapp/status'),
  logs: (params) => http.get(`/whatsapp/logs${qs(params)}`),
  defaulters: (params) => http.get(`/whatsapp/defaulters${qs(params)}`),
  runAlerts: (payload) => http.post('/whatsapp/attendance-alerts', payload),
  send: (payload) => http.post('/whatsapp/send', payload),
  test: (payload) => http.post('/whatsapp/test', payload),
};

export const dashboardApi = {
  student: () => http.get('/dashboard/student'),
  teacher: () => http.get('/dashboard/teacher'),
  admin: () => http.get('/dashboard/admin'),
  classAnalytics: (className, params) => http.get(`/dashboard/analytics/${className}${qs(params)}`),
  leaderboard: (className, params) => http.get(`/dashboard/leaderboard/${className}${qs(params)}`),
};

export const aiApi = {
  status: () => http.get('/ai/status'),
  options: (params) => http.get(`/ai/options${qs(params)}`),
  history: (params) => http.get(`/ai/history${qs(params)}`),
  topics: (subjectId) => http.get(`/ai/topics/${subjectId}`),
};

export { qs };

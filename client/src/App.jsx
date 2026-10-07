import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';

/* ------------------------------- student ------------------------------- */
import StudentDashboard from './pages/student/Dashboard';
import StudentAttendance from './pages/student/Attendance';
import StudentMarks from './pages/student/Marks';
import StudentAssignments from './pages/student/Assignments';
import StudentAssignmentDetail from './pages/student/AssignmentDetail';
import StudentExams from './pages/student/Exams';
import StudentQuizzes from './pages/student/Quizzes';
import StudentQuizAttempt from './pages/student/QuizAttempt';
import StudentAnnouncements from './pages/student/Announcements';
import Notifications from './pages/shared/Notifications';
import StudentProfile from './pages/student/Profile';

/* ------------------------------- teacher ------------------------------- */
import TeacherDashboard from './pages/teacher/Dashboard';
import TeacherStudents from './pages/teacher/Students';
import TeacherStudentDetail from './pages/teacher/StudentDetail';
import TeacherSubjects from './pages/teacher/Subjects';
import TeacherSubjectDetail from './pages/teacher/SubjectDetail';
import TeacherAttendance from './pages/teacher/Attendance';
import TeacherMarks from './pages/teacher/Marks';
import TeacherAssignments from './pages/teacher/Assignments';
import TeacherAssignmentDetail from './pages/teacher/AssignmentDetail';
import TeacherExams from './pages/teacher/Exams';
import AIGenerator from './pages/teacher/AIGenerator';
import TeacherQuizzes from './pages/teacher/Quizzes';
import TeacherQuizDetail from './pages/teacher/QuizDetail';
import TeacherAnalytics from './pages/teacher/Analytics';
import TeacherAnnouncements from './pages/teacher/Announcements';
import WhatsAppAlerts from './pages/teacher/WhatsAppAlerts';
import TeacherProfile from './pages/teacher/Profile';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/student"
        element={
          <ProtectedRoute role="student">
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<StudentDashboard />} />
        <Route path="attendance" element={<StudentAttendance />} />
        <Route path="marks" element={<StudentMarks />} />
        <Route path="assignments" element={<StudentAssignments />} />
        <Route path="assignments/:id" element={<StudentAssignmentDetail />} />
        <Route path="exams" element={<StudentExams />} />
        <Route path="quizzes" element={<StudentQuizzes />} />
        <Route path="quizzes/:quizId" element={<StudentQuizAttempt />} />
        <Route path="announcements" element={<StudentAnnouncements />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<StudentProfile />} />
      </Route>

      <Route
        path="/teacher"
        element={
          <ProtectedRoute role="teacher">
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TeacherDashboard />} />
        <Route path="students" element={<TeacherStudents />} />
        <Route path="students/:id" element={<TeacherStudentDetail />} />
        <Route path="subjects" element={<TeacherSubjects />} />
        <Route path="subjects/:id" element={<TeacherSubjectDetail />} />
        <Route path="attendance" element={<TeacherAttendance />} />
        <Route path="marks" element={<TeacherMarks />} />
        <Route path="assignments" element={<TeacherAssignments />} />
        <Route path="assignments/:id" element={<TeacherAssignmentDetail />} />
        <Route path="exams" element={<TeacherExams />} />
        <Route path="ai-generator" element={<AIGenerator />} />
        <Route path="quizzes" element={<TeacherQuizzes />} />
        <Route path="quizzes/:id" element={<TeacherQuizDetail />} />
        <Route path="analytics" element={<TeacherAnalytics />} />
        <Route path="announcements" element={<TeacherAnnouncements />} />
        <Route path="whatsapp-alerts" element={<WhatsAppAlerts />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<TeacherProfile />} />
      </Route>

      <Route path="/app" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

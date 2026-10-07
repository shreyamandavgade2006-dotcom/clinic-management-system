import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Award,
  BellRing,
  BookOpen,
  Brain,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  Megaphone,
  MessageCircle,
  NotepadText,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { dashboardApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import {
  Alert,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageLoader,
  ProgressBar,
  SectionTitle,
  StatCard,
} from '../../components/ui';
import { AttendanceTrendChart, SubjectBarChart } from '../../components/charts';
import { formatDate, formatDateShort, humanise, pct, relativeTime } from '../../utils/format';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardApi
      .teacher()
      .then((result) => setData(result.data))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;
  if (error) return <Alert tone="danger" title="Could not load the dashboard">{error}</Alert>;
  if (!data) return null;

  const classAverage = data.classSummaries?.length
    ? Math.round((data.classSummaries.reduce((sum, item) => sum + item.attendance, 0) / data.classSummaries.length) * 10) / 10
    : 0;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl gradient-brand p-6 text-white shadow-card sm:p-7">
        <div className="absolute inset-0 gradient-mesh opacity-40" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm text-white/75">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Welcome back, {user?.name}</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              {data.defaultersCount > 0
                ? `${data.defaultersCount} student(s) are below the 75% attendance threshold. Send WhatsApp alerts to their guardians from the alerts panel.`
                : 'All students are above the 75% attendance threshold. Great consistency this month!'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge className="bg-white/15 text-white">{data.teacher?.designation}</Badge>
              <Badge className="bg-white/15 text-white">{(data.classes || []).join(', ') || 'No classes'}</Badge>
              <Badge className="bg-white/15 text-white">{data.subjectCount} subjects</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl bg-white/12 px-5 py-4 backdrop-blur">
              <p className="text-3xl font-bold">{data.studentCount}</p>
              <p className="text-xs text-white/80">Students</p>
            </div>
            <div className="rounded-2xl bg-white/12 px-5 py-4 backdrop-blur">
              <p className="text-3xl font-bold">{data.defaultersCount}</p>
              <p className="text-xs text-white/80">Below 75%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Class attendance"
          value={pct(data.attendance?.percentage || classAverage)}
          hint={`${data.attendance?.totalSessions || 0} sessions recorded`}
          icon={ClipboardCheck}
          tone={data.attendance?.percentage >= 75 ? 'success' : 'danger'}
          trend={<ProgressBar value={data.attendance?.percentage || 0} />}
        />
        <StatCard label="Students" value={data.studentCount} hint={`${(data.classes || []).length} class(es)`} icon={Users} tone="brand" />
        <StatCard
          label="Pending grading"
          value={data.pendingGrading}
          hint="Submissions waiting for marks"
          icon={FileSpreadsheet}
          tone={data.pendingGrading ? 'warning' : 'success'}
        />
        <StatCard
          label="AI assessments"
          value={data.recentQuizzes?.length || 0}
          hint="Recently generated"
          icon={Brain}
          tone="purple"
        />
      </div>

      {data.defaultersCount ? (
        <Alert tone="warning" title={`${data.defaultersCount} student(s) below the attendance threshold`}>
          <div className="flex flex-wrap items-center gap-3">
            <span>Guardians can be notified instantly over WhatsApp with a single click.</span>
            <Link to="/teacher/whatsapp-alerts" className="btn-whatsapp btn-sm">
              <MessageCircle size={14} /> Send alerts
            </Link>
          </div>
        </Alert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Attendance trend" subtitle="Last 10 recorded sessions" icon={ClipboardCheck} />
          <div className="p-4">
            <AttendanceTrendChart data={(data.attendanceTrend || []).map((item) => ({ month: item.label, percentage: item.percentage }))} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Class snapshot" subtitle="Attendance and defaulters per class" icon={Users} />
          <div className="space-y-4 p-5">
            {(data.classSummaries || []).map((item) => (
              <div key={item.className} className="rounded-xl border border-ink-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink-800">Class {item.className}</p>
                    <p className="text-xs text-ink-500">{item.students} students</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={item.attendance >= 75 ? 'success' : 'danger'}>{pct(item.attendance)} attendance</Badge>
                    {item.defaulters ? <Badge tone="warning">{item.defaulters} below 75%</Badge> : null}
                  </div>
                </div>
                <ProgressBar value={item.attendance} className="mt-3" />
              </div>
            ))}
            {!data.classSummaries?.length ? <EmptyState icon={Users} title="No classes assigned yet" /> : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Top performers"
            icon={Award}
            action={
              <Link to="/teacher/analytics" className="btn-ghost btn-sm">
                Analytics
              </Link>
            }
          />
          <div className="divide-y divide-ink-100">
            {(data.toppers || []).map((student, index) => (
              <div key={student.studentId} className="flex items-center gap-3 px-5 py-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-800">{student.name}</p>
                  <p className="text-xs text-ink-500">{student.rollNo}</p>
                </div>
                <span className="text-sm font-bold text-success-600">{student.percentage}%</span>
              </div>
            ))}
            {!data.toppers?.length ? <EmptyState icon={Award} title="No results yet" /> : null}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent assignments"
            icon={NotepadText}
            action={
              <Link to="/teacher/assignments" className="btn-ghost btn-sm">
                Manage
              </Link>
            }
          />
          <div className="divide-y divide-ink-100">
            {(data.recentAssignments || []).map((assignment) => (
              <Link key={assignment._id} to={`/teacher/assignments/${assignment._id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-ink-50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-800">{assignment.title}</p>
                  <p className="text-xs text-ink-500">
                    {assignment.subject?.shortName} · due {formatDateShort(assignment.dueDate)}
                  </p>
                </div>
                <Badge tone={new Date(assignment.dueDate) < new Date() ? 'neutral' : 'warning'}>
                  {assignment.totalMarks} marks
                </Badge>
              </Link>
            ))}
            {!data.recentAssignments?.length ? <EmptyState icon={NotepadText} title="No assignments yet" /> : null}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Upcoming exams"
            icon={CalendarClock}
            action={
              <Link to="/teacher/exams" className="btn-ghost btn-sm">
                Schedule
              </Link>
            }
          />
          <div className="divide-y divide-ink-100">
            {(data.upcomingExams || []).map((exam) => (
              <div key={exam._id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-800">{exam.title}</p>
                  <p className="text-xs text-ink-500">
                    {formatDate(exam.date)} · {exam.startTime}
                  </p>
                </div>
                <Badge tone="info">{humanise(exam.type)}</Badge>
              </div>
            ))}
            {!data.upcomingExams?.length ? <EmptyState icon={CalendarClock} title="No exams scheduled" /> : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader
            title="AI generated assessments"
            subtitle="Ready for students to attempt"
            icon={Sparkles}
            action={
              <Link to="/teacher/ai-generator" className="btn-primary btn-sm">
                <Sparkles size={14} /> Generate new
              </Link>
            }
          />
          <div className="divide-y divide-ink-100">
            {(data.recentQuizzes || []).map((quiz) => (
              <Link key={quiz._id} to={`/teacher/quizzes/${quiz._id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-ink-50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-800">{quiz.title}</p>
                  <p className="text-xs text-ink-500">
                    {quiz.questions?.length || 0} questions · {quiz.totalMarks} marks · {quiz.stats?.attemptCount || 0} attempts
                  </p>
                </div>
                <Badge tone={quiz.status === 'published' ? 'success' : 'neutral'}>{quiz.status}</Badge>
              </Link>
            ))}
            {!data.recentQuizzes?.length ? (
              <EmptyState
                icon={Brain}
                title="No AI papers yet"
                message="Generate your first quiz or question paper in seconds."
                action={
                  <Link to="/teacher/ai-generator" className="btn-primary btn-sm">
                    Open generator
                  </Link>
                }
              />
            ) : null}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="WhatsApp alert log"
              subtitle="Latest guardian notifications"
              icon={MessageCircle}
              action={
                <Link to="/teacher/whatsapp-alerts" className="btn-ghost btn-sm">
                  Panel
                </Link>
              }
            />
            <div className="divide-y divide-ink-100">
              {(data.recentAlerts || []).length ? (
                data.recentAlerts.map((alert) => (
                  <div key={alert._id} className="flex items-start gap-3 px-5 py-3">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        alert.status === 'failed' ? 'bg-danger-500' : alert.status === 'sent' ? 'bg-success-500' : 'bg-warning-400'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-800">{alert.studentName || alert.to}</p>
                      <p className="line-clamp-1 text-xs text-ink-500">{alert.body?.split('\n')[0]}</p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-400">{relativeTime(alert.createdAt)}</span>
                  </div>
                ))
              ) : (
                <EmptyState icon={MessageCircle} title="No alerts sent yet" message="Run the attendance alert job to notify guardians." />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Announcements"
              icon={Megaphone}
              action={
                <Link to="/teacher/announcements" className="btn-ghost btn-sm">
                  Post
                </Link>
              }
            />
            <div className="divide-y divide-ink-100">
              {(data.announcements || []).map((item) => (
                <div key={item._id} className="px-5 py-3">
                  <p className="truncate text-sm font-medium text-ink-800">{item.title}</p>
                  <p className="line-clamp-1 text-xs text-ink-500">{item.content}</p>
                </div>
              ))}
              {!data.announcements?.length ? <EmptyState icon={Megaphone} title="No announcements yet" /> : null}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Subject performance" subtitle="Average marks per subject" icon={TrendingUp} />
          <div className="p-4">
            <SubjectBarChart data={(data.recentQuizzes || []).map((quiz) => ({ shortName: quiz.title?.slice(0, 10), percentage: quiz.stats?.averageScore || 0 }))} />
            {!data.recentQuizzes?.length ? <EmptyState icon={TrendingUp} title="No quiz data yet" /> : null}
          </div>
        </Card>

        <Card>
          <CardHeader title="Quick actions" icon={Sparkles} />
          <div className="grid gap-3 p-5">
            {[
              { to: '/teacher/attendance', label: 'Mark today\'s attendance', icon: UserCheck, tone: 'bg-brand-50 text-brand-600' },
              { to: '/teacher/marks', label: 'Enter exam marks', icon: FileSpreadsheet, tone: 'bg-success-50 text-success-600' },
              { to: '/teacher/ai-generator', label: 'Generate a question paper', icon: Sparkles, tone: 'bg-purple-50 text-purple-600' },
              { to: '/teacher/whatsapp-alerts', label: 'Send attendance alerts', icon: MessageCircle, tone: 'bg-emerald-50 text-emerald-600' },
              { to: '/teacher/announcements', label: 'Post an announcement', icon: Megaphone, tone: 'bg-amber-50 text-amber-600' },
            ].map((action) => (
              <Link key={action.to} to={action.to} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/40">
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${action.tone}`}>
                  <action.icon size={17} />
                </span>
                <span className="text-sm font-medium text-ink-700">{action.label}</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Notifications"
            icon={BellRing}
            action={
              <Link to="/teacher/notifications" className="btn-ghost btn-sm">
                View all
              </Link>
            }
          />
          <div className="divide-y divide-ink-100">
            {(data.notifications || []).slice(0, 5).map((item) => (
              <div key={item._id} className="flex items-start gap-3 px-5 py-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read ? 'bg-ink-300' : 'bg-brand-500'}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-800">{item.title}</p>
                  <p className="line-clamp-1 text-xs text-ink-500">{item.message}</p>
                </div>
                <span className="shrink-0 text-xs text-ink-400">{relativeTime(item.createdAt)}</span>
              </div>
            ))}
            {!data.notifications?.length ? <EmptyState icon={BellRing} title="No notifications" /> : null}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Teaching load" subtitle="Subjects and classes assigned to you" icon={BookOpen} />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {(data.classSummaries || []).map((item) => (
            <div key={item.className} className="rounded-xl border border-ink-100 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink-800">{item.className}</p>
                <Badge tone="brand">{item.students} students</Badge>
              </div>
              <p className="mt-2 text-xs text-ink-500">Attendance {pct(item.attendance)}</p>
              <Link to={`/teacher/students?className=${item.className}`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600">
                <ClipboardList size={13} /> View students
              </Link>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

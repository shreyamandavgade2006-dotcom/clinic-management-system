import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BellRing,
  Brain,
  CalendarClock,
  ClipboardCheck,
  Megaphone,
  NotebookPen,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { dashboardApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageLoader,
  ProgressBar,
  SectionTitle,
  StatCard,
} from '../../components/ui';
import { AttendanceTrendChart, PerformanceTrendChart, SubjectBarChart } from '../../components/charts';
import { daysLeftLabel, formatDate, formatDateShort, percentageColor, pct, relativeTime } from '../../utils/format';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardApi
      .student()
      .then((result) => setData(result.data))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;
  if (error) return <Alert tone="danger" title="Could not load your dashboard">{error}</Alert>;
  if (!data) return null;

  const { attendance, performance, assignments, exams, quizzes, announcements, notifications } = data;
  const attendanceAtRisk = attendance.percentage < attendance.threshold;

  return (
    <div className="space-y-6">
      {/* hero */}
      <div className="relative overflow-hidden rounded-2xl gradient-brand p-6 text-white shadow-card sm:p-7">
        <div className="absolute inset-0 gradient-mesh opacity-40" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm text-white/75">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Hello, {user?.name?.split(' ')[0]} 👋</h1>
            <p className="mt-2 max-w-xl text-sm text-white/85">
              {attendanceAtRisk
                ? `Your attendance is ${attendance.percentage}% — below the required ${attendance.threshold}%. Attend the upcoming sessions to stay exam eligible.`
                : `Great going! Your attendance is ${attendance.percentage}% and your performance stands at ${performance.overallPercentage}%.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge className="bg-white/15 text-white">
                Roll No: {data.student?.rollNo}
              </Badge>
              <Badge className="bg-white/15 text-white">Class: {data.student?.className}</Badge>
              <Badge className="bg-white/15 text-white">Semester {data.student?.semester}</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl bg-white/12 px-5 py-4 backdrop-blur">
              <p className="text-3xl font-bold">{attendance.percentage}%</p>
              <p className="text-xs text-white/80">Attendance</p>
            </div>
            <div className="rounded-2xl bg-white/12 px-5 py-4 backdrop-blur">
              <p className="text-3xl font-bold">{performance.cgpa}</p>
              <p className="text-xs text-white/80">CGPA</p>
            </div>
          </div>
        </div>
      </div>

      {attendanceAtRisk ? (
        <Alert tone="danger" title={`Attendance below ${attendance.threshold}%`}>
          You have attended {attendance.attended} of {attendance.totalSessions} sessions. Your guardian has been notified on WhatsApp. Please
          attend regularly to become eligible for examinations.
        </Alert>
      ) : null}

      {/* stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Attendance"
          value={pct(attendance.percentage)}
          hint={`${attendance.attended}/${attendance.totalSessions} sessions attended`}
          icon={ClipboardCheck}
          tone={attendanceAtRisk ? 'danger' : 'success'}
          trend={<ProgressBar value={attendance.percentage} showLabel={false} />}
        />
        <StatCard
          label="Overall Performance"
          value={pct(performance.overallPercentage)}
          hint={`${performance.totalExams} exam records · CGPA ${performance.cgpa}`}
          icon={TrendingUp}
          tone="brand"
          trend={<ProgressBar value={performance.overallPercentage} showLabel={false} />}
        />
        <StatCard
          label="Pending Assignments"
          value={assignments.pending}
          hint={assignments.overdue ? `${assignments.overdue} overdue` : 'All caught up'}
          icon={NotebookPen}
          tone={assignments.overdue ? 'danger' : 'info'}
        />
        <StatCard
          label="Quizzes Attempted"
          value={`${quizzes.attempted}/${quizzes.total}`}
          hint={`Average score ${quizzes.averageScore}%`}
          icon={Brain}
          tone="purple"
        />
      </div>

      {/* charts */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Attendance trend" subtitle="Month-wise attendance percentage" icon={ClipboardCheck} />
          <div className="p-4">
            <AttendanceTrendChart data={attendanceTrend(data)} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Performance trend" subtitle="Marks scored across exams" icon={TrendingUp} />
          <div className="p-4">
            <PerformanceTrendChart data={performance.trend} />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Subject-wise performance"
            subtitle="Percentage scored in each subject"
            icon={Award}
            action={
              <Link to="/student/marks" className="btn-ghost btn-sm">
                View results
              </Link>
            }
          />
          <div className="p-4">
            {performance.subjects?.length ? (
              <SubjectBarChart data={performance.subjects} />
            ) : (
              <EmptyState icon={Award} title="No marks published yet" message="Your subject performance appears here once teachers publish marks." />
            )}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Strong & weak subjects" subtitle="Based on your exam averages" icon={Sparkles} />
            <div className="space-y-4 p-5">
              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-success-600">
                  <TrendingUp size={14} /> Strong
                </p>
                {performance.strongSubjects?.length ? (
                  performance.strongSubjects.map((subject) => (
                    <div key={subject.subjectId} className="mb-2 flex items-center gap-3">
                      <span className="w-14 shrink-0 text-sm font-semibold text-ink-700">{subject.shortName}</span>
                      <ProgressBar value={subject.percentage} className="flex-1" showLabel />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ink-500">Not enough data yet.</p>
                )}
              </div>
              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-danger-600">
                  <TrendingDown size={14} /> Needs attention
                </p>
                {performance.weakSubjects?.length ? (
                  performance.weakSubjects.map((subject) => (
                    <div key={subject.subjectId} className="mb-2 flex items-center gap-3">
                      <span className="w-14 shrink-0 text-sm font-semibold text-ink-700">{subject.shortName}</span>
                      <ProgressBar value={subject.percentage} className="flex-1" showLabel />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ink-500">Not enough data yet.</p>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="AI quiz performance"
              subtitle="Average score across all attempts"
              icon={Brain}
              action={
                <Link to="/student/quizzes" className="btn-ghost btn-sm">
                  Attempt
                </Link>
              }
            />
            <div className="p-5">
              {quizzes.recent?.length ? (
                <div className="space-y-3">
                  {quizzes.recent.map((attempt) => (
                    <div key={attempt._id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-800">{attempt.title}</p>
                        <p className="text-xs text-ink-500">{relativeTime(attempt.submittedAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${percentageColor(attempt.percentage)}`}>{attempt.percentage}%</p>
                        <p className="text-xs text-ink-500">
                          {attempt.score}/{attempt.totalMarks}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Brain} title="No quiz attempts yet" message="Attempt an AI generated quiz to see your scores here." />
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Upcoming assignments"
            icon={NotebookPen}
            action={
              <Link to="/student/assignments" className="btn-ghost btn-sm">
                All
              </Link>
            }
          />
          <div className="p-5">
            {assignments.upcoming?.length ? (
              <ul className="space-y-3">
                {assignments.upcoming.map((item) => (
                  <li key={item._id} className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                    <div className="min-w-0 flex-1">
                      <Link to={`/student/assignments/${item._id}`} className="line-clamp-1 text-sm font-semibold text-ink-800 hover:text-brand-600">
                        {item.title}
                      </Link>
                      <p className="text-xs text-ink-500">
                        {item.subjectCode} · {formatDateShort(item.dueDate)}
                      </p>
                    </div>
                    <Badge tone={item.daysLeft <= 1 ? 'danger' : item.daysLeft <= 3 ? 'warning' : 'neutral'}>
                      {daysLeftLabel(item.daysLeft)}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={NotebookPen} title="Nothing pending" message="You have no upcoming assignments." />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Upcoming exams"
            icon={CalendarClock}
            action={
              <Link to="/student/exams" className="btn-ghost btn-sm">
                Schedule
              </Link>
            }
          />
          <div className="p-5">
            {exams.upcoming?.length ? (
              <ul className="space-y-3">
                {exams.upcoming.map((exam) => (
                  <li key={exam._id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-800">{exam.title}</p>
                      <p className="text-xs text-ink-500">
                        {formatDate(exam.date)} · {exam.startTime} {exam.room ? `· ${exam.room}` : ''}
                      </p>
                    </div>
                    <Badge tone={exam.daysLeft <= 2 ? 'danger' : exam.daysLeft <= 7 ? 'warning' : 'info'}>{exam.daysLeft}d</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={CalendarClock} title="No exams scheduled" message="Exam dates will appear here." />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Announcements"
            icon={Megaphone}
            action={
              <Link to="/student/announcements" className="btn-ghost btn-sm">
                All
              </Link>
            }
          />
          <div className="p-5">
            {announcements?.length ? (
              <ul className="space-y-3">
                {announcements.slice(0, 4).map((item) => (
                  <li key={item._id} className="rounded-xl bg-ink-50 p-3">
                    <p className="line-clamp-1 text-sm font-semibold text-ink-800">{item.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{item.content}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Megaphone} title="No announcements" />
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recent notifications"
          icon={BellRing}
          action={
            <Link to="/student/notifications" className="btn-ghost btn-sm">
              View all
            </Link>
          }
        />
        <div className="divide-y divide-ink-100">
          {notifications?.length ? (
            notifications.slice(0, 5).map((item) => (
              <div key={item._id} className="flex items-start gap-3 px-5 py-3">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.read ? 'bg-ink-300' : 'bg-brand-500'}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-800">{item.title}</p>
                  <p className="line-clamp-1 text-xs text-ink-500">{item.message}</p>
                </div>
                <span className="shrink-0 text-xs text-ink-400">{relativeTime(item.createdAt)}</span>
              </div>
            ))
          ) : (
            <EmptyState icon={BellRing} title="No notifications yet" />
          )}
        </div>
      </Card>

      <Card className="border-brand-100 bg-gradient-to-r from-brand-50 to-white">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-100 text-brand-600">
              <Brain size={20} />
            </span>
            <div>
              <p className="font-semibold text-ink-900">Practise with AI generated quizzes</p>
              <p className="text-sm text-ink-600">
                {quizzes.pending} assessment{quizzes.pending === 1 ? '' : 's'} waiting for you. Attempt now and improve your internal marks.
              </p>
            </div>
          </div>
          <Link to="/student/quizzes" className="btn-primary">
            Start a quiz
          </Link>
        </div>
      </Card>
    </div>
  );
}

const attendanceTrend = (data) =>
  (data.attendanceTrend || []).map((entry) => ({
    month: entry.month,
    percentage: entry.percentage,
    present: entry.present,
    total: entry.total,
  }));

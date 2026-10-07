import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  BookOpen,
  ClipboardCheck,
  Mail,
  MessageCircle,
  Phone,
  TrendingUp,
  User,
} from 'lucide-react';
import { attendanceApi, studentApi } from '../../api/endpoints';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageLoader,
  ProgressBar,
  SectionTitle,
  StatCard,
  Tabs,
  toast,
} from '../../components/ui';
import { AttendanceTrendChart, SubjectBarChart } from '../../components/charts';
import { formatDate, formatDateTime, gradeColor, percentageColor, pct } from '../../utils/format';

export default function TeacherStudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    studentApi
      .get(id)
      .then((result) => setData(result.data))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [id]);

  const sendGuardianAlert = async () => {
    setSending(true);
    try {
      const recent = await attendanceApi.list({ student: data.student._id, limit: 1 });
      const record = recent.data?.[0];
      if (!record) {
        toast('No attendance record available to alert about', 'error');
        return;
      }
      const response = await attendanceApi.notifyGuardian(record._id);
      toast(
        response.data?.success === false ? response.data.error : 'WhatsApp alert sent to the guardian',
        response.data?.success === false ? 'error' : 'success'
      );
    } catch (alertError) {
      toast(alertError.message, 'error');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error) return <Alert tone="danger" title="Could not load this student">{error}</Alert>;
  if (!data) return null;

  const { student, attendance, performance, submissions, attempts } = data;
  const overall = attendance?.overall || {};
  const atRisk = overall.totalSessions > 0 && overall.percentage < overall.threshold;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="btn-ghost btn-sm">
        <ArrowLeft size={15} /> Back to students
      </button>

      <Card>
        <div className="flex flex-wrap items-start gap-5 p-6">
          <Avatar name={student.user?.name || student.rollNo} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-ink-900">{student.user?.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
              <span className="flex items-center gap-1.5">
                <Mail size={14} /> {student.user?.email}
              </span>
              {student.user?.phone ? (
                <span className="flex items-center gap-1.5">
                  <Phone size={14} /> {student.user.phone}
                </span>
              ) : null}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="brand">{student.rollNo}</Badge>
              <Badge tone="info">Class {student.className}</Badge>
              <Badge tone="neutral">Semester {student.semester}</Badge>
              <Badge tone="success">{student.department}</Badge>
              {student.batch ? <Badge tone="neutral">Batch {student.batch}</Badge> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={MessageCircle} onClick={sendGuardianAlert} loading={sending}>
              WhatsApp guardian
            </Button>
          </div>
        </div>
      </Card>

      {atRisk ? (
        <Alert tone="danger" title={`Attendance below ${overall.threshold}%`}>
          {student.user?.name} has attended {overall.attended} of {overall.totalSessions} sessions ({overall.percentage}%). Guardian:{" "}
          {student.guardian?.name || 'not provided'} ({student.guardian?.phone || 'no WhatsApp number'}).
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Attendance"
          value={pct(overall.percentage || 0)}
          hint={`${overall.attended || 0}/${overall.totalSessions || 0} sessions`}
          icon={ClipboardCheck}
          tone={atRisk ? 'danger' : 'success'}
          trend={<ProgressBar value={overall.percentage || 0} />}
        />
        <StatCard label="Overall performance" value={pct(performance?.overallPercentage || 0)} hint={`CGPA ${performance?.cgpa || 0}`} icon={TrendingUp} tone="brand" trend={<ProgressBar value={performance?.overallPercentage || 0} />} />
        <StatCard label="Assignments submitted" value={submissions?.length || 0} hint="Across all subjects" icon={BadgeCheck} tone="info" />
        <StatCard label="Quiz attempts" value={attempts?.length || 0} hint="AI assessments attempted" icon={Award} tone="purple" />
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview', icon: TrendingUp },
          { value: 'attendance', label: 'Attendance', icon: ClipboardCheck },
          { value: 'academics', label: 'Academics', icon: BookOpen },
          { value: 'profile', label: 'Profile', icon: User },
        ]}
      />

      {tab === 'overview' ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader title="Attendance trend" subtitle="Month-wise percentage" icon={ClipboardCheck} />
            <div className="p-4">
              <AttendanceTrendChart data={attendance?.monthly || []} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Subject-wise performance" subtitle="Marks percentage per subject" icon={TrendingUp} />
            <div className="p-4">
              <SubjectBarChart data={performance?.subjects || []} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Strong subjects" icon={Award} />
            <div className="space-y-3 p-5">
              {(performance?.strongSubjects || []).map((subject) => (
                <div key={subject.subjectId}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-ink-700">{subject.name}</span>
                    <span className="font-semibold text-success-600">{subject.percentage}%</span>
                  </div>
                  <ProgressBar value={subject.percentage} height="h-1.5" />
                </div>
              ))}
              {!performance?.strongSubjects?.length ? <EmptyState icon={Award} title="No graded exams yet" /> : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Needs attention" icon={TrendingUp} />
            <div className="space-y-3 p-5">
              {(performance?.weakSubjects || []).map((subject) => (
                <div key={subject.subjectId}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-ink-700">{subject.name}</span>
                    <span className="font-semibold text-danger-600">{subject.percentage}%</span>
                  </div>
                  <ProgressBar value={subject.percentage} height="h-1.5" />
                </div>
              ))}
              {!performance?.weakSubjects?.length ? <EmptyState icon={TrendingUp} title="No graded exams yet" /> : null}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'attendance' ? (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Code</th>
                <th>Sessions</th>
                <th>Attended</th>
                <th>Percentage</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(attendance?.subjectWise || []).map((subject) => (
                <tr key={subject.subjectId}>
                  <td className="font-medium text-ink-800">{subject.name}</td>
                  <td>{subject.code}</td>
                  <td>{subject.totalSessions}</td>
                  <td>{subject.attended}</td>
                  <td className="w-48">
                    <ProgressBar value={subject.percentage} showLabel />
                  </td>
                  <td>
                    <Badge tone={subject.percentage >= 75 ? 'success' : 'danger'} dot>
                      {subject.percentage >= 75 ? 'Safe' : 'Low'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'academics' ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Marks sheet" subtitle="All recorded exams" icon={BookOpen} />
            <div className="divide-y divide-ink-100">
              {(performance?.subjects || []).map((subject) => (
                <div key={subject.subjectId} className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-ink-800">{subject.name}</p>
                    <Badge className={gradeColor(subject.grade)}>Grade {subject.grade}</Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    {subject.exams.map((exam) => (
                      <div key={exam._id} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm">
                        <span className="text-ink-600">{exam.title || exam.examLabel}</span>
                        <span className={percentageColor(exam.percentage)}>
                          {exam.marksObtained}/{exam.maxMarks} · {exam.percentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {!performance?.subjects?.length ? <EmptyState icon={BookOpen} title="No marks recorded yet" /> : null}
            </div>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader title="Submissions" subtitle="Assignments handed in" icon={BadgeCheck} />
              <div className="divide-y divide-ink-100">
                {submissions?.length ? (
                  submissions.map((submission) => (
                    <div key={submission._id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-800">{submission.assignment?.title || 'Assignment'}</p>
                        <p className="text-xs text-ink-500">Submitted {formatDateTime(submission.submittedAt)}</p>
                      </div>
                      <div className="text-right">
                        <Badge tone={submission.status === 'graded' ? 'success' : submission.status === 'late' ? 'warning' : 'info'}>
                          {submission.status}
                        </Badge>
                        {submission.marksObtained !== null ? (
                          <p className="mt-1 text-xs font-semibold text-ink-600">
                            {submission.marksObtained}/{submission.assignment?.totalMarks}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState icon={BadgeCheck} title="No submissions yet" />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="AI quiz attempts" icon={Award} />
              <div className="divide-y divide-ink-100">
                {attempts?.length ? (
                  attempts.map((attempt) => (
                    <div key={attempt._id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-800">{attempt.quiz?.title}</p>
                        <p className="text-xs text-ink-500">{formatDateTime(attempt.submittedAt)}</p>
                      </div>
                      <span className={`text-sm font-bold ${percentageColor(attempt.percentage)}`}>{attempt.percentage}%</span>
                    </div>
                  ))
                ) : (
                  <EmptyState icon={Award} title="No quiz attempts" />
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'profile' ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Student details" icon={User} />
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {[
                ['Admission number', student.admissionNo || '—'],
                ['Date of birth', formatDate(student.dateOfBirth)],
                ['Gender', student.gender || '—'],
                ['Blood group', student.bloodGroup || '—'],
                ['Division / Batch', `${student.division || '—'} / ${student.batch || '—'}`],
                ['Status', student.status],
                ['Address', student.address || '—'],
                ['Enrolled subjects', (student.subjects || []).length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-ink-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-ink-800">{value}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Guardian" subtitle="Receives WhatsApp attendance alerts" icon={Phone} />
            <div className="grid gap-3 p-5">
              {[
                ['Name', student.guardian?.name || '—'],
                ['Relation', student.guardian?.relation || '—'],
                ['WhatsApp number', student.guardian?.phone || 'Not provided'],
                ['Email', student.guardian?.email || '—'],
                ['Alerts enabled', student.guardian?.whatsappOptIn === false ? 'No (opted out)' : 'Yes'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-ink-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-ink-800">{value}</p>
                </div>
              ))}
              <Button variant="whatsapp" icon={MessageCircle} onClick={sendGuardianAlert} loading={sending}>
                Send attendance alert now
              </Button>
              <Link to="/teacher/whatsapp-alerts" className="btn-secondary">
                Open alerts panel
              </Link>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

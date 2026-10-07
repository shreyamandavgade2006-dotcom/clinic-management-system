import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Award, BarChart3, BookOpen, ClipboardCheck, TrendingUp, Users } from 'lucide-react';
import { attendanceApi, dashboardApi, markApi, subjectApi } from '../../api/endpoints';
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
import { AttendanceTrendChart, DonutChart, GradeDistributionChart, SubjectBarChart } from '../../components/charts';
import { gradeColor, pct, percentageColor } from '../../utils/format';

export default function TeacherAnalytics() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [classes, setClasses] = useState([]);
  const [className, setClassName] = useState('');
  const [performance, setPerformance] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    Promise.all([dashboardApi.teacher(), subjectApi.list({ mine: true })])
      .then(([dashboardResult, subjectsResult]) => {
        setOverview(dashboardResult.data);
        const list = subjectsResult.data || [];
        const unique = [...new Set(list.map((subject) => subject.className))];
        setClasses(unique);
        setClassName((current) => current || unique[0] || '');
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const loadClass = useCallback(() => {
    if (!className) return;
    markApi
      .classPerformance(className)
      .then((result) => setPerformance(result.data))
      .catch((requestError) => toast(requestError.message, 'error'));
    attendanceApi
      .classSummary(className)
      .then((result) => setAttendance(result.data))
      .catch(() => {});
    dashboardApi
      .leaderboard(className, { limit: 10 })
      .then((result) => setLeaderboard(result.data?.leaderboard || result.data || []))
      .catch(() => {});
  }, [className]);

  useEffect(() => {
    loadClass();
  }, [loadClass]);

  const gradeDonut = useMemo(() => {
    if (!performance?.distribution) return [];
    return performance.distribution
      .filter((entry) => entry.count > 0)
      .map((entry) => ({ name: `Grade ${entry.label}`, value: entry.count }));
  }, [performance]);

  if (loading) return <PageLoader />;
  if (error) return <Alert tone="danger" title="Could not load analytics">{error}</Alert>;

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Performance Analytics"
        subtitle="Class-level insight into attendance, marks, grades and AI quiz outcomes"
        action={
          <div className="flex items-center gap-2">
            <select className="input w-40" value={className} onChange={(event) => setClassName(event.target.value)}>
              {classes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={loadClass}>
              Refresh
            </Button>
          </div>
        }
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview', icon: BarChart3 },
          { value: 'attendance', label: 'Attendance', icon: ClipboardCheck },
          { value: 'marks', label: 'Marks & grades', icon: BookOpen },
        ]}
      />

      {overview ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Students taught" value={overview.studentCount} hint={`${overview.classCount ?? overview.classes?.length ?? 0} classes · ${overview.subjectCount} subjects`} icon={Users} tone="brand" />
          <StatCard label="Attendance" value={pct(overview.attendance?.percentage || 0)} hint={`${overview.attendance?.totalSessions || 0} sessions marked`} icon={ClipboardCheck} tone="success" trend={<ProgressBar value={overview.attendance?.percentage || 0} />} />
          <StatCard label="Class average" value={pct(performance?.classAverage || 0)} hint={`Pass rate ${performance?.passPercentage || 0}%`} icon={TrendingUp} tone="purple" />
          <StatCard label="Below 75%" value={overview.defaultersCount} hint="Attendance defaulters" icon={Award} tone={overview.defaultersCount ? 'danger' : 'success'} />
        </div>
      ) : null}

      {tab === 'overview' ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader title="Attendance trend" subtitle="Monthly attendance percentage across your classes" icon={ClipboardCheck} />
            <div className="p-4">
              <AttendanceTrendChart data={(overview?.attendanceTrend || []).map((entry) => ({ month: entry.label, percentage: entry.percentage }))} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Class comparison" subtitle="Attendance and defaulters per class" icon={Users} />
            <div className="divide-y divide-ink-100">
              {(overview?.classSummaries || []).map((summary) => (
                <div key={summary.className} className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-ink-800">{summary.className}</p>
                      <p className="text-xs text-ink-500">
                        {summary.students} students · {summary.defaulters} below 75%
                      </p>
                    </div>
                    <span className={`text-sm font-bold ${percentageColor(summary.attendance)}`}>{pct(summary.attendance)}</span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={summary.attendance} height="h-1.5" />
                  </div>
                </div>
              ))}
              {!overview?.classSummaries?.length ? <EmptyState icon={Users} title="No classes assigned" /> : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Subject averages" subtitle={className ? `Average marks per subject in ${className}` : 'Select a class'} icon={BookOpen} />
            <div className="p-4">
              <SubjectBarChart data={performance?.subjectAverages || []} dataKey="average" />
            </div>
          </Card>

          <Card>
            <CardHeader title="Top performers" subtitle="Highest overall percentage" icon={Award} />
            <div className="divide-y divide-ink-100">
              {(leaderboard.length ? leaderboard : overview?.toppers || []).slice(0, 6).map((student, index) => (
                <div key={student.studentId || student._id || index} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{index + 1}</span>
                  <Avatar name={student.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/teacher/students/${student.studentId || student._id}`} className="truncate text-sm font-medium text-ink-800 hover:text-brand-600">
                      {student.name}
                    </Link>
                    <p className="text-xs text-ink-500">{student.rollNo}</p>
                  </div>
                  <Badge className={gradeColor(student.grade)}>{student.grade || '—'}</Badge>
                  <span className="w-16 text-right text-sm font-bold text-ink-700">{pct(student.percentage)}</span>
                </div>
              ))}
              {!leaderboard.length && !overview?.toppers?.length ? <EmptyState icon={Award} title="No marks recorded yet" /> : null}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'attendance' ? (
        <>
          <div className="grid gap-5 xl:grid-cols-[1fr,2fr]">
            <Card>
              <CardHeader title="Session mix" subtitle={`${attendance?.totalRecords || 0} records in ${className}`} icon={ClipboardCheck} />
              <div className="p-4">
                <DonutChart
                  centerValue={pct(attendance?.classAverage || 0)}
                  centerLabel="Class average"
                  data={[
                    { name: 'Present', value: attendance?.today?.present || 0, color: '#10b981' },
                    { name: 'Absent', value: attendance?.today?.absent || 0, color: '#ef4444' },
                    { name: 'Late', value: attendance?.today?.late || 0, color: '#f59e0b' },
                    { name: 'Excused', value: attendance?.today?.excused || 0, color: '#0ea5e9' },
                  ]}
                />
              </div>
            </Card>

            <Card>
              <CardHeader title="Students below 75%" subtitle="Sorted by severity" icon={AlertTriangle} />
              <div className="divide-y divide-ink-100">
                {(attendance?.defaulters || []).length ? (
                  attendance.defaulters.map((row) => (
                    <div key={row.studentId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <Avatar name={row.name} size={34} />
                      <div className="min-w-0 flex-1">
                        <Link to={`/teacher/students/${row.studentId}`} className="text-sm font-medium text-ink-800 hover:text-brand-600">
                          {row.name}
                        </Link>
                        <p className="text-xs text-ink-500">
                          {row.rollNo} · {row.attended}/{row.totalSessions} sessions · guardian {row.guardianPhone || 'unavailable'}
                        </p>
                      </div>
                      <div className="w-40">
                        <ProgressBar value={row.percentage} showLabel />
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState icon={ClipboardCheck} title="No defaulters" message="Every student in this class is above 75% attendance." />
                )}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Full attendance board" subtitle="Every student with subject-wise split" icon={Users} />
            <div className="table-wrapper border-0 shadow-none">
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Roll No</th>
                    <th>Present</th>
                    <th>Absent</th>
                    <th>Late</th>
                    <th>Percentage</th>
                    <th>Weakest subject</th>
                  </tr>
                </thead>
                <tbody>
                  {(attendance?.rows || []).map((row) => {
                    const weakest = [...(row.subjects || [])].sort((a, b) => a.percentage - b.percentage)[0];
                    return (
                      <tr key={row.studentId}>
                        <td>
                          <Link to={`/teacher/students/${row.studentId}`} className="font-medium text-ink-800 hover:text-brand-600">
                            {row.name}
                          </Link>
                        </td>
                        <td className="font-mono text-xs">{row.rollNo}</td>
                        <td>{row.present}</td>
                        <td>{row.absent}</td>
                        <td>{row.late}</td>
                        <td className="w-44">
                          <ProgressBar value={row.percentage} showLabel />
                        </td>
                        <td className="text-xs text-ink-500">{weakest ? `${weakest.name} (${weakest.percentage}%)` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Link to="/teacher/whatsapp-alerts" className="btn-whatsapp w-fit">
            Send WhatsApp alerts to guardians of defaulters
          </Link>
        </>
      ) : null}

      {tab === 'marks' ? (
        <>
          <div className="grid gap-5 xl:grid-cols-[2fr,1fr]">
            <Card>
              <CardHeader title="Grade distribution" subtitle={`${performance?.students?.length || 0} students graded in ${className}`} icon={Award} />
              <div className="p-4">
                <GradeDistributionChart data={(performance?.distribution || []).map((entry) => ({ ...entry, label: entry.label || entry.range }))} />
              </div>
            </Card>

            <Card>
              <CardHeader title="Grade share" icon={BarChart3} />
              <div className="p-4">
                <DonutChart centerValue={pct(performance?.classAverage || 0)} centerLabel="Class average" data={gradeDonut} />
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Subject-wise averages" subtitle="Average, highest and lowest per subject" icon={BookOpen} />
            <div className="table-wrapper border-0 shadow-none">
              <table className="table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Code</th>
                    <th>Average</th>
                    <th>Highest</th>
                    <th>Lowest</th>
                    <th>Records</th>
                  </tr>
                </thead>
                <tbody>
                  {(performance?.subjectAverages || []).map((subject) => (
                    <tr key={subject.subjectId}>
                      <td className="font-medium text-ink-800">{subject.name}</td>
                      <td className="font-mono text-xs">{subject.code}</td>
                      <td className="w-48">
                        <ProgressBar value={subject.average} showLabel />
                      </td>
                      <td className={percentageColor(subject.highest)}>{pct(subject.highest)}</td>
                      <td className={percentageColor(subject.lowest)}>{pct(subject.lowest)}</td>
                      <td>{subject.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Complete ranking" subtitle="Every graded student" icon={TrendingUp} />
            <div className="table-wrapper border-0 shadow-none">
              <table className="table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Student</th>
                    <th>Roll No</th>
                    <th>Exams</th>
                    <th>Percentage</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {(performance?.students || []).map((student) => (
                    <tr key={student.studentId}>
                      <td>{student.rank}</td>
                      <td>
                        <Link to={`/teacher/students/${student.studentId}`} className="font-medium text-ink-800 hover:text-brand-600">
                          {student.name}
                        </Link>
                      </td>
                      <td className="font-mono text-xs">{student.rollNo}</td>
                      <td>{student.exams}</td>
                      <td className="w-44">
                        <ProgressBar value={student.percentage} showLabel />
                      </td>
                      <td>
                        <Badge className={gradeColor(student.grade)}>{student.grade}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

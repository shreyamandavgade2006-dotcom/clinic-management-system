import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock, ClipboardCheck, Download, Info, XCircle } from 'lucide-react';
import { attendanceApi } from '../../api/endpoints';
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
  Tabs,
} from '../../components/ui';
import { AttendanceTrendChart, SubjectBarChart } from '../../components/charts';
import { formatDate, pct } from '../../utils/format';

const STATUS_STYLES = {
  present: { tone: 'success', icon: CheckCircle2, label: 'Present' },
  absent: { tone: 'danger', icon: XCircle, label: 'Absent' },
  late: { tone: 'warning', icon: Clock, label: 'Late' },
  excused: { tone: 'info', icon: Info, label: 'Excused' },
};

export default function StudentAttendance() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');

  useEffect(() => {
    attendanceApi
      .studentSummary('me')
      .then((result) => setData(result.data))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredHistory = useMemo(() => {
    if (!data) return [];
    let records = data.recent || [];
    if (subjectFilter) records = records.filter((record) => record.subjectCode === subjectFilter);
    if (historyFilter !== 'all') records = records.filter((record) => record.status === historyFilter);
    return records;
  }, [data, subjectFilter, historyFilter]);

  if (loading) return <PageLoader />;
  if (error) return <Alert tone="danger" title="Could not load attendance">{error}</Alert>;
  if (!data) return null;

  const { overall, subjectWise, monthly } = data;
  const atRisk = overall.percentage < overall.threshold;
  const sessionsNeeded = (() => {
    let attended = overall.attended;
    let total = overall.totalSessions;
    let needed = 0;
    while (total > 0 && (attended / total) * 100 < overall.threshold && needed < 200) {
      attended += 1;
      total += 1;
      needed += 1;
    }
    return needed;
  })();

  return (
    <div className="space-y-6">
      <SectionTitle
        title="My Attendance"
        subtitle={`${user?.name} · Roll No ${data.student?.rollNo} · Class ${data.student?.className}`}
        action={
          <Button variant="secondary" icon={Download} onClick={() => window.print()}>
            Print / Save PDF
          </Button>
        }
      />

      {atRisk ? (
        <Alert tone="danger" title={`You are below the ${overall.threshold}% requirement`}>
          Your overall attendance is <strong>{overall.percentage}%</strong>. Attending the next <strong>{sessionsNeeded}</strong> sessions
          without a break will bring you back to {overall.threshold}%. Your guardian has already been informed on WhatsApp.
        </Alert>
      ) : (
        <Alert tone="success" title="You are eligible">
          Your attendance ({overall.percentage}%) is above the required {overall.threshold}%. Keep it up!
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Overall attendance" value={pct(overall.percentage)} hint={`${overall.attended}/${overall.totalSessions} sessions`} icon={ClipboardCheck} tone={atRisk ? 'danger' : 'success'} trend={<ProgressBar value={overall.percentage} />} />
        <StatCard label="Present" value={overall.present} hint={`${overall.late} late arrivals`} icon={CheckCircle2} tone="success" />
        <StatCard label="Absent" value={overall.absent} hint={`${overall.excused} approved leaves`} icon={XCircle} tone="danger" />
        <StatCard
          label="Sessions to recover"
          value={atRisk ? sessionsNeeded : 0}
          hint={atRisk ? `To reach ${overall.threshold}%` : 'Already above threshold'}
          icon={Clock}
          tone={atRisk ? 'warning' : 'info'}
        />
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview', icon: CalendarDays },
          { value: 'subjects', label: 'Subject-wise', icon: ClipboardCheck },
          { value: 'history', label: 'History', icon: Clock },
        ]}
      />

      {tab === 'overview' ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader title="Monthly trend" subtitle="Attendance percentage per month" icon={CalendarDays} />
            <div className="p-4">
              <AttendanceTrendChart data={monthly} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Subject-wise percentage" subtitle="Subjects sorted from lowest to highest" icon={ClipboardCheck} />
            <div className="p-4">
              <SubjectBarChart data={subjectWise} />
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'subjects' ? (
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
              {subjectWise.map((subject) => (
                <tr key={subject.subjectId}>
                  <td className="font-medium text-ink-800">{subject.name}</td>
                  <td>
                    <Badge tone="neutral">{subject.code}</Badge>
                  </td>
                  <td>{subject.totalSessions}</td>
                  <td>{subject.attended}</td>
                  <td className="w-48">
                    <ProgressBar value={subject.percentage} showLabel />
                  </td>
                  <td>
                    {subject.totalSessions === 0 ? (
                      <Badge tone="neutral">No sessions</Badge>
                    ) : subject.percentage >= overall.threshold ? (
                      <Badge tone="success" dot>
                        Safe
                      </Badge>
                    ) : (
                      <Badge tone="danger" dot>
                        Below {overall.threshold}%
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'history' ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">Subject</label>
              <select className="input w-56" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
                <option value="">All subjects</option>
                {subjectWise.map((subject) => (
                  <option key={subject.subjectId} value={subject.code}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input w-40" value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value)}>
                <option value="all">All</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="excused">Excused</option>
              </select>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Subject</th>
                  <th>Period</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length ? (
                  filteredHistory.map((record) => {
                    const style = STATUS_STYLES[record.status] || STATUS_STYLES.present;
                    const Icon = style.icon;
                    return (
                      <tr key={record._id}>
                        <td>{formatDate(record.date, { weekday: 'short' })}</td>
                        <td>
                          {record.subject} <span className="text-xs text-ink-400">({record.subjectCode})</span>
                        </td>
                        <td>P{record.period}</td>
                        <td>
                          <Badge tone={style.tone}>
                            <Icon size={13} /> {style.label}
                          </Badge>
                        </td>
                        <td className="text-ink-500">{record.remarks || '—'}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState icon={CalendarDays} title="No records match the filters" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-500">
            Showing the latest {data.recent?.length || 0} sessions. Attendance policy: present and late count as attended, excused leaves are
            excluded from the total.
          </p>
        </>
      ) : null}
    </div>
  );
}

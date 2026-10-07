import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  MessageCircle,
  Save,
  Send,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { attendanceApi, subjectApi, whatsappApi } from '../../api/endpoints';
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
import { SubjectBarChart } from '../../components/charts';
import { formatDate, percentageColor, pct } from '../../utils/format';

const STATUSES = [
  { value: 'present', label: 'Present', tone: 'success' },
  { value: 'absent', label: 'Absent', tone: 'danger' },
  { value: 'late', label: 'Late', tone: 'warning' },
  { value: 'excused', label: 'Excused', tone: 'info' },
];

export default function TeacherAttendance() {
  const [subjects, setSubjects] = useState([]);
  const [tab, setTab] = useState('mark');
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(null);
  const [marks, setMarks] = useState({});
  const [subjectId, setSubjectId] = useState('');
  const [period, setPeriod] = useState(1);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [board, setBoard] = useState(null);
  const [defaulters, setDefaulters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [className, setClassName] = useState('');
  const [alerting, setAlerting] = useState(false);

  useEffect(() => {
    subjectApi
      .list({ mine: true })
      .then((result) => {
        const list = result.data || [];
        setSubjects(list);
        if (list[0]) setSubjectId(list[0]._id);
        const uniqueClasses = [...new Set(list.map((subject) => subject.className))];
        setClasses(uniqueClasses);
        setClassName((current) => current || uniqueClasses[0] || '');
      })
      .catch((error) => toast(error.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const loadSheet = useCallback(() => {
    if (!subjectId) return;
    attendanceApi
      .session({ subject: subjectId, date, period })
      .then((result) => {
        setSheet(result.data);
        const initial = {};
        result.data.students.forEach((student) => {
          initial[student._id] = student.existing?.status || 'present';
        });
        setMarks(initial);
      })
      .catch((error) => toast(error.message, 'error'));
  }, [subjectId, date, period]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  const loadBoard = useCallback(() => {
    if (!className) return;
    attendanceApi
      .classSummary(className)
      .then((result) => setBoard(result.data))
      .catch((error) => toast(error.message, 'error'));
    attendanceApi
      .defaulters({ className })
      .then((result) => setDefaulters(result.data?.defaulters || []))
      .catch(() => {});
  }, [className]);

  useEffect(() => {
    if (className) loadBoard();
  }, [className, loadBoard]);

  const counts = useMemo(() => {
    const values = Object.values(marks);
    return {
      present: values.filter((value) => value === 'present').length,
      absent: values.filter((value) => value === 'absent').length,
      late: values.filter((value) => value === 'late').length,
      excused: values.filter((value) => value === 'excused').length,
    };
  }, [marks]);

  const save = async () => {
    setSaving(true);
    try {
      const records = Object.entries(marks).map(([student, status]) => ({ student, status }));
      const result = await attendanceApi.mark({
        subject: subjectId,
        date,
        period: Number(period),
        records,
        sendWhatsAppAlerts: sendWhatsApp,
        notifyStudents: true,
      });
      toast(
        `Attendance saved for ${result.data.saved} students${result.data.alerts ? ` · ${result.data.alerts.filter((a) => a.status === 'sent').length} WhatsApp alerts sent` : ''}`,
        'success'
      );
      loadSheet();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const markAll = (status) => {
    const next = {};
    (sheet?.students || []).forEach((student) => {
      next[student._id] = status;
    });
    setMarks(next);
  };

  const subjectAverages = useMemo(() => {
    const buckets = new Map();
    (board?.rows || []).forEach((row) => {
      (row.subjects || []).forEach((subject) => {
        const entry = buckets.get(subject.subjectId) || { subjectId: subject.subjectId, shortName: subject.code || subject.name, total: 0, count: 0 };
        entry.total += subject.percentage;
        entry.count += 1;
        buckets.set(subject.subjectId, entry);
      });
    });
    return [...buckets.values()]
      .map((entry) => ({ subjectId: entry.subjectId, shortName: entry.shortName, percentage: Math.round((entry.total / entry.count) * 10) / 10 }))
      .sort((a, b) => b.percentage - a.percentage);
  }, [board]);

  const runAlerts = async (dryRun) => {
    setAlerting(true);
    try {
      const result = await whatsappApi.runAlerts({ className: className || undefined, dryRun });
      const data = result.data;
      toast(
        dryRun
          ? `${data.scanned} defaulter(s) found — preview generated`
          : `Alerts processed: ${data.sent} sent, ${data.failed} failed, ${data.skippedNoPhone + data.skippedOptOut + data.skippedCooldown} skipped`,
        data.failed ? 'warning' : 'success'
      );
      if (!dryRun) loadBoard();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setAlerting(false);
    }
  };

  if (loading) return <PageLoader />;

  const selectedSubject = subjects.find((subject) => subject._id === subjectId);

  return (
    <div className="space-y-6">
      <SectionTitle title="Attendance" subtitle="Mark sessions in seconds and identify students below the 75% threshold" />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'mark', label: 'Mark attendance', icon: UserCheck },
          { value: 'board', label: 'Class board', icon: Users },
          { value: 'defaulters', label: 'Below 75%', icon: AlertTriangle, count: defaulters.length },
        ]}
      />

      {tab === 'mark' ? (
        <>
          <Card className="card-pad">
            <div className="grid gap-4 lg:grid-cols-4">
              <div>
                <label className="label">Subject</label>
                <select className="input" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
                  {subjects.map((subject) => (
                    <option key={subject._id} value={subject._id}>
                      {subject.code} — {subject.name} ({subject.className})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setDate(event.target.value)} />
              </div>
              <div>
                <label className="label">Period</label>
                <select className="input" value={period} onChange={(event) => setPeriod(Number(event.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map((value) => (
                    <option key={value} value={value}>
                      Period {value}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button variant="secondary" icon={CalendarDays} onClick={loadSheet} className="w-full">
                  Reload sheet
                </Button>
              </div>
            </div>

            {!subjects.length ? (
              <Alert tone="warning" className="mt-4" title="No subjects assigned">
                Ask the administrator to assign subjects to your account, or create one from the Subjects page.
              </Alert>
            ) : null}
          </Card>

          {sheet ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Students" value={sheet.students.length} hint={`${sheet.subject.code} · ${formatDate(sheet.date)}`} icon={Users} tone="brand" />
                <StatCard label="Present + Late" value={counts.present + counts.late} icon={CheckCircle2} tone="success" />
                <StatCard label="Absent" value={counts.absent} icon={UserX} tone="danger" />
                <StatCard label="Excused" value={counts.excused} icon={Clock} tone="info" />
              </div>

              {sheet.alreadyMarked ? (
                <Alert tone="info" title="Attendance already recorded for this session">
                  You can change any entry below and save again — existing records are updated.
                </Alert>
              ) : null}

              <Card>
                <CardHeader
                  title={`${sheet.subject.name} · Period ${sheet.period}`}
                  subtitle={`${formatDate(sheet.date, { weekday: 'long' })} · ${sheet.students.length} students`}
                  icon={ClipboardCheck}
                  action={
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => markAll('present')}>
                        All present
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => markAll('absent')}>
                        All absent
                      </Button>
                    </div>
                  }
                />
                <div className="divide-y divide-ink-100">
                  {sheet.students.map((student) => (
                    <div key={student._id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <Avatar name={student.name} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-800">{student.name}</p>
                        <p className="text-xs text-ink-500">
                          {student.rollNo}
                          {student.guardianPhone ? ` · ${student.guardianPhone}` : ' · no WhatsApp'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {STATUSES.map((status) => (
                          <button
                            key={status.value}
                            onClick={() => setMarks({ ...marks, [student._id]: status.value })}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                              marks[student._id] === status.value
                                ? status.value === 'present'
                                  ? 'border-success-500 bg-success-50 text-success-700'
                                  : status.value === 'absent'
                                    ? 'border-danger-500 bg-danger-50 text-danger-700'
                                    : status.value === 'late'
                                      ? 'border-warning-400 bg-warning-50 text-amber-700'
                                      : 'border-sky-400 bg-sky-50 text-sky-700'
                                : 'border-ink-200 text-ink-500 hover:border-ink-300 hover:bg-ink-50'
                            }`}
                          >
                            {status.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 p-4">
                  <label className="flex items-center gap-2 text-sm text-ink-600">
                    <input
                      type="checkbox"
                      checked={sendWhatsApp}
                      onChange={(event) => setSendWhatsApp(event.target.checked)}
                      className="h-4 w-4 rounded border-ink-300 text-brand-600"
                    />
                    Send WhatsApp alerts to guardians of absent students
                  </label>
                  <Button onClick={save} loading={saving} icon={Save}>
                    Save attendance ({Object.keys(marks).length} students)
                  </Button>
                </div>
              </Card>
            </>
          ) : (
            <Card>
              <EmptyState icon={ClipboardCheck} title="Select a subject to load the attendance sheet" />
            </Card>
          )}
        </>
      ) : null}

      {tab === 'board' ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">Class</label>
              <select className="input w-48" value={className} onChange={(event) => setClassName(event.target.value)}>
                <option value="">Select class</option>
                {classes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            {board ? (
              <>
                <Badge tone="brand">Class average {pct(board.classAverage)}</Badge>
                <Badge tone="neutral">{board.totalStudents} students</Badge>
                <Badge tone="neutral">{board.totalRecords} records</Badge>
              </>
            ) : null}
          </div>

          {board ? (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Roll No</th>
                    <th>Sessions</th>
                    <th>Attended</th>
                    <th>Percentage</th>
                    <th>Weakest subject</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {board.rows.map((row) => (
                    <tr key={row.studentId}>
                      <td>
                        <Link to={`/teacher/students/${row.studentId}`} className="flex items-center gap-3 group">
                          <Avatar name={row.name} size={34} />
                          <span className="font-medium text-ink-800 group-hover:text-brand-600">{row.name}</span>
                        </Link>
                      </td>
                      <td className="font-mono text-xs">{row.rollNo}</td>
                      <td>{row.totalSessions}</td>
                      <td>{row.attended}</td>
                      <td className="w-44">
                        <ProgressBar value={row.percentage} showLabel />
                      </td>
                      <td className="text-xs text-ink-500">
                        {row.subjects?.length ? `${row.subjects[0].name} (${row.subjects[0].percentage}%)` : '—'}
                      </td>
                      <td>
                        {row.isDefaulter ? (
                          <Badge tone="danger" dot>
                            Below 75%
                          </Badge>
                        ) : (
                          <Badge tone="success" dot>
                            Safe
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Card>
              <EmptyState icon={Users} title="Pick a class" message="Select a class to see the attendance board." />
            </Card>
          )}

          {board?.today?.totalSessions ? (
            <Card>
              <CardHeader title="Today's attendance" subtitle={`${board.today.percentage}% attendance recorded today`} icon={CalendarDays} />
              <div className="p-5">
                <ProgressBar value={board.today.percentage} />
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-ink-600">
                  <span>Present: {board.today.present}</span>
                  <span>Absent: {board.today.absent}</span>
                  <span>Late: {board.today.late}</span>
                  <span>Excused: {board.today.excused}</span>
                </div>
              </div>
            </Card>
          ) : null}
        </>
      ) : null}

      {tab === 'defaulters' ? (
        <>
          <Card className="card-pad">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <label className="label">Class</label>
                <select className="input w-48" value={className} onChange={(event) => setClassName(event.target.value)}>
                  <option value="">Select class</option>
                  {classes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => runAlerts(true)} loading={alerting}>
                  Preview alerts
                </Button>
                <Button variant="whatsapp" icon={Send} onClick={() => runAlerts(false)} loading={alerting} disabled={!defaulters.length}>
                  Send WhatsApp alerts
                </Button>
                <Link to="/teacher/whatsapp-alerts" className="btn-secondary">
                  <MessageCircle size={15} /> Alerts panel
                </Link>
              </div>
            </div>
          </Card>

          {defaulters.length ? (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Roll No</th>
                    <th>Attendance</th>
                    <th>Sessions needed</th>
                    <th>Weakest subject</th>
                    <th>Guardian</th>
                    <th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {defaulters.map((row) => (
                    <tr key={row.studentId}>
                      <td>
                        <Link to={`/teacher/students/${row.studentId}`} className="flex items-center gap-3 group">
                          <Avatar name={row.name} size={34} />
                          <span className="font-medium text-ink-800 group-hover:text-brand-600">{row.name}</span>
                        </Link>
                      </td>
                      <td className="font-mono text-xs">{row.rollNo}</td>
                      <td className={percentageColor(row.percentage)}>{row.percentage}%</td>
                      <td>{row.sessionsNeeded}</td>
                      <td className="text-xs text-ink-500">{row.worstSubject ? `${row.worstSubject.name} (${row.worstSubject.percentage}%)` : '—'}</td>
                      <td>
                        <p className="text-sm text-ink-700">{row.guardianName || '—'}</p>
                        <p className="text-xs text-ink-500">{row.guardianPhone || 'No WhatsApp number'}</p>
                      </td>
                      <td>
                        <Badge tone={row.riskLevel === 'critical' ? 'danger' : row.riskLevel === 'high' ? 'warning' : 'neutral'}>
                          {row.riskLevel}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Card>
              <EmptyState
                icon={CheckCircle2}
                title={className ? 'No defaulters in this class' : 'Select a class'}
                message={className ? 'Every student is above the 75% threshold. Great work!' : 'Choose a class to list students below 75%.'}
              />
            </Card>
          )}

          {className ? (
            <Card>
              <CardHeader title="Subject-wise class attendance" subtitle="Average attendance per subject" icon={ClipboardCheck} />
              <div className="p-4">
                <SubjectBarChart data={subjectAverages} />
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

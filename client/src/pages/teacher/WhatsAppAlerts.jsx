import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Users,
  XCircle,
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
import { formatDateTime, humanise, pct, relativeTime } from '../../utils/format';

const STATUS_TONES = {
  sent: 'success',
  simulated: 'info',
  queued: 'warning',
  failed: 'danger',
  skipped: 'neutral',
};

export default function TeacherWhatsAppAlerts() {
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [defaulters, setDefaulters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [className, setClassName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('defaulters');
  const [running, setRunning] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);
  const [preview, setPreview] = useState(null);

  const loadLogs = useCallback(() => {
    whatsappApi
      .logs({ limit: 50 })
      .then((result) => setLogs(result.data || []))
      .catch(() => {});
  }, []);

  const loadDefaulters = useCallback(() => {
    whatsappApi
      .defaulters(className ? { className } : undefined)
      .then((result) => setDefaulters(Array.isArray(result.data) ? result.data : result.data?.defaulters || []))
      .catch(() => {});
  }, [className]);

  useEffect(() => {
    Promise.all([whatsappApi.status(), subjectApi.list({ mine: true })])
      .then(([statusResult, subjectsResult]) => {
        setStatus(statusResult.data);
        const list = subjectsResult.data || [];
        setSubjects(list);
        const unique = [...new Set(list.map((subject) => subject.className))];
        setClassName(unique[0] || '');
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    loadDefaulters();
  }, [loadDefaulters]);

  const runAlerts = async (dryRun) => {
    setRunning(dryRun ? 'preview' : 'send');
    try {
      const result = await whatsappApi.runAlerts({ className: className || undefined, dryRun });
      const data = result.data;
      if (dryRun) {
        setPreview(data);
        toast(`Preview ready — ${data.scanned ?? data.alerts?.length ?? 0} guardian(s) would be notified`, 'info');
      } else {
        toast(`Alerts processed: ${data.sent || 0} sent · ${data.failed || 0} failed · ${(data.skippedNoPhone || 0) + (data.skippedOptOut || 0) + (data.skippedCooldown || 0)} skipped`, data.failed ? 'warning' : 'success');
        setPreview(null);
        loadLogs();
        loadDefaulters();
      }
    } catch (runError) {
      toast(runError.message, 'error');
    } finally {
      setRunning('');
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const result = await whatsappApi.test({ to: testPhone, message: 'Test message from SSMS — your WhatsApp alerts are configured correctly.' });
      toast(result.data?.status === 'failed' ? 'Provider rejected the message — check credentials' : 'Test message dispatched', result.data?.status === 'failed' ? 'error' : 'success');
      loadLogs();
    } catch (testError) {
      toast(testError.message, 'error');
    } finally {
      setTesting(false);
    }
  };

  const sendOne = async (student) => {
    try {
      const recent = await attendanceApi.list({ student: student.studentId, limit: 1 });
      const record = recent.data?.[0];
      if (!record) {
        toast('No attendance record found for this student', 'error');
        return;
      }
      const result = await attendanceApi.notifyGuardian(record._id);
      toast(result.data?.success === false ? result.data.error : `Alert sent to ${result.data?.to || student.guardianPhone}`, result.data?.success === false ? 'error' : 'success');
      loadLogs();
    } catch (alertError) {
      toast(alertError.message, 'error');
    }
  };

  const stats = useMemo(() => {
    const sent = logs.filter((log) => ['sent', 'simulated'].includes(log.status)).length;
    const failed = logs.filter((log) => log.status === 'failed').length;
    return { sent, failed, total: logs.length };
  }, [logs]);

  if (loading) return <PageLoader />;
  if (error) return <Alert tone="danger" title="Could not load WhatsApp configuration">{error}</Alert>;

  const provider = status?.provider || 'console';
  const live = Boolean(status?.configured?.twilio || status?.configured?.meta);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="WhatsApp Attendance Alerts"
        subtitle="Automatically notify parents and guardians whenever a student drops below 75% attendance"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={RefreshCw} onClick={() => { loadLogs(); loadDefaulters(); }}>
              Refresh
            </Button>
            <Button variant="secondary" onClick={() => runAlerts(true)} loading={running === 'preview'}>
              Preview alerts
            </Button>
            <Button variant="whatsapp" icon={Send} onClick={() => runAlerts(false)} loading={running === 'send'}>
              Send alerts now
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Provider"
          value={humanise(provider)}
          hint={live ? 'Live credentials detected' : 'Simulation mode — messages are logged only'}
          icon={Settings}
          tone={live ? 'success' : 'info'}
        />
        <StatCard label="Defaulters" value={defaulters.length} hint="Below 75% attendance" icon={AlertTriangle} tone={defaulters.length ? 'danger' : 'success'} />
        <StatCard label="Messages sent" value={stats.sent} hint={`${stats.failed} failed of ${stats.total} attempts`} icon={CheckCircle2} tone="brand" />
        <StatCard label="Threshold" value={pct(status?.threshold || 75, 0)} hint="Configurable via ATTENDANCE_THRESHOLD" icon={ShieldCheck} tone="purple" />
      </div>

      {!live ? (
        <Alert tone="info" title="Running in simulation mode">
          No WhatsApp Business credentials are configured, so alerts are recorded in the log with a <code>simulated</code> status instead of being delivered.
          Add <code>TWILIO_ACCOUNT_SID</code>/<code>TWILIO_AUTH_TOKEN</code> (or the Meta Cloud API token) to <code>server/.env</code> to go live.
        </Alert>
      ) : null}

      {preview ? (
        <Card>
          <CardHeader
            title="Alert preview (not sent)"
            subtitle={`${preview.alerts?.length || preview.scanned || 0} guardian(s) would receive a WhatsApp message`}
            icon={Info}
            action={
              <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
                Clear
              </Button>
            }
          />
          <div className="divide-y divide-ink-100">
            {(preview.alerts || []).map((entry, index) => (
              <div key={entry.studentId || index} className="px-5 py-4">
                <p className="text-sm font-semibold text-ink-800">
                  {entry.name || entry.studentName} · <span className="font-normal text-ink-500">{entry.guardian || entry.phone || entry.to}</span>
                </p>
                <p className="mt-1 whitespace-pre-line rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{entry.preview || entry.message || entry.body || 'Attendance alert message'}</p>
              </div>
            ))}
            {!preview.alerts?.length ? <EmptyState icon={CheckCircle2} title="Nobody below the threshold" message="No alerts needed for this class right now." /> : null}
          </div>
        </Card>
      ) : null}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'defaulters', label: 'Students at risk', icon: AlertTriangle, count: defaulters.length },
          { value: 'logs', label: 'Delivery log', icon: MessageCircle, count: logs.length },
          { value: 'settings', label: 'Settings & test', icon: Settings },
        ]}
      />

      {tab === 'defaulters' ? (
        defaulters.length ? (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Attendance</th>
                  <th>Sessions needed</th>
                  <th>Weakest subject</th>
                  <th>Guardian</th>
                  <th>Risk</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {defaulters.map((row) => (
                  <tr key={row.studentId}>
                    <td>
                      <Link to={`/teacher/students/${row.studentId}`} className="flex items-center gap-3 group">
                        <Avatar name={row.name} size={34} />
                        <div>
                          <p className="font-medium text-ink-800 group-hover:text-brand-600">{row.name}</p>
                          <p className="text-xs text-ink-500">{row.rollNo}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="w-44">
                      <ProgressBar value={row.percentage} showLabel />
                    </td>
                    <td>
                      <span className="font-semibold text-ink-800">{row.sessionsNeeded}</span>
                      <p className="text-xs text-ink-500">consecutive sessions</p>
                    </td>
                    <td className="text-xs text-ink-500">{row.worstSubject ? `${row.worstSubject.name} (${row.worstSubject.percentage}%)` : '—'}</td>
                    <td>
                      <p className="text-sm text-ink-700">{row.guardianName || '—'}</p>
                      <p className="flex items-center gap-1 text-xs text-ink-500">
                        <Phone size={11} /> {row.guardianPhone || 'No number'}
                      </p>
                    </td>
                    <td>
                      <Badge tone={row.riskLevel === 'critical' ? 'danger' : row.riskLevel === 'high' ? 'warning' : 'neutral'}>{row.riskLevel}</Badge>
                    </td>
                    <td>
                      <Button size="sm" variant="whatsapp" icon={Send} onClick={() => sendOne(row)} disabled={!row.guardianPhone}>
                        Alert
                      </Button>
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
              title="No students below 75%"
              message="Every student in this class meets the attendance requirement — no alerts to send."
            />
          </Card>
        )
      ) : null}

      {tab === 'logs' ? (
        logs.length ? (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>To</th>
                  <th>Message</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td className="font-medium text-ink-800">{log.studentName || log.student?.user?.name || '—'}</td>
                    <td className="font-mono text-xs">{log.to}</td>
                    <td className="max-w-md">
                      <p className="line-clamp-2 text-xs text-ink-600">{log.body || log.message}</p>
                    </td>
                    <td>
                      <Badge tone="whatsapp">{log.provider || 'whatsapp'}</Badge>
                    </td>
                    <td>
                      <Badge tone={STATUS_TONES[log.status] || 'neutral'} dot>
                        {log.status}
                      </Badge>
                      {log.error ? <p className="mt-1 text-xs text-danger-600">{log.error}</p> : null}
                    </td>
                    <td className="text-xs text-ink-500">
                      {relativeTime(log.createdAt)}
                      <p className="text-[11px] text-ink-400">{formatDateTime(log.createdAt)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Card>
            <EmptyState icon={MessageCircle} title="No messages yet" message="Alerts you send will be listed here with delivery status." />
          </Card>
        )
      ) : null}

      {tab === 'settings' ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader title="Provider status" subtitle="How the alert pipeline is configured" icon={ShieldCheck} />
            <div className="space-y-3 p-5 text-sm">
              {[
                ['Provider', live ? humanise(provider) : 'Console (simulation)'],
                ['Twilio configured', status?.configured?.twilio ? 'Yes' : 'No'],
                ['Meta Cloud API configured', status?.configured?.meta ? 'Yes' : 'No'],
                ['Threshold', pct(status?.threshold || 75, 0)],
                ['Messages logged', status?.stats?.total ?? 0],
                ['Delivered / simulated', `${status?.stats?.sent ?? 0} / ${status?.stats?.simulated ?? 0}`],
                ['Failures', status?.stats?.failed ?? 0],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-2">
                  <span className="text-xs uppercase tracking-wide text-ink-500">{label}</span>
                  <span className="font-semibold text-ink-800">{value}</span>
                </div>
              ))}
              {status?.mode ? (
                <p className="flex items-start gap-2 rounded-xl bg-sky-50 px-4 py-3 text-xs text-sky-800">
                  <Info size={14} className="mt-0.5 shrink-0" /> {status.mode}
                </p>
              ) : null}
            </div>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader title="Send a test message" subtitle="Verify your credentials before alerting guardians" icon={MessageCircle} />
              <div className="flex flex-wrap items-end gap-3 p-5">
                <div className="flex-1">
                  <label className="label">WhatsApp number</label>
                  <input className="input" placeholder="+919000000001" value={testPhone} onChange={(event) => setTestPhone(event.target.value)} />
                </div>
                <Button variant="whatsapp" icon={Send} onClick={sendTest} loading={testing} disabled={!testPhone}>
                  Send test
                </Button>
              </div>
            </Card>

            <Card>
              <CardHeader title="How alerts work" icon={Info} />
              <ul className="space-y-3 p-5 text-sm text-ink-600">
                <li className="flex gap-2">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-600" /> Every saved attendance record updates each student&apos;s running percentage.
                </li>
                <li className="flex gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning-600" /> Students dropping below 75% are queued for a guardian alert with a shortfall summary.
                </li>
                <li className="flex gap-2">
                  <Clock size={16} className="mt-0.5 shrink-0 text-sky-600" /> A cooldown prevents the same guardian being messaged repeatedly on the same day.
                </li>
                <li className="flex gap-2">
                  <XCircle size={16} className="mt-0.5 shrink-0 text-danger-600" /> Missing numbers, opted-out guardians and provider errors are recorded in the delivery log.
                </li>
                <li className="flex gap-2">
                  <Users size={16} className="mt-0.5 shrink-0 text-brand-600" /> Run the nightly job with <code>npm run attendance:alerts</code>, or trigger it manually above.
                </li>
              </ul>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

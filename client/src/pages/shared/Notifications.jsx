import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, CheckCheck, Clock, Filter, Trash2 } from 'lucide-react';
import { notificationApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { Alert, Badge, Button, Card, EmptyState, PageLoader, SectionTitle, Tabs, toast } from '../../components/ui';
import { relativeTime } from '../../utils/format';

const typeTone = {
  assignment: 'info',
  exam: 'warning',
  attendance: 'danger',
  announcement: 'brand',
  result: 'success',
  quiz: 'purple',
  marks: 'success',
  whatsapp: 'whatsapp',
  system: 'neutral',
};

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [meta, setMeta] = useState({ unread: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');

  const load = useCallback(() => {
    setLoading(true);
    notificationApi
      .list({ limit: 100, ...(tab === 'unread' ? { unreadOnly: true } : tab !== 'all' ? { type: tab } : {}) })
      .then((result) => {
        setNotifications(result.data || []);
        setMeta(result.meta || {});
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(load, [load]);

  const markAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      toast('All notifications marked as read', 'success');
      load();
    } catch (requestError) {
      toast(requestError.message, 'error');
    }
  };

  const markRead = async (id) => {
    try {
      await notificationApi.markRead(id);
      setNotifications((current) => current.map((item) => (item._id === id ? { ...item, read: true } : item)));
      setMeta((current) => ({ ...current, unread: Math.max(0, (current.unread || 0) - 1) }));
    } catch (requestError) {
      toast(requestError.message, 'error');
    }
  };

  const remove = async (id) => {
    try {
      await notificationApi.remove(id);
      setNotifications((current) => current.filter((item) => item._id !== id));
    } catch (requestError) {
      toast(requestError.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Notifications"
        subtitle={`${meta.unread || 0} unread · assignment reminders, exam alerts, attendance and results`}
        action={
          <Button variant="secondary" icon={CheckCheck} onClick={markAllRead} disabled={!meta.unread}>
            Mark all read
          </Button>
        }
      />

      {error ? <Alert tone="danger" title="Could not load notifications">{error}</Alert> : null}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'all', label: 'All', icon: BellRing },
          { value: 'unread', label: 'Unread', count: meta.unread },
          { value: 'assignment', label: 'Assignments' },
          { value: 'exam', label: 'Exams' },
          { value: 'attendance', label: 'Attendance' },
          { value: 'result', label: 'Results' },
        ]}
      />

      {loading ? (
        <PageLoader />
      ) : notifications.length ? (
        <Card>
          <div className="divide-y divide-ink-100">
            {notifications.map((item) => (
              <div key={item._id} className={`flex items-start gap-4 p-4 transition ${item.read ? '' : 'bg-brand-50/40'}`}>
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.read ? 'bg-ink-300' : 'bg-brand-500'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={typeTone[item.type] || 'neutral'}>{item.type}</Badge>
                    {item.priority === 'urgent' || item.priority === 'high' ? <Badge tone="danger">{item.priority}</Badge> : null}
                    <span className="flex items-center gap-1 text-xs text-ink-400">
                      <Clock size={12} /> {relativeTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-ink-800">{item.title}</p>
                  {item.message ? <p className="mt-0.5 text-sm text-ink-600">{item.message}</p> : null}
                  {item.link ? (
                    <Link to={item.link} className="mt-2 inline-block text-xs font-semibold text-brand-600 hover:text-brand-700">
                      Open →
                    </Link>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!item.read ? (
                    <button onClick={() => markRead(item._id)} title="Mark as read" className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-success-600">
                      <CheckCheck size={16} />
                    </button>
                  ) : null}
                  <button onClick={() => remove(item._id)} title="Delete" className="rounded-lg p-2 text-ink-400 transition hover:bg-danger-50 hover:text-danger-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <EmptyState icon={BellRing} title="Nothing here" message={`No ${tab === 'all' ? '' : tab} notifications right now.`} />
        </Card>
      )}

      {user?.role === 'teacher' ? (
        <Alert tone="info" icon={Filter}>
          Teachers can also broadcast messages to a class from the Announcements page.
        </Alert>
      ) : null}
    </div>
  );
}

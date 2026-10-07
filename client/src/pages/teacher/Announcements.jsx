import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Megaphone,
  MessageSquare,
  Pencil,
  Pin,
  Plus,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import { announcementApi, notificationApi } from '../../api/endpoints';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Modal,
  PageLoader,
  SectionTitle,
  Select,
  StatCard,
  Tabs,
  Textarea,
  Toggle,
  toast,
} from '../../components/ui';
import { formatDate, humanise, relativeTime } from '../../utils/format';

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'exam', label: 'Exam' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'event', label: 'Event' },
  { value: 'urgent', label: 'Urgent' },
];

const emptyForm = {
  title: '',
  content: '',
  category: 'general',
  priority: 'normal',
  pinned: false,
  audience: 'all',
  className: 'TE-A',
  publishAt: new Date().toISOString().slice(0, 16),
  expiresAt: '',
};

export default function TeacherAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcast, setBroadcast] = useState({ title: '', message: '', type: 'system', priority: 'normal' });
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    announcementApi
      .list()
      .then((result) => setAnnouncements(result.data || []))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
    announcementApi
      .stats()
      .then((result) => setStats(result.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (announcement) => {
    setEditing(announcement);
    setForm({
      title: announcement.title,
      content: announcement.content,
      category: announcement.category,
      priority: announcement.priority || 'normal',
      pinned: Boolean(announcement.pinned),
      audience: announcement.audience || 'all',
      className: announcement.className || 'TE-A',
      publishAt: announcement.publishAt ? new Date(announcement.publishAt).toISOString().slice(0, 16) : '',
      expiresAt: announcement.expiresAt ? new Date(announcement.expiresAt).toISOString().slice(0, 16) : '',
    });
    setFormOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : new Date().toISOString(),
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      };
      if (editing) await announcementApi.update(editing._id, payload);
      else await announcementApi.create(payload);
      toast(editing ? 'Announcement updated' : 'Announcement published to your classes', 'success');
      setFormOpen(false);
      load();
    } catch (saveError) {
      toast(saveError.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (announcement) => {
    if (!window.confirm(`Delete "${announcement.title}"?`)) return;
    try {
      await announcementApi.remove(announcement._id);
      toast('Announcement deleted', 'success');
      load();
    } catch (removeError) {
      toast(removeError.message, 'error');
    }
  };

  const togglePin = async (announcement) => {
    try {
      await announcementApi.update(announcement._id, { pinned: !announcement.pinned });
      toast(announcement.pinned ? 'Unpinned' : 'Pinned to the top of student feeds', 'success');
      load();
    } catch (pinError) {
      toast(pinError.message, 'error');
    }
  };

  const sendBroadcast = async () => {
    setSending(true);
    try {
      const result = await notificationApi.broadcast(broadcast);
      toast(`Notification sent to ${result.data?.sent ?? 0} users`, 'success');
      setBroadcastOpen(false);
      setBroadcast({ title: '', message: '', type: 'system', priority: 'normal' });
    } catch (broadcastError) {
      toast(broadcastError.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const filtered = announcements.filter((announcement) => {
    if (tab === 'pinned') return announcement.pinned;
    if (tab === 'scheduled') return announcement.publishAt && new Date(announcement.publishAt) > new Date();
    if (tab === 'urgent') return ['urgent', 'high'].includes(announcement.priority);
    return true;
  });

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Announcements & Notifications"
        subtitle="Broadcast notices to students and push in-app notifications"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Bell} onClick={() => setBroadcastOpen(true)}>
              Push notification
            </Button>
            <Button icon={Plus} onClick={openCreate}>
              New announcement
            </Button>
          </div>
        }
      />

      {error ? <Alert tone="danger" title="Could not load announcements">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Announcements" value={announcements.length} icon={Megaphone} tone="brand" />
        <StatCard label="Pinned" value={stats?.pinned ?? announcements.filter((announcement) => announcement.pinned).length} icon={Pin} tone="purple" />
        <StatCard label="Urgent" value={stats?.urgent ?? announcements.filter((announcement) => ['urgent', 'high'].includes(announcement.priority)).length} icon={AlertTriangle} tone="danger" />
        <StatCard label="Notices delivered" value={stats?.total ?? announcements.length} hint={stats ? `${stats.pinned || 0} pinned · ${stats.urgent || 0} urgent` : 'Live audience'} icon={Users} tone="info" />
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'all', label: 'All', count: announcements.length },
          { value: 'pinned', label: 'Pinned' },
          { value: 'urgent', label: 'High priority' },
          { value: 'scheduled', label: 'Scheduled' },
        ]}
      />

      {loading ? (
        <PageLoader />
      ) : filtered.length ? (
        <div className="space-y-4">
          {filtered.map((announcement) => (
            <Card key={announcement._id}>
              <div className="flex flex-wrap items-start gap-4 p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                  <Megaphone size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink-900">{announcement.title}</h3>
                    {announcement.pinned ? (
                      <Badge tone="purple">
                        <Pin size={11} /> Pinned
                      </Badge>
                    ) : null}
                    <Badge tone={['urgent', 'high'].includes(announcement.priority) ? 'danger' : 'neutral'}>{announcement.priority}</Badge>
                    <Badge tone="info">{humanise(announcement.category)}</Badge>
                    <Badge tone="neutral">{announcement.audience === 'all' ? 'All students' : announcement.className}</Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-ink-600">{announcement.content}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ink-500">
                    <span className="flex items-center gap-1.5">
                      <Avatar name={announcement.authorName || 'Teacher'} size={20} /> {announcement.authorName || 'You'}
                    </span>
                    <span>Published {relativeTime(announcement.publishAt || announcement.createdAt)}</span>
                    {announcement.expiresAt ? <span>Expires {formatDate(announcement.expiresAt)}</span> : null}
                    <span>{announcement.views || 0} views</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" icon={Pin} onClick={() => togglePin(announcement)}>
                    {announcement.pinned ? 'Unpin' : 'Pin'}
                  </Button>
                  <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEdit(announcement)}>
                    Edit
                  </Button>
                  <button onClick={() => remove(announcement)} className="btn-ghost btn-sm text-danger-600 hover:bg-danger-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={Megaphone}
            title="No announcements yet"
            message="Publish a notice and every student in the class gets an in-app notification."
            action={
              <Button icon={Plus} onClick={openCreate}>
                New announcement
              </Button>
            }
          />
        </Card>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit announcement' : 'New announcement'}
        subtitle="Delivered as an in-app notification to the selected audience"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving} icon={Send}>
              {editing ? 'Save changes' : 'Publish announcement'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Title" required className="sm:col-span-2" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Mid-semester exam schedule released" />
          <div className="sm:col-span-2">
            <Textarea label="Message" rows={5} required value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="The detailed timetable is now available on the exams page…" />
          </div>
          <Select label="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} options={CATEGORIES} />
          <Select
            label="Priority"
            value={form.priority}
            onChange={(event) => setForm({ ...form, priority: event.target.value })}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'normal', label: 'Normal' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent' },
            ]}
          />
          <Select
            label="Audience"
            value={form.audience}
            onChange={(event) => setForm({ ...form, audience: event.target.value })}
            options={[
              { value: 'all', label: 'All my students' },
              { value: 'class', label: 'A specific class' },
            ]}
          />
          {form.audience === 'class' ? <Input label="Class" value={form.className} onChange={(event) => setForm({ ...form, className: event.target.value })} /> : <div />}
          <Input label="Publish at" type="datetime-local" value={form.publishAt} onChange={(event) => setForm({ ...form, publishAt: event.target.value })} />
          <Input label="Expires at (optional)" type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} />
          <div className="flex items-end pb-2 sm:col-span-2">
            <Toggle checked={form.pinned} onChange={(value) => setForm({ ...form, pinned: value })} label="Pin to top" hint="Pinned notices stay at the top of the student feed" />
          </div>
        </div>
      </Modal>

      <Modal
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        title="Push an in-app notification"
        subtitle="Short notification delivered to all users or a selected role"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBroadcastOpen(false)}>
              Cancel
            </Button>
            <Button onClick={sendBroadcast} loading={sending} icon={Bell}>
              Send notification
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Title" value={broadcast.title} onChange={(event) => setBroadcast({ ...broadcast, title: event.target.value })} placeholder="Library closed today" />
          <Textarea label="Message" rows={3} value={broadcast.message} onChange={(event) => setBroadcast({ ...broadcast, message: event.target.value })} placeholder="The library will remain closed for maintenance until 4 PM." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Type"
              value={broadcast.type}
              onChange={(event) => setBroadcast({ ...broadcast, type: event.target.value })}
              options={[
                { value: 'system', label: 'System' },
                { value: 'announcement', label: 'Announcement' },
                { value: 'attendance', label: 'Attendance alert' },
                { value: 'exam', label: 'Exam reminder' },
              ]}
            />
            <Select
              label="Priority"
              value={broadcast.priority}
              onChange={(event) => setBroadcast({ ...broadcast, priority: event.target.value })}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'normal', label: 'Normal' },
                { value: 'high', label: 'High' },
                { value: 'urgent', label: 'Urgent' },
              ]}
            />
          </div>
          <p className="flex items-center gap-2 text-xs text-ink-500">
            <MessageSquare size={13} /> Students see notifications instantly in the bell menu.
          </p>
        </div>
      </Modal>
    </div>
  );
}

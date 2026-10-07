import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  Clock,
  MapPin,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import { examApi, subjectApi } from '../../api/endpoints';
import {
  Alert,
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
  toast,
} from '../../components/ui';
import { daysLeftLabel, formatDate, humanise, toDateInput } from '../../utils/format';

const EXAM_TYPES = [
  { value: 'unit-test', label: 'Unit Test' },
  { value: 'insem', label: 'In-Semester' },
  { value: 'mid-term', label: 'Mid Term' },
  { value: 'endsem', label: 'End Semester' },
  { value: 'practical', label: 'Practical' },
  { value: 'viva', label: 'Viva' },
];

const emptyForm = {
  title: '',
  subject: '',
  date: '',
  startTime: '10:00',
  durationMinutes: 90,
  room: '',
  totalMarks: 50,
  passingMarks: 20,
  type: 'unit-test',
  syllabus: '',
  instructions: '',
  status: 'scheduled',
};

export default function TeacherExams() {
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('upcoming');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [reminding, setReminding] = useState('');
  const [className, setClassName] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    examApi
      .list()
      .then((result) => setExams(result.data || []))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    subjectApi
      .list({ mine: true })
      .then((result) => {
        const list = result.data || [];
        setSubjects(list);
        setForm((current) => ({ ...current, subject: current.subject || list[0]?._id || '' }));
        if (list[0]) setClassName(list[0].className);
      })
      .catch(() => {});
  }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return exams.filter((exam) => {
      const matches = !needle || [exam.title, exam.subject?.name, exam.room, exam.type].filter(Boolean).join(' ').toLowerCase().includes(needle);
      if (!matches) return false;
      if (tab === 'upcoming') return !exam.isPast && exam.status !== 'cancelled';
      if (tab === 'past') return exam.isPast;
      if (tab === 'cancelled') return exam.status === 'cancelled';
      return true;
    });
  }, [exams, search, tab]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, subject: subjects[0]?._id || '' });
    setCreateOpen(true);
  };

  const openEdit = (exam) => {
    setEditing(exam);
    setForm({
      title: exam.title,
      subject: exam.subject?._id || '',
      date: toDateInput(exam.date),
      startTime: exam.startTime || '10:00',
      durationMinutes: exam.durationMinutes || 90,
      room: exam.room || '',
      totalMarks: exam.totalMarks || 50,
      passingMarks: exam.passingMarks || 20,
      type: exam.type || 'unit-test',
      syllabus: (exam.syllabus || []).join('\n'),
      instructions: exam.instructions || '',
      status: exam.status || 'scheduled',
    });
    setCreateOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        date: new Date(form.date || Date.now()).toISOString(),
        durationMinutes: Number(form.durationMinutes),
        totalMarks: Number(form.totalMarks),
        passingMarks: Number(form.passingMarks),
        syllabus: form.syllabus
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      };

      if (editing) await examApi.update(editing._id, payload);
      else await examApi.create(payload);

      toast(editing ? 'Exam updated — students renotified' : 'Exam scheduled and class notified', 'success');
      setCreateOpen(false);
      load();
    } catch (saveError) {
      toast(saveError.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remind = async (exam) => {
    setReminding(exam._id);
    try {
      const result = await examApi.remind(exam._id);
      toast(`Reminder sent to ${result.data.reminded} students`, 'success');
    } catch (remindError) {
      toast(remindError.message, 'error');
    } finally {
      setReminding('');
    }
  };

  const cancel = async (exam) => {
    if (!window.confirm(`Remove ${exam.title} from the timetable?`)) return;
    try {
      await examApi.remove(exam._id);
      toast('Exam removed', 'success');
      load();
    } catch (removeError) {
      toast(removeError.message, 'error');
    }
  };

  const upcoming = exams.filter((exam) => !exam.isPast && exam.status !== 'cancelled');
  const nextExam = upcoming[0];

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Examination Schedule"
        subtitle="Plan exams, publish timetables and send reminders"
        action={
          <Button icon={Plus} onClick={openCreate}>
            Schedule exam
          </Button>
        }
      />

      {error ? <Alert tone="danger" title="Could not load exams">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Upcoming" value={upcoming.length} hint={nextExam ? `Next: ${formatDate(nextExam.date)}` : 'Nothing scheduled'} icon={CalendarDays} tone="brand" />
        <StatCard label="Completed" value={exams.filter((exam) => exam.isPast).length} icon={ClipboardCheck} tone="info" />
        <StatCard label="Total exams" value={exams.length} hint={`${EXAM_TYPES.length} exam patterns supported`} icon={CalendarPlus} tone="purple" />
        <StatCard label="Cancelled" value={exams.filter((exam) => exam.status === 'cancelled').length} icon={Trash2} tone="warning" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
            { value: 'past', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
            { value: 'all', label: 'All', count: exams.length },
          ]}
        />
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-3.5 text-ink-400" />
          <input className="input pl-9" placeholder="Search exams…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : filtered.length ? (
        <div className="space-y-5">
          {filtered.map((exam) => (
            <Card key={exam._id}>
              <div className="flex flex-wrap items-start gap-5 p-5">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand-50 text-center">
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-brand-600">
                      {new Date(exam.date).toLocaleDateString('en-IN', { month: 'short' })}
                    </p>
                    <p className="text-xl font-bold text-brand-700">{new Date(exam.date).getDate()}</p>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink-900">{exam.title}</h3>
                    <Badge tone="brand">{humanise(exam.type)}</Badge>
                    <Badge tone={exam.status === 'cancelled' ? 'danger' : exam.isPast ? 'neutral' : 'success'}>{exam.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-500">{exam.subject?.name || exam.subject?.code}</p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-500">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays size={13} /> {formatDate(exam.date, { weekday: 'long' })}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock size={13} /> {exam.startTime} · {exam.durationMinutes} min
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin size={13} /> {exam.room || 'Room not set'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users size={13} /> {exam.className}
                    </span>
                    <span>
                      Marks {exam.totalMarks} · Pass {exam.passingMarks}
                    </span>
                    <span className={exam.isPast ? 'text-ink-400' : 'font-semibold text-ink-700'}>{daysLeftLabel(exam.daysLeft)}</span>
                  </div>

                  {exam.syllabus?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {exam.syllabus.slice(0, 6).map((item) => (
                        <span key={item} className="badge bg-ink-100 text-ink-600">
                          {item}
                        </span>
                      ))}
                      {exam.syllabus.length > 6 ? <span className="badge bg-ink-100 text-ink-600">+{exam.syllabus.length - 6} more</span> : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" icon={Bell} onClick={() => remind(exam)} loading={reminding === exam._id} disabled={exam.isPast}>
                    Remind
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(exam)}>
                    Edit
                  </Button>
                  <button onClick={() => cancel(exam)} className="btn-ghost btn-sm text-danger-600 hover:bg-danger-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {exam.instructions ? (
                <div className="border-t border-ink-100 px-5 py-3 text-sm text-ink-600">
                  <span className="font-semibold text-ink-700">Instructions: </span>
                  {exam.instructions}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={CalendarDays}
            title="No exams in this view"
            message="Schedule a new exam or switch tabs to see past and cancelled exams."
            action={
              <Button icon={Plus} onClick={openCreate}>
                Schedule exam
              </Button>
            }
          />
        </Card>
      )}

      <Card>
        <CardHeader
          title="Class timetable"
          subtitle="Day-wise view of the exam schedule"
          icon={CalendarDays}
          action={
            <select className="input w-40 py-2" value={className} onChange={(event) => setClassName(event.target.value)}>
              {[...new Set(subjects.map((subject) => subject.className))].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          }
        />
        <TimetableView className={className} />
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={editing ? 'Edit exam' : 'Schedule a new exam'}
        subtitle="Students receive an in-app notification and can see it on their timetable"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving} icon={Send}>
              {editing ? 'Save changes' : 'Schedule exam'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Exam title" required className="sm:col-span-2" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="DBMS Unit Test 2" />
          <Select
            label="Subject"
            value={form.subject}
            onChange={(event) => setForm({ ...form, subject: event.target.value })}
            options={subjects.map((subject) => ({ value: subject._id, label: `${subject.code} — ${subject.name}` }))}
          />
          <Select label="Exam type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} options={EXAM_TYPES} />
          <Input label="Date" type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
          <Input label="Start time" type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
          <Input label="Duration (minutes)" type="number" value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })} />
          <Input label="Room / hall" value={form.room} onChange={(event) => setForm({ ...form, room: event.target.value })} placeholder="Lab 402" />
          <Input label="Total marks" type="number" value={form.totalMarks} onChange={(event) => setForm({ ...form, totalMarks: event.target.value })} />
          <Input label="Passing marks" type="number" value={form.passingMarks} onChange={(event) => setForm({ ...form, passingMarks: event.target.value })} />
          <Select
            label="Status"
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
            options={[
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'ongoing', label: 'Ongoing' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
          <div className="sm:col-span-2">
            <Textarea
              label="Syllabus / chapters"
              rows={4}
              value={form.syllabus}
              onChange={(event) => setForm({ ...form, syllabus: event.target.value })}
              placeholder={`Unit 3 — Normalization\nUnit 4 — Transactions`}
            />
            <p className="help">One topic per line — shown to students on their exam card.</p>
          </div>
          <div className="sm:col-span-2">
            <Textarea label="Instructions" rows={3} value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} placeholder="Bring your own calculator. No mobile phones allowed." />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TimetableView({ className }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!className) return;
    setLoading(true);
    examApi
      .timetable(className)
      .then((result) => setDays(result.data?.days || []))
      .catch(() => setDays([]))
      .finally(() => setLoading(false));
  }, [className]);

  if (loading) return <div className="p-5 text-sm text-ink-500">Building timetable…</div>;
  if (!days.length) return <EmptyState icon={CalendarDays} title="Nothing scheduled" message={`No exams on the calendar for ${className || 'this class'}.`} />;

  return (
    <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
      {days.map((day) => (
        <div key={day.date} className="rounded-2xl border border-ink-100 p-4">
          <p className="text-sm font-semibold text-ink-800">{formatDate(day.date, { weekday: 'short' })}</p>
          <div className="mt-3 space-y-2">
            {day.exams.map((exam) => (
              <div key={exam._id} className="rounded-xl bg-ink-50 px-3 py-2">
                <p className="text-sm font-medium text-ink-800">{exam.subject?.name || exam.title}</p>
                <p className="text-xs text-ink-500">
                  {exam.startTime} · {exam.room || 'TBA'} · {exam.durationMinutes} min
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

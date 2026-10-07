import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, Layers, Plus, Search, Settings2, Trash2, Users } from 'lucide-react';
import { subjectApi } from '../../api/endpoints';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageLoader,
  ProgressBar,
  SectionTitle,
  Select,
  StatCard,
  Textarea,
  toast,
} from '../../components/ui';

const emptySubject = {
  code: '',
  name: '',
  shortName: '',
  className: 'TE-A',
  department: 'Computer Engineering',
  semester: 5,
  credits: 4,
  maxMarks: 100,
  color: '#6366f1',
  icon: 'book',
  unitTitles: '',
};

export default function TeacherSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptySubject);

  const load = useCallback(() => {
    setLoading(true);
    subjectApi
      .list(search ? { search } : undefined)
      .then((result) => setSubjects(result.data || []))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(load, 220);
    return () => clearTimeout(timer);
  }, [load]);

  const create = async () => {
    setSaving(true);
    try {
      const units = form.unitTitles
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
          const [title, topics] = line.split(':');
          return {
            unitNo: index + 1,
            title: (title || `Unit ${index + 1}`).trim(),
            topics: (topics || '')
              .split(',')
              .map((topic) => topic.trim())
              .filter(Boolean),
          };
        });

      await subjectApi.create({ ...form, semester: Number(form.semester), credits: Number(form.credits), maxMarks: Number(form.maxMarks), units });
      toast(`${form.name} created and students enrolled`, 'success');
      setCreateOpen(false);
      setForm(emptySubject);
      load();
    } catch (createError) {
      toast(createError.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const archive = async (subject) => {
    if (!window.confirm(`Archive ${subject.name}? Students keep their history but the subject is hidden.`)) return;
    try {
      await subjectApi.remove(subject._id);
      toast('Subject archived', 'success');
      load();
    } catch (archiveError) {
      toast(archiveError.message, 'error');
    }
  };

  const totalStudents = subjects.reduce((sum, subject) => sum + (subject.studentCount || 0), 0);
  const totalUnits = subjects.reduce((sum, subject) => sum + (subject.units?.length || 0), 0);
  const totalTopics = subjects.reduce(
    (sum, subject) => sum + (subject.units || []).reduce((inner, unit) => inner + (unit.topics?.length || 0), 0),
    0
  );

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Subjects & Syllabus"
        subtitle="Subjects you teach, along with units and topics that power the AI question generator"
        action={
          <Button icon={Plus} onClick={() => setCreateOpen(true)}>
            New subject
          </Button>
        }
      />

      {error ? <Alert tone="danger" title="Could not load subjects">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Subjects" value={subjects.length} icon={BookOpen} tone="brand" />
        <StatCard label="Students enrolled" value={totalStudents} hint="Active class strength" icon={Users} tone="info" />
        <StatCard label="Units mapped" value={totalUnits} icon={Layers} tone="purple" />
        <StatCard label="Topics available" value={totalTopics} hint="Used by the AI generator" icon={GraduationCap} tone="success" />
      </div>

      <div className="relative max-w-md">
        <Search size={15} className="pointer-events-none absolute left-3 top-3.5 text-ink-400" />
        <input className="input pl-9" placeholder="Search subjects by name or code…" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {loading ? (
        <PageLoader />
      ) : subjects.length ? (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {subjects.map((subject) => {
            const topics = (subject.units || []).reduce((sum, unit) => sum + (unit.topics?.length || 0), 0);
            return (
              <Card key={subject._id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3 p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white" style={{ background: subject.color || '#6366f1' }}>
                      <BookOpen size={20} />
                    </span>
                    <div>
                      <h3 className="font-semibold text-ink-900">{subject.name}</h3>
                      <p className="text-xs text-ink-500">
                        {subject.code} · Semester {subject.semester} · {subject.credits} credits
                      </p>
                    </div>
                  </div>
                  <Badge tone="brand">{subject.className}</Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 px-5 pb-4 text-center">
                  {[
                    ['Students', subject.studentCount || 0],
                    ['Units', subject.units?.length || 0],
                    ['Topics', topics],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-ink-50 py-2">
                      <p className="text-lg font-bold text-ink-900">{value}</p>
                      <p className="text-[11px] uppercase tracking-wide text-ink-500">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 px-5 pb-4 text-xs text-ink-500">
                  <div className="flex items-center justify-between">
                    <span>Attendance records</span>
                    <span className="font-semibold text-ink-700">{subject.attendanceRecords || 0}</span>
                  </div>
                  <ProgressBar value={Math.min(100, subject.attendanceRecords || 0)} height="h-1.5" />
                  <div className="flex items-center justify-between">
                    <span>Marks recorded</span>
                    <span className="font-semibold text-ink-700">{subject.marksRecords || 0}</span>
                  </div>
                  <ProgressBar value={Math.min(100, subject.marksRecords || 0)} height="h-1.5" />
                  <p className="pt-1">Teacher: {subject.teacher?.user?.name || 'Unassigned'}</p>
                </div>

                <div className="mt-auto flex flex-wrap gap-2 border-t border-ink-100 p-4">
                  <Link to={`/teacher/subjects/${subject._id}`} className="btn-secondary btn-sm">
                    <Settings2 size={14} /> Manage syllabus
                  </Link>
                  <Link to={`/teacher/ai-generator?subject=${subject._id}`} className="btn-primary btn-sm">
                    Generate paper
                  </Link>
                  <button onClick={() => archive(subject)} className="btn-ghost btn-sm text-danger-600 hover:bg-danger-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="No subjects yet"
            message="Create your first subject and map its units so the AI can generate question papers."
            action={
              <Button icon={Plus} onClick={() => setCreateOpen(true)}>
                New subject
              </Button>
            }
          />
        </Card>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create a subject"
        subtitle="Students of the selected class are enrolled automatically"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} loading={saving}>
              Create subject
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Subject code" required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="CS506" />
          <Input label="Subject name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Machine Learning" />
          <Input label="Short name" value={form.shortName} onChange={(event) => setForm({ ...form, shortName: event.target.value })} placeholder="ML" />
          <Input label="Class" value={form.className} onChange={(event) => setForm({ ...form, className: event.target.value })} />
          <Select
            label="Department"
            value={form.department}
            onChange={(event) => setForm({ ...form, department: event.target.value })}
            options={['Computer Engineering', 'Information Technology', 'Electronics', 'Mechanical', 'Civil']}
          />
          <Input label="Semester" type="number" value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value })} />
          <Input label="Credits" type="number" value={form.credits} onChange={(event) => setForm({ ...form, credits: event.target.value })} />
          <Input label="Max marks" type="number" value={form.maxMarks} onChange={(event) => setForm({ ...form, maxMarks: event.target.value })} />
          <Input label="Accent colour" type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />

          <div className="sm:col-span-2">
            <Textarea
              label="Units and topics"
              rows={6}
              value={form.unitTitles}
              onChange={(event) => setForm({ ...form, unitTitles: event.target.value })}
              placeholder={`Unit 1: Introduction, Types of learning\nUnit 2: Regression, Gradient descent`}
            />
            <p className="help">One unit per line — format <code>Unit title: topic 1, topic 2, topic 3</code>. You can edit this any time.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

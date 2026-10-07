import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarClock, CheckCircle2, ClipboardList, FileText, Plus, Search, Send, Sparkles, Trash2 } from 'lucide-react';
import { assignmentApi, subjectApi } from '../../api/endpoints';
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
  ProgressBar,
  SectionTitle,
  Select,
  StatCard,
  Tabs,
  Textarea,
  Toggle,
  toast,
} from '../../components/ui';
import { daysLeftLabel, formatDate, humanise } from '../../utils/format';

const emptyForm = {
  title: '',
  description: '',
  subject: '',
  dueDate: '',
  totalMarks: 20,
  type: 'assignment',
  unit: '',
  topic: '',
  status: 'published',
  allowLateSubmission: true,
};

export default function TeacherAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [reminding, setReminding] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    assignmentApi
      .list()
      .then((result) => setAssignments(result.data || []))
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
      })
      .catch(() => {});
  }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return assignments.filter((assignment) => {
      const matchesSearch = !needle || [assignment.title, assignment.subject?.name, assignment.topic, assignment.unit].filter(Boolean).join(' ').toLowerCase().includes(needle);
      if (!matchesSearch) return false;
      if (tab === 'open') return !assignment.overdue;
      if (tab === 'overdue') return assignment.overdue;
      if (tab === 'pending') return assignment.pendingCount > 0;
      if (tab === 'drafts') return assignment.status === 'draft';
      return true;
    });
  }, [assignments, search, tab]);

  const create = async () => {
    if (!form.subject) {
      toast('Select a subject first', 'error');
      return;
    }
    setSaving(true);
    try {
      await assignmentApi.create({
        ...form,
        totalMarks: Number(form.totalMarks),
        dueDate: new Date(form.dueDate || Date.now() + 7 * 86400000).toISOString(),
      });
      toast('Assignment published and students notified', 'success');
      setCreateOpen(false);
      setForm({ ...emptyForm, subject: subjects[0]?._id || '' });
      load();
    } catch (createError) {
      toast(createError.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remind = async (assignment) => {
    setReminding(assignment._id);
    try {
      const result = await assignmentApi.remind(assignment._id);
      toast(`Reminder sent to ${result.data.reminded} pending student(s)`, 'success');
    } catch (remindError) {
      toast(remindError.message, 'error');
    } finally {
      setReminding('');
    }
  };

  const remove = async (assignment) => {
    if (!window.confirm(`Delete "${assignment.title}" and all its submissions?`)) return;
    try {
      await assignmentApi.remove(assignment._id);
      toast('Assignment deleted', 'success');
      load();
    } catch (removeError) {
      toast(removeError.message, 'error');
    }
  };

  const totalSubmissions = assignments.reduce((sum, assignment) => sum + (assignment.submissionCount || 0), 0);
  const pendingGrading = assignments.reduce((sum, assignment) => sum + Math.max(0, (assignment.submissionCount || 0) - (assignment.gradedCount || 0)), 0);
  const overdue = assignments.filter((assignment) => assignment.overdue).length;

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Assignments"
        subtitle="Create work, track submissions and remind students over WhatsApp"
        action={
          <Button icon={Plus} onClick={() => setCreateOpen(true)}>
            New assignment
          </Button>
        }
      />

      {error ? <Alert tone="danger" title="Could not load assignments">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assignments" value={assignments.length} hint={`${assignments.filter((a) => a.status === 'draft').length} drafts`} icon={ClipboardList} tone="brand" />
        <StatCard label="Submissions" value={totalSubmissions} icon={CheckCircle2} tone="success" />
        <StatCard label="Pending grading" value={pendingGrading} icon={FileText} tone={pendingGrading ? 'warning' : 'success'} />
        <StatCard label="Overdue" value={overdue} hint="Past the deadline" icon={CalendarClock} tone={overdue ? 'danger' : 'success'} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { value: 'all', label: 'All', count: assignments.length },
            { value: 'open', label: 'Open' },
            { value: 'pending', label: 'Needs grading' },
            { value: 'overdue', label: 'Overdue' },
            { value: 'drafts', label: 'Drafts' },
          ]}
        />
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-3.5 text-ink-400" />
          <input className="input pl-9" placeholder="Search assignments…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : filtered.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {filtered.map((assignment) => {
            const progress = assignment.submissionCount ? Math.round(((assignment.gradedCount || 0) / assignment.submissionCount) * 100) : 0;
            return (
              <Card key={assignment._id} className="flex flex-col">
                <CardHeader
                  title={assignment.title}
                  subtitle={`${assignment.subject?.name || 'Subject'} · ${humanise(assignment.type)} · ${assignment.totalMarks} marks`}
                  icon={ClipboardList}
                  action={
                    <div className="flex flex-wrap gap-1.5">
                      {assignment.aiGenerated ? (
                        <Badge tone="purple">
                          <Sparkles size={11} /> AI
                        </Badge>
                      ) : null}
                      <Badge tone={assignment.status === 'published' ? 'success' : 'neutral'}>{assignment.status}</Badge>
                    </div>
                  }
                />

                <div className="flex-1 space-y-4 p-5">
                  {assignment.description ? <p className="line-clamp-2 text-sm text-ink-600">{assignment.description}</p> : null}

                  <div className="flex flex-wrap gap-3 text-xs text-ink-500">
                    <span className="flex items-center gap-1">
                      <CalendarClock size={13} /> Due {formatDate(assignment.dueDate)}
                    </span>
                    <span className={assignment.overdue ? 'font-semibold text-danger-600' : ''}>{daysLeftLabel(assignment.daysLeft)}</span>
                    <span>{assignment.className}</span>
                    {assignment.unit ? <span>{assignment.unit}</span> : null}
                    {assignment.topic ? <span>· {assignment.topic}</span> : null}
                  </div>

                  <div>
                    <div className="mb-1 flex justify-between text-xs text-ink-500">
                      <span>
                        {assignment.submissionCount || 0} submitted · {assignment.gradedCount || 0} graded
                      </span>
                      <span>{progress}% graded</span>
                    </div>
                    <ProgressBar value={progress} height="h-1.5" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-ink-100 p-4">
                  <Link to={`/teacher/assignments/${assignment._id}`} className="btn-primary btn-sm">
                    Review submissions
                  </Link>
                  <Button size="sm" variant="secondary" icon={Bell} loading={reminding === assignment._id} onClick={() => remind(assignment)}>
                    Remind {assignment.pendingCount ? `(${assignment.pendingCount})` : ''}
                  </Button>
                  {assignment.aiGenerated ? (
                    <Link to="/teacher/ai-generator" className="btn-ghost btn-sm">
                      <Sparkles size={14} /> Regenerate
                    </Link>
                  ) : null}
                  <button onClick={() => remove(assignment)} className="btn-ghost btn-sm ml-auto text-danger-600 hover:bg-danger-50">
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
            icon={ClipboardList}
            title="Nothing here yet"
            message="Create an assignment manually or generate one with AI in a single click."
            action={
              <div className="flex gap-2">
                <Button icon={Plus} onClick={() => setCreateOpen(true)}>
                  New assignment
                </Button>
                <Link to="/teacher/ai-generator" className="btn-secondary">
                  <Sparkles size={15} /> AI generator
                </Link>
              </div>
            }
          />
        </Card>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create assignment"
        subtitle="Students are notified instantly when you publish"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} loading={saving} icon={Send}>
              {form.status === 'draft' ? 'Save draft' : 'Publish assignment'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Title" required className="sm:col-span-2" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Database normalization worksheet" />
          <Select
            label="Subject"
            value={form.subject}
            onChange={(event) => setForm({ ...form, subject: event.target.value })}
            placeholder="Select subject"
            options={subjects.map((subject) => ({ value: subject._id, label: `${subject.code} — ${subject.name}` }))}
          />
          <Select
            label="Type"
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value })}
            options={[
              { value: 'assignment', label: 'Assignment' },
              { value: 'homework', label: 'Homework' },
              { value: 'project', label: 'Project' },
              { value: 'lab', label: 'Lab work' },
            ]}
          />
          <Input label="Unit" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="Unit 3" />
          <Input label="Topic" value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} placeholder="Normal forms" />
          <Input label="Total marks" type="number" value={form.totalMarks} onChange={(event) => setForm({ ...form, totalMarks: event.target.value })} />
          <Input label="Due date" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
          <div className="sm:col-span-2">
            <Textarea label="Instructions" rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Explain the submission format, file naming and evaluation criteria…" />
          </div>
          <Select
            label="Status"
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
            options={[
              { value: 'published', label: 'Publish now' },
              { value: 'draft', label: 'Save as draft' },
            ]}
          />
          <div className="flex items-end pb-2">
            <Toggle checked={form.allowLateSubmission} onChange={(value) => setForm({ ...form, allowLateSubmission: value })} label="Allow late submissions" hint="Late work is flagged automatically" />
          </div>
        </div>
      </Modal>
    </div>
  );
}

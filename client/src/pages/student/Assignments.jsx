import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, FileText, Filter, NotebookPen, Search } from 'lucide-react';
import { assignmentApi } from '../../api/endpoints';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  PageLoader,
  ProgressBar,
  SectionTitle,
  StatCard,
  Tabs,
} from '../../components/ui';
import { daysLeftLabel, formatDate, humanise } from '../../utils/format';

const statusTone = (status) =>
  ({
    pending: 'warning',
    submitted: 'info',
    late: 'warning',
    graded: 'success',
    missed: 'danger',
    resubmit: 'danger',
  })[status] || 'neutral';

export default function StudentAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');

  useEffect(() => {
    assignmentApi
      .list()
      .then((result) => setAssignments(result.data || []))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const subjects = useMemo(() => {
    const map = new Map();
    assignments.forEach((assignment) => {
      if (assignment.subject) map.set(assignment.subject._id, assignment.subject);
    });
    return [...map.values()];
  }, [assignments]);

  const filtered = useMemo(() => {
    let list = assignments;
    if (tab === 'pending') list = list.filter((assignment) => !assignment.mySubmission);
    else if (tab === 'submitted') list = list.filter((assignment) => assignment.mySubmission);
    else if (tab === 'graded') list = list.filter((assignment) => assignment.mySubmission?.status === 'graded');
    else if (tab === 'overdue') list = list.filter((assignment) => !assignment.mySubmission && new Date(assignment.dueDate) < new Date());

    if (subjectFilter) list = list.filter((assignment) => assignment.subject?._id === subjectFilter);
    if (search) {
      const needle = search.toLowerCase();
      list = list.filter((assignment) =>
        [assignment.title, assignment.description, assignment.topic, assignment.subject?.name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(needle)
      );
    }
    return list;
  }, [assignments, tab, subjectFilter, search]);

  if (loading) return <PageLoader />;

  const counts = {
    total: assignments.length,
    pending: assignments.filter((assignment) => !assignment.mySubmission).length,
    submitted: assignments.filter((assignment) => assignment.mySubmission).length,
    graded: assignments.filter((assignment) => assignment.mySubmission?.status === 'graded').length,
    overdue: assignments.filter((assignment) => !assignment.mySubmission && new Date(assignment.dueDate) < new Date()).length,
  };

  return (
    <div className="space-y-6">
      <SectionTitle title="Assignments" subtitle="Submit your work before the deadline and track your grades" />

      {error ? <Alert tone="danger" title="Could not load assignments">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total assignments" value={counts.total} icon={NotebookPen} tone="brand" />
        <StatCard label="Pending submission" value={counts.pending} hint={counts.overdue ? `${counts.overdue} overdue` : 'All on track'} icon={Clock} tone={counts.overdue ? 'danger' : 'warning'} />
        <StatCard label="Submitted" value={counts.submitted} icon={CheckCircle2} tone="info" />
        <StatCard label="Graded" value={counts.graded} icon={FileText} tone="success" />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { value: 'all', label: 'All', count: counts.total },
            { value: 'pending', label: 'Pending', count: counts.pending },
            { value: 'submitted', label: 'Submitted', count: counts.submitted },
            { value: 'graded', label: 'Graded', count: counts.graded },
            { value: 'overdue', label: 'Overdue', count: counts.overdue },
          ]}
        />

        <div className="flex flex-wrap items-end gap-3">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-3 text-ink-400" />
            <input
              className="input w-56 pl-9"
              placeholder="Search assignments…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="relative">
            <Filter size={15} className="pointer-events-none absolute left-3 top-3 text-ink-400" />
            <select className="input w-48 pl-9" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
              <option value="">All subjects</option>
              {subjects.map((subject) => (
                <option key={subject._id} value={subject._id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filtered.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((assignment) => {
            const overdue = !assignment.mySubmission && new Date(assignment.dueDate) < new Date();
            return (
              <Card key={assignment._id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3 p-5 pb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: assignment.subject?.color || '#6366f1' }} />
                      <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                        {assignment.subject?.shortName || assignment.subject?.name} · {humanise(assignment.type)}
                      </span>
                    </div>
                    <Link to={`/student/assignments/${assignment._id}`} className="mt-1.5 block truncate text-base font-semibold text-ink-900 hover:text-brand-600">
                      {assignment.title}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-500">{assignment.description || assignment.topic}</p>
                  </div>
                  <Badge tone={statusTone(assignment.myStatus)}>{humanise(assignment.myStatus)}</Badge>
                </div>

                <div className="mt-auto space-y-3 px-5 pb-5">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-500">
                    <span>Due {formatDate(assignment.dueDate)}</span>
                    <span>{assignment.totalMarks} marks</span>
                    {assignment.questions?.length ? <span>{assignment.questions.length} questions</span> : null}
                  </div>

                  {assignment.mySubmission?.status === 'graded' ? (
                    <div className="rounded-xl bg-success-50 px-3 py-2.5 text-sm">
                      <span className="font-semibold text-success-700">
                        Graded: {assignment.mySubmission.marksObtained}/{assignment.totalMarks}
                      </span>
                      {assignment.mySubmission.feedback ? (
                        <span className="ml-2 text-ink-600">{assignment.mySubmission.feedback}</span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <Badge tone={overdue ? 'danger' : assignment.daysLeft <= 2 ? 'warning' : 'neutral'}>
                        {daysLeftLabel(assignment.daysLeft)}
                      </Badge>
                      <Link to={`/student/assignments/${assignment._id}`} className="btn-primary btn-sm">
                        {assignment.mySubmission ? 'View submission' : 'Open & submit'}
                      </Link>
                    </div>
                  )}

                  {assignment.mySubmission && assignment.mySubmission.status !== 'graded' ? (
                    <ProgressBar value={100} tone="bg-sky-500" height="h-1" />
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState icon={NotebookPen} title="No assignments here" message="Try a different filter or check back later." />
        </Card>
      )}
    </div>
  );
}

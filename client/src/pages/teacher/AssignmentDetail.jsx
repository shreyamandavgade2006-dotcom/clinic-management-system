import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  MessageSquare,
  Save,
  Sparkles,
  UserX,
  Users,
} from 'lucide-react';
import { assignmentApi } from '../../api/endpoints';
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
  ProgressBar,
  SectionTitle,
  StatCard,
  Tabs,
  Textarea,
  toast,
} from '../../components/ui';
import { formatDate, formatDateTime, daysLeftLabel, gradeColor, gradeFromPercentage, percentageColor } from '../../utils/format';

export default function TeacherAssignmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('submissions');
  const [grading, setGrading] = useState(null);
  const [gradeForm, setGradeForm] = useState({ marksObtained: '', feedback: '' });
  const [saving, setSaving] = useState(false);
  const [reminding, setReminding] = useState(false);

  const load = useCallback(() => {
    assignmentApi
      .get(id)
      .then((result) => setData(result.data))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const openGrading = (submission) => {
    setGrading(submission);
    setGradeForm({
      marksObtained: submission.marksObtained ?? '',
      feedback: submission.feedback || '',
    });
  };

  const submitGrade = async () => {
    setSaving(true);
    try {
      await assignmentApi.grade(id, grading._id, {
        marksObtained: Number(gradeForm.marksObtained),
        feedback: gradeForm.feedback,
        status: 'graded',
      });
      toast('Grade saved and student notified', 'success');
      setGrading(null);
      load();
    } catch (gradeError) {
      toast(gradeError.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remind = async () => {
    setReminding(true);
    try {
      const result = await assignmentApi.remind(id);
      toast(`Reminder sent to ${result.data.reminded} pending student(s)`, 'success');
    } catch (remindError) {
      toast(remindError.message, 'error');
    } finally {
      setReminding(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error) return <Alert tone="danger" title="Could not load this assignment">{error}</Alert>;
  if (!data) return null;

  const { assignment, submissions = [], notSubmitted = [], stats = {} } = data;
  const gradedPercentage = stats.submitted ? Math.round((stats.graded / stats.submitted) * 100) : 0;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="btn-ghost btn-sm">
        <ArrowLeft size={15} /> Back to assignments
      </button>

      <SectionTitle
        title={assignment.title}
        subtitle={`${assignment.subject?.name || 'Subject'} · ${assignment.className} · ${assignment.totalMarks} marks`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Bell} onClick={remind} loading={reminding}>
              Remind pending
            </Button>
            <Button
              onClick={() => {
                const first = submissions.find((submission) => submission.status !== 'graded');
                if (first) openGrading(first);
                else toast('All submissions are graded', 'info');
              }}
            >
              Grade next
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Submitted" value={`${stats.submitted || 0}/${stats.total || 0}`} hint={`${stats.late || 0} late`} icon={CheckCircle2} tone="brand" />
        <StatCard label="Graded" value={stats.graded || 0} tooltip={undefined} icon={FileText} tone="success" trend={<ProgressBar value={gradedPercentage} />} />
        <StatCard label="Not submitted" value={notSubmitted.length} hint="Students to follow up" icon={UserX} tone={notSubmitted.length ? 'warning' : 'success'} />
        <StatCard
          label="Deadline"
          value={formatDate(assignment.dueDate)}
          hint={daysLeftLabel(assignment.daysLeft ?? Math.ceil((new Date(assignment.dueDate) - Date.now()) / 86400000))}
          icon={Clock}
          tone={assignment.overdue ? 'danger' : 'info'}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader title="Brief" subtitle="What students were asked to do" icon={FileText} />
          <div className="space-y-4 p-5">
            <p className="whitespace-pre-line text-sm text-ink-600">{assignment.description || 'No additional instructions were provided.'}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tone="neutral">{assignment.type}</Badge>
              {assignment.unit ? <Badge tone="info">{assignment.unit}</Badge> : null}
              {assignment.topic ? <Badge tone="brand">{assignment.topic}</Badge> : null}
              {assignment.aiGenerated ? (
                <Badge tone="purple">
                  <Sparkles size={11} /> AI generated
                </Badge>
              ) : null}
              <Badge tone={assignment.status === 'published' ? 'success' : 'neutral'}>{assignment.status}</Badge>
            </div>
            {assignment.attachmentUrl ? (
              <a href={assignment.attachmentUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm w-fit">
                <ExternalLink size={14} /> Attachment
              </a>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader title="Not submitted" subtitle={`${notSubmitted.length} students`} icon={UserX} />
          <div className="max-h-80 divide-y divide-ink-100 overflow-y-auto">
            {notSubmitted.length ? (
              notSubmitted.map((student) => (
                <div key={student._id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={student.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-800">{student.name}</p>
                    <p className="text-xs text-ink-500">{student.rollNo}</p>
                  </div>
                  <button onClick={remind} className="btn-ghost btn-sm">
                    <Bell size={14} />
                  </button>
                </div>
              ))
            ) : (
              <EmptyState icon={CheckCircle2} title="Everyone submitted" message="No pending students for this assignment." />
            )}
          </div>
        </Card>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'submissions', label: 'Submissions', icon: Users, count: submissions.length },
          { value: 'questions', label: 'Question set', icon: FileText, count: assignment.questions?.length || 0 },
        ]}
      />

      {tab === 'submissions' ? (
        submissions.length ? (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Answer</th>
                  <th>Marks</th>
                  <th>Feedback</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => {
                  const percentage = submission.marksObtained != null ? (submission.marksObtained / (assignment.totalMarks || 1)) * 100 : null;
                  return (
                    <tr key={submission._id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={submission.student?.user?.name || submission.student?.rollNo} size={34} />
                          <div>
                            <p className="font-medium text-ink-800">{submission.student?.user?.name}</p>
                            <p className="text-xs text-ink-500">{submission.student?.rollNo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-xs text-ink-500">{formatDateTime(submission.submittedAt)}</td>
                      <td>
                        <Badge tone={submission.status === 'graded' ? 'success' : submission.status === 'late' ? 'warning' : 'info'}>{submission.status}</Badge>
                      </td>
                      <td className="max-w-xs">
                        <p className="line-clamp-2 text-sm text-ink-600">{submission.content || '—'}</p>
                        {submission.attachmentUrl ? (
                          <a href={submission.attachmentUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">
                            Open attachment
                          </a>
                        ) : null}
                      </td>
                      <td>
                        {submission.marksObtained != null ? (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-ink-800">
                              {submission.marksObtained}/{assignment.totalMarks}
                            </span>
                            <Badge className={gradeColor(gradeFromPercentage(percentage))}>{gradeFromPercentage(percentage)}</Badge>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-400">Not graded</span>
                        )}
                      </td>
                      <td className="max-w-[12rem]">
                        <p className="line-clamp-2 text-xs text-ink-500">{submission.feedback || '—'}</p>
                      </td>
                      <td>
                        <Button size="sm" variant={submission.status === 'graded' ? 'ghost' : 'primary'} onClick={() => openGrading(submission)}>
                          {submission.status === 'graded' ? 'Edit' : 'Grade'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Card>
            <EmptyState icon={Users} title="No submissions yet" message="Students will appear here as soon as they submit." />
          </Card>
        )
      ) : null}

      {tab === 'questions' ? (
        assignment.questions?.length ? (
          <div className="space-y-4">
            {assignment.questions.map((question, index) => (
              <Card key={question._id || index} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700">{index + 1}</span>
                    <div>
                      <p className="font-medium text-ink-800">{question.questionText || question.text}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone="neutral">{question.type || question.questionType}</Badge>
                        <Badge tone="info">{question.difficulty || 'medium'}</Badge>
                        {question.topic ? <Badge tone="brand">{question.topic}</Badge> : null}
                        <Badge tone="success">{question.marks} marks</Badge>
                      </div>
                    </div>
                  </div>
                  {question.answer || question.correctAnswer ? (
                    <div className="max-w-sm rounded-xl bg-success-50 px-4 py-3 text-xs text-success-700">
                      <p className="font-semibold uppercase tracking-wide">Answer</p>
                      <p className="mt-1">{question.answer || question.correctAnswer}</p>
                    </div>
                  ) : null}
                </div>
                {question.options?.length ? (
                  <ul className="mt-3 grid gap-1.5 pl-11 text-sm text-ink-600">
                    {question.options.map((option) => (
                      <li key={option} className="rounded-lg bg-ink-50 px-3 py-1.5">
                        {option}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon={FileText} title="No structured questions" message="This assignment relies on the written instructions above." />
          </Card>
        )
      ) : null}

      <Modal
        open={Boolean(grading)}
        onClose={() => setGrading(null)}
        title="Grade submission"
        subtitle={grading ? `${grading.student?.user?.name} · ${grading.student?.rollNo}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setGrading(null)}>
              Cancel
            </Button>
            <Button onClick={submitGrade} loading={saving} icon={Save}>
              Save grade
            </Button>
          </>
        }
      >
        {grading ? (
          <div className="space-y-5">
            <div className="rounded-2xl bg-ink-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Student answer</p>
              <p className="mt-2 whitespace-pre-line text-sm text-ink-700">{grading.content || 'No written answer provided.'}</p>
              {grading.attachmentUrl ? (
                <a href={grading.attachmentUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-brand-600 hover:underline">
                  Open attachment
                </a>
              ) : null}
            </div>

            <Input
              label={`Marks (out of ${assignment.totalMarks})`}
              type="number"
              min={0}
              max={assignment.totalMarks}
              value={gradeForm.marksObtained}
              onChange={(event) => setGradeForm({ ...gradeForm, marksObtained: event.target.value })}
              help={
                gradeForm.marksObtained !== ''
                  ? `That is ${Math.round((Number(gradeForm.marksObtained) / assignment.totalMarks) * 100)}%`
                  : 'Enter the awarded marks'
              }
            />

            <Textarea
              label="Feedback for the student"
              rows={4}
              value={gradeForm.feedback}
              onChange={(event) => setGradeForm({ ...gradeForm, feedback: event.target.value })}
              placeholder="Strong structure — add examples to the third section…"
            />

            {gradeForm.marksObtained !== '' ? (
              <div className={`text-sm font-semibold ${percentageColor((Number(gradeForm.marksObtained) / assignment.totalMarks) * 100)}`}>
                Grade {gradeFromPercentage((Number(gradeForm.marksObtained) / assignment.totalMarks) * 100)} ·{" "}
                {Math.round((Number(gradeForm.marksObtained) / assignment.totalMarks) * 100)}%
              </div>
            ) : null}

            <p className="flex items-center gap-2 text-xs text-ink-500">
              <MessageSquare size={13} /> The student receives an in-app notification with their score and feedback.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

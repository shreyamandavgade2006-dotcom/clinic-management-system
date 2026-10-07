import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, CheckCircle2, Clock, FileText, Send, Upload } from 'lucide-react';
import { assignmentApi } from '../../api/endpoints';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  PageLoader,
  SectionTitle,
  Textarea,
  toast,
} from '../../components/ui';
import { daysLeftLabel, formatDate, formatDateTime, humanise } from '../../utils/format';

export default function StudentAssignmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [content, setContent] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    assignmentApi
      .get(id)
      .then((result) => {
        setData(result.data);
        setContent(result.data.mySubmission?.content || '');
        setAttachmentUrl(result.data.mySubmission?.attachmentUrl || '');
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const submit = async () => {
    if (!content.trim()) {
      toast('Please write your answer or add a note before submitting.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await assignmentApi.submit(id, { content, attachmentUrl });
      toast('Assignment submitted successfully!', 'success');
      load();
    } catch (submitError) {
      toast(submitError.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error) return <Alert tone="danger" title="Could not load the assignment">{error}</Alert>;
  if (!data) return null;

  const { assignment, mySubmission } = data;
  const overdue = new Date(assignment.dueDate) < new Date();
  const graded = mySubmission?.status === 'graded';

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="btn-ghost btn-sm">
        <ArrowLeft size={15} /> Back to assignments
      </button>

      <SectionTitle
        title={assignment.title}
        subtitle={`${assignment.subject?.name} · ${humanise(assignment.type)} · ${assignment.totalMarks} marks`}
        action={
          <Badge tone={graded ? 'success' : mySubmission ? 'info' : overdue ? 'danger' : 'warning'}>
            {graded ? 'Graded' : mySubmission ? humanise(mySubmission.status) : overdue ? 'Overdue' : daysLeftLabel(Math.ceil((new Date(assignment.dueDate) - Date.now()) / 86400000))}
          </Badge>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Instructions" subtitle={assignment.topic ? `Topic: ${assignment.topic}` : ''} icon={FileText} />
            <div className="space-y-4 p-5">
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700">{assignment.description || 'No description provided.'}</p>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-ink-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-ink-500">Due date</p>
                  <p className="mt-1 text-sm font-semibold text-ink-800">{formatDate(assignment.dueDate, { weekday: 'short' })}</p>
                </div>
                <div className="rounded-xl bg-ink-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-ink-500">Total marks</p>
                  <p className="mt-1 text-sm font-semibold text-ink-800">{assignment.totalMarks}</p>
                </div>
                <div className="rounded-xl bg-ink-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-ink-500">Late submission</p>
                  <p className="mt-1 text-sm font-semibold text-ink-800">{assignment.allowLateSubmission ? 'Allowed' : 'Not allowed'}</p>
                </div>
              </div>

              {assignment.unit ? <p className="text-sm text-ink-500">Unit: {assignment.unit}</p> : null}
            </div>
          </Card>

          {assignment.questions?.length ? (
            <Card>
              <CardHeader title="Question paper" subtitle={`${assignment.questions.length} questions · ${assignment.totalMarks} marks`} icon={FileText} />
              <ol className="divide-y divide-ink-100">
                {assignment.questions.map((question, index) => (
                  <li key={index} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm font-medium text-ink-800">
                        <span className="mr-2 text-ink-400">Q{index + 1}.</span>
                        {question.questionText}
                      </p>
                      <Badge tone="neutral">{question.marks} marks</Badge>
                    </div>
                    {question.options?.length ? (
                      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                        {question.options.map((option) => (
                          <li key={option} className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs text-ink-600">
                            {option}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title={mySubmission ? 'Your submission' : 'Submit your work'}
              subtitle={mySubmission ? `Submitted ${formatDateTime(mySubmission.submittedAt)}` : 'Type your answer or paste a link to your file'}
              icon={Send}
            />

            <div className="space-y-4 p-5">
              {graded ? (
                <Alert tone="success" title={`Graded — ${mySubmission.marksObtained}/${assignment.totalMarks}`}>
                  {mySubmission.feedback || 'No feedback provided.'}
                </Alert>
              ) : null}

              {mySubmission && !graded ? (
                <Alert tone="info" title={`Status: ${humanise(mySubmission.status)}`}>
                  You can update your submission until the teacher grades it.
                </Alert>
              ) : null}

              {overdue && !assignment.allowLateSubmission && !mySubmission ? (
                <Alert tone="danger" title="Deadline passed">
                  Late submissions are not allowed for this assignment. Contact your teacher if you have a genuine reason.
                </Alert>
              ) : null}

              <Field label="Your answer / notes">
                <Textarea
                  rows={8}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Write your solution, observations or a summary of the attached file…"
                  disabled={graded}
                />
              </Field>

              <Field label="Attachment link (optional)" help="Drive / GitHub / OneDrive link to your file">
                <div className="relative">
                  <Upload size={15} className="pointer-events-none absolute left-3 top-3.5 text-ink-400" />
                  <input
                    className="input pl-9"
                    value={attachmentUrl}
                    onChange={(event) => setAttachmentUrl(event.target.value)}
                    placeholder="https://…"
                    disabled={graded}
                  />
                </div>
              </Field>

              {!graded ? (
                <Button onClick={submit} loading={submitting} className="w-full">
                  {mySubmission ? 'Update submission' : 'Submit assignment'}
                </Button>
              ) : null}

              {assignment.allowLateSubmission && overdue && !graded ? (
                <p className="text-center text-xs text-warning-600">Late submissions are accepted but may be marked as late.</p>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Submission checklist" icon={CheckCircle2} />
            <ul className="space-y-3 p-5 text-sm">
              {[
                'Answer all parts of the question',
                'Write your name and roll number in the file',
                'Upload a readable PDF or document',
                'Submit before the deadline',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-500" />
                  <span className="text-ink-600">{item}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Deadline" icon={CalendarClock} />
            <div className="p-5">
              <p className="text-sm font-semibold text-ink-800">{formatDate(assignment.dueDate, { weekday: 'long' })}</p>
              <p className="mt-1 flex items-center gap-2 text-xs text-ink-500">
                <Clock size={13} />
                {daysLeftLabel(Math.ceil((new Date(assignment.dueDate) - Date.now()) / 86400000))}
              </p>
              <Link to="/student/assignments" className="btn-secondary btn-sm mt-4 w-full">
                All assignments
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

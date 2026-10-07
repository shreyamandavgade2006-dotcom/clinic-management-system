import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  BarChart3,
  Brain,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  PenLine,
  Save,
  Send,
  Sparkles,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import { quizApi } from '../../api/endpoints';
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
import { GradeDistributionChart } from '../../components/charts';
import { formatDate, formatDateTime, gradeColor, humanise, pct, percentageColor } from '../../utils/format';

export default function TeacherQuizDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const [reviewMarks, setReviewMarks] = useState({});
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    quizApi
      .get(id)
      .then((result) => setData(result.data))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const togglePublish = async () => {
    setBusy(true);
    try {
      await quizApi.update(id, { status: data.quiz.status === 'published' ? 'draft' : 'published' });
      toast(data.quiz.status === 'published' ? 'Quiz unpublished' : 'Quiz published — students notified', 'success');
      load();
    } catch (publishError) {
      toast(publishError.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleAnswers = async () => {
    setBusy(true);
    try {
      await quizApi.update(id, { showAnswers: !data.quiz.showAnswers });
      toast(`Answer key ${data.quiz.showAnswers ? 'hidden from' : 'visible to'} students`, 'success');
      load();
    } catch (answerError) {
      toast(answerError.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeQuiz = async () => {
    if (!window.confirm(`Delete "${data.quiz.title}" and every attempt?`)) return;
    try {
      await quizApi.remove(id);
      toast('Quiz deleted', 'success');
      navigate('/teacher/quizzes');
    } catch (removeError) {
      toast(removeError.message, 'error');
    }
  };

  const openReviewAttempt = async (attemptId) => {
    try {
      const result = await quizApi.attempt(attemptId);
      openReview(result.data);
    } catch (attemptError) {
      toast(attemptError.message, 'error');
    }
  };

  const openReview = (attempt) => {
    setReviewing(attempt);
    setFeedback(attempt.feedback || '');
    const initial = {};
    (attempt.answers || []).forEach((answer) => {
      initial[answer.questionId] = answer.marksAwarded ?? '';
    });
    setReviewMarks(initial);
  };

  const submitReview = async () => {
    setSaving(true);
    try {
      await quizApi.review(reviewing._id, {
        feedback,
        reviews: Object.entries(reviewMarks).map(([questionId, marksAwarded]) => ({ questionId, marksAwarded: Number(marksAwarded) || 0 })),
      });
      toast('Evaluation saved and the student has been notified', 'success');
      setReviewing(null);
      load();
    } catch (reviewError) {
      toast(reviewError.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const questionStats = useMemo(() => {
    if (!data?.attempts?.length) return [];
    const buckets = new Map();
    data.attempts.forEach((attempt) => {
      (attempt.answers || []).forEach((answer) => {
        const entry = buckets.get(String(answer.questionId)) || {
          questionId: answer.questionId,
          questionText: answer.questionText,
          correct: 0,
          wrong: 0,
          skipped: 0,
          total: 0,
          marksAwarded: 0,
          maxMarks: answer.maxMarks || 0,
        };
        entry.total += 1;
        entry.marksAwarded += answer.marksAwarded || 0;
        if (answer.needsManualReview) entry.skipped += 1;
        else if (answer.isCorrect) entry.correct += 1;
        else if (answer.answer) entry.wrong += 1;
        else entry.skipped += 1;
        buckets.set(String(answer.questionId), entry);
      });
    });
    return [...buckets.values()].sort((a, b) => a.correct / (a.total || 1) - b.correct / (b.total || 1));
  }, [data]);

  if (loading) return <PageLoader />;
  if (error) return <Alert tone="danger" title="Could not load this quiz">{error}</Alert>;
  if (!data) return null;

  const { quiz, attempts = [], analytics = {} } = data;
  const distribution = (analytics.distribution || []).map((entry) => ({ ...entry, label: entry.range }));
  const pendingReview = attempts.filter((attempt) => attempt.status === 'submitted');

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="btn-ghost btn-sm">
        <ArrowLeft size={15} /> Back to quizzes
      </button>

      <SectionTitle
        title={quiz.title}
        subtitle={`${quiz.subject?.name || 'Subject'} · ${quiz.className} · ${humanise(quiz.paperType || 'quiz')} · ${quiz.questionCount || quiz.questions?.length || 0} questions · ${quiz.totalMarks} marks`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Eye} onClick={toggleAnswers} loading={busy}>
              {quiz.showAnswers ? 'Hide answer key' : 'Reveal answer key'}
            </Button>
            <Button icon={Send} onClick={togglePublish} loading={busy}>
              {quiz.status === 'published' ? 'Unpublish' : 'Publish quiz'}
            </Button>
            <button onClick={removeQuiz} className="btn-ghost text-danger-600 hover:bg-danger-50">
              <Trash2 size={16} />
            </button>
          </div>
        }
      />

      {pendingReview.length ? (
        <Alert tone="warning" title={`${pendingReview.length} attempt(s) need manual review`}>
          These submissions contain long answers that must be evaluated by you. Open the attempts tab and click Review.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Attempts" value={analytics.attempts || 0} hint={`${quiz.maxAttempts || 1} attempt(s) allowed`} icon={Users} tone="brand" />
        <StatCard label="Average score" value={pct(analytics.average || 0)} hint={`Highest ${pct(analytics.highest || 0)}`} icon={BarChart3} tone="purple" trend={<ProgressBar value={analytics.average || 0} />} />
        <StatCard label="Pass rate" value={pct(analytics.passRate || 0)} hint="Scored 40% or more" icon={Award} tone="success" />
        <StatCard label="Lowest score" value={pct(analytics.lowest || 0)} hint={quiz.dueDate ? `Due ${formatDate(quiz.dueDate)}` : 'No deadline'} icon={Clock} tone="warning" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader title="Score distribution" subtitle="How the class performed on this assessment" icon={BarChart3} />
          <div className="p-4">
            <GradeDistributionChart data={distribution} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Quiz configuration" icon={Brain} />
          <div className="grid gap-3 p-5 text-sm">
            {[
              ['Difficulty', humanise(quiz.difficulty || 'medium')],
              ['Question type', humanise(quiz.questionType || 'mixed')],
              ['Duration', `${quiz.durationMinutes} minutes`],
              ['Unit', quiz.unit || '—'],
              ['Topic', quiz.topic || '—'],
              ['Status', quiz.status],
              ['Answer key', quiz.showAnswers ? 'Visible after submission' : 'Hidden'],
              ['Created', formatDateTime(quiz.createdAt)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-2">
                <span className="text-xs uppercase tracking-wide text-ink-500">{label}</span>
                <span className="font-semibold text-ink-800">{value}</span>
              </div>
            ))}
            {quiz.aiGenerated ? (
              <Badge tone="purple">
                <Sparkles size={11} /> AI generated {quiz.aiProvider ? `· ${quiz.aiProvider}` : ''}
              </Badge>
            ) : null}
          </div>
        </Card>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Attempts', icon: Users, count: attempts.length },
          { value: 'questions', label: 'Question analysis', icon: ClipboardList, count: quiz.questions?.length || 0 },
        ]}
      />

      {tab === 'overview' ? (
        attempts.length ? (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Score</th>
                  <th>Percentage</th>
                  <th>Grade</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={attempt._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={attempt.student?.user?.name || attempt.student?.rollNo} size={34} />
                        <div>
                          <p className="font-medium text-ink-800">{attempt.student?.user?.name}</p>
                          <p className="text-xs text-ink-500">{attempt.student?.rollNo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="font-semibold text-ink-800">
                      {attempt.score}/{attempt.totalMarks}
                    </td>
                    <td className="w-44">
                      <ProgressBar value={attempt.percentage} showLabel />
                    </td>
                    <td>
                      <Badge className={gradeColor(attempt.grade)}>{attempt.grade}</Badge>
                    </td>
                    <td className="text-xs text-ink-500">{attempt.submittedAt ? formatDateTime(attempt.submittedAt) : '—'}</td>
                    <td>
                      <Badge tone={attempt.status === 'evaluated' ? 'success' : attempt.status === 'submitted' ? 'warning' : 'info'}>{attempt.status}</Badge>
                    </td>
                    <td>
                      <Button size="sm" variant="secondary" icon={PenLine} onClick={() => openReviewAttempt(attempt._id)}>
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Card>
            <EmptyState icon={Users} title="No attempts yet" message="Publish the quiz and share it with the class to collect responses." />
          </Card>
        )
      ) : null}

      {tab === 'questions' ? (
        quiz.questions?.length ? (
          <div className="space-y-4">
            {quiz.questions.map((question, index) => {
              const stat = questionStats.find((entry) => String(entry.questionId) === String(question._id));
              const accuracy = stat && stat.total ? Math.round((stat.correct / stat.total) * 100) : 0;
              return (
                <Card key={question._id || index} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-ink-800">{question.questionText}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge tone="neutral">{humanise(question.type)}</Badge>
                          <Badge tone={question.difficulty === 'hard' ? 'danger' : question.difficulty === 'easy' ? 'success' : 'warning'}>{question.difficulty}</Badge>
                          {question.topic ? <Badge tone="brand">{question.topic}</Badge> : null}
                          <Badge tone="info">{question.marks} marks</Badge>
                        </div>
                        {question.options?.length ? (
                          <ul className="mt-3 grid gap-1.5 text-sm text-ink-600">
                            {question.options.map((option) => (
                              <li
                                key={option}
                                className={`rounded-lg px-3 py-1.5 ${
                                  option === question.correctAnswer ? 'bg-success-50 text-success-700' : 'bg-ink-50'
                                }`}
                              >
                                {option}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <p className="mt-3 text-xs text-success-700">
                          <span className="font-semibold uppercase tracking-wide">Answer:</span> {question.correctAnswer || question.answer || 'Manually evaluated'}
                        </p>
                        {question.explanation ? <p className="mt-2 text-xs text-ink-500">{question.explanation}</p> : null}
                      </div>
                    </div>

                    <div className="w-full max-w-[12rem] space-y-2 rounded-2xl bg-ink-50 p-4 text-xs">
                      <div className="flex justify-between">
                        <span className="text-ink-500">Accuracy</span>
                        <span className={`font-semibold ${percentageColor(accuracy)}`}>{accuracy}%</span>
                      </div>
                      <ProgressBar value={accuracy} height="h-1.5" />
                      <div className="flex justify-between text-ink-500">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 size={12} className="text-success-600" /> {stat?.correct || 0} correct
                        </span>
                        <span className="flex items-center gap-1">
                          <XCircle size={12} className="text-danger-600" /> {stat?.wrong || 0} wrong
                        </span>
                      </div>
                      <p className="text-ink-500">{stat?.skipped || 0} skipped / pending review</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <EmptyState icon={FileText} title="No questions stored" message="This quiz has no question set to analyse." />
          </Card>
        )
      ) : null}

      <Modal
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title="Manual evaluation"
        subtitle={reviewing ? `${reviewing.student?.user?.name} · ${reviewing.percentage}% so far` : ''}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewing(null)}>
              Cancel
            </Button>
            <Button onClick={submitReview} loading={saving} icon={Save}>
              Save evaluation
            </Button>
          </>
        }
      >
        {reviewing ? (
          <div className="space-y-4">
            {(reviewing.answers || []).map((answer, index) => (
              <div key={answer.questionId || index} className="rounded-2xl border border-ink-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-800">
                      {index + 1}. {answer.questionText}
                    </p>
                    <p className="mt-2 whitespace-pre-line rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-700">
                      {answer.answer || '— unanswered —'}
                    </p>
                    {answer.correctAnswer ? (
                      <p className="mt-2 text-xs text-success-700">
                        <span className="font-semibold uppercase tracking-wide">Expected:</span> {answer.correctAnswer}
                      </p>
                    ) : null}
                    {answer.needsManualReview ? <Badge tone="warning" className="mt-2">Needs your review</Badge> : null}
                  </div>
                  <div className="w-32">
                    <Input
                      label={`Marks / ${answer.maxMarks}`}
                      type="number"
                      min={0}
                      max={answer.maxMarks}
                      value={reviewMarks[answer.questionId] ?? ''}
                      onChange={(event) => setReviewMarks({ ...reviewMarks, [answer.questionId]: event.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}

            <Textarea label="Overall feedback" rows={3} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Good attempt — revise normalization forms." />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

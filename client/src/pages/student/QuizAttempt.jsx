import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Lightbulb,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react';
import { quizApi } from '../../api/endpoints';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Modal,
  PageLoader,
  ProgressBar,
  SectionTitle,
  toast,
} from '../../components/ui';
import { formatDateTime, gradeColor, humanise, percentageColor, pct } from '../../utils/format';

export default function QuizAttempt() {
  const { quizId } = useParams();
  const navigate = useNavigate();

  const [state, setState] = useState('loading'); // loading | intro | running | result | error
  const [quiz, setQuiz] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState(null);
  const [review, setReview] = useState([]);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const startedAt = useRef(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const result = await quizApi.get(quizId);
      const { quiz: quizData, latestAttempt, attempts } = result.data;
      setQuiz(quizData);

      if (latestAttempt && latestAttempt.status !== 'in-progress') {
        setAttempt(latestAttempt);
        setResult({
          score: latestAttempt.score,
          totalMarks: latestAttempt.totalMarks,
          percentage: latestAttempt.percentage,
          grade: latestAttempt.grade,
          correctCount: latestAttempt.correctCount,
          wrongCount: latestAttempt.wrongCount,
          skippedCount: latestAttempt.skippedCount,
          needsReview: latestAttempt.status === 'submitted',
        });
        setReview(latestAttempt.answers || []);
        setState('result');
        return;
      }

      if (!quizData.canAttempt && (!attempts || attempts.length === 0)) {
        setState('intro');
        return;
      }
      setState('intro');
    } catch (requestError) {
      setError(requestError.message);
      setState('error');
    }
  }, [quizId]);

  useEffect(() => {
    load();
  }, [load]);

  /* countdown timer */
  useEffect(() => {
    if (state !== 'running') return undefined;
    const timer = setInterval(() => {
      setSecondsLeft((value) => {
        if (value <= 1) {
          clearInterval(timer);
          submit(true);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const start = async () => {
    try {
      const result = await quizApi.start(quizId);
      const { attempt: attemptData, quiz: quizData } = result.data;
      setAttempt(attemptData);
      setQuiz((previous) => ({ ...previous, ...quizData, questions: quizData.questions }));
      setAnswers(
        Object.fromEntries((attemptData.answers || []).map((answer) => [answer.questionId, answer.answer]))
      );
      setSecondsLeft((quizData.durationMinutes || 15) * 60);
      startedAt.current = Date.now();
      setCurrent(0);
      setState('running');
      if (result.data.resumed) toast('Resuming your previous attempt', 'info');
    } catch (startError) {
      toast(startError.message, 'error');
    }
  };

  const submit = async (auto = false) => {
    if (submitting) return;
    setSubmitting(true);
    setConfirmOpen(false);
    try {
      const payload = {
        attemptId: attempt?._id,
        answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
        timeTakenSeconds: startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : undefined,
      };
      const response = await quizApi.submit(quizId, payload);
      setResult(response.data.result);
      setReview(response.data.review || []);
      setAttempt(response.data.attempt);
      setState('result');
      toast(auto ? 'Time up — your answers were submitted automatically.' : 'Submitted! Your result is ready.', auto ? 'info' : 'success');
    } catch (submitError) {
      toast(submitError.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const questions = quiz?.questions || [];
  const answeredCount = Object.keys(answers).filter((key) => String(answers[key] || '').trim()).length;
  const question = questions[current];
  const progress = questions.length ? ((current + 1) / questions.length) * 100 : 0;

  const timerLabel = useMemo(() => {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [secondsLeft]);

  if (state === 'loading') return <PageLoader />;
  if (state === 'error') return <Alert tone="danger" title="Could not open this assessment">{error}</Alert>;

  /* ------------------------------- intro ------------------------------- */
  if (state === 'intro') {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <button onClick={() => navigate('/student/quizzes')} className="btn-ghost btn-sm">
          <ArrowLeft size={15} /> Back to assessments
        </button>

        <Card>
          <div className="gradient-brand p-6 text-white">
            <Badge className="bg-white/15 text-white">
              <Sparkles size={13} /> AI generated {humanise(quiz?.paperType || 'quiz')}
            </Badge>
            <h1 className="mt-3 text-2xl font-bold">{quiz?.title}</h1>
            <p className="mt-1 text-sm text-white/85">
              {quiz?.subject?.name} {quiz?.unit ? `· ${quiz.unit}` : ''}
            </p>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-4">
            {[
              { label: 'Questions', value: quiz?.questions?.length || 0, icon: Brain },
              { label: 'Total marks', value: quiz?.totalMarks || 0, icon: Target },
              { label: 'Duration', value: `${quiz?.durationMinutes || 15} min`, icon: Clock },
              { label: 'Attempts allowed', value: quiz?.maxAttempts || 1, icon: RotateCcw },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-ink-50 p-4 text-center">
                <item.icon size={18} className="mx-auto text-brand-500" />
                <p className="mt-2 text-lg font-bold text-ink-900">{item.value}</p>
                <p className="text-xs text-ink-500">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-4 border-t border-ink-100 p-6">
            <div>
              <p className="text-sm font-semibold text-ink-800">Instructions</p>
              <p className="mt-1 whitespace-pre-line text-sm text-ink-600">
                {quiz?.instructions || 'Attempt all questions. Each question carries the marks shown next to it.'}
              </p>
            </div>

            {quiz?.topic ? (
              <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-800">
                <p className="font-semibold">Topics covered</p>
                <p className="mt-1">{quiz.topic}</p>
              </div>
            ) : null}

            <Alert tone="info" title="Before you start">
              The timer starts immediately. Descriptive answers are evaluated by your teacher, objective questions are scored instantly.
            </Alert>

            <div className="flex flex-wrap gap-3">
              <Button onClick={start} className="px-6">
                Start attempt
              </Button>
              <Link to="/student/quizzes" className="btn-secondary">
                Maybe later
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  /* ------------------------------ running ------------------------------ */
  if (state === 'running' && question) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-500">{quiz.title}</p>
            <p className="text-sm font-semibold text-ink-800">
              Question {current + 1} of {questions.length}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone="brand">
              {answeredCount}/{questions.length} answered
            </Badge>
            <Badge tone={secondsLeft < 60 ? 'danger' : secondsLeft < 180 ? 'warning' : 'info'}>
              <Clock size={13} /> {timerLabel}
            </Badge>
          </div>
        </div>

        <ProgressBar value={progress} />

        <Card>
          <div className="flex items-start justify-between gap-4 p-6 pb-4">
            <p className="text-base font-medium leading-relaxed text-ink-900">
              <span className="mr-2 font-bold text-brand-500">Q{current + 1}.</span>
              {question.questionText}
            </p>
            <Badge tone="neutral" className="shrink-0">
              {question.marks} mark{question.marks === 1 ? '' : 's'}
            </Badge>
          </div>

          <div className="space-y-2.5 px-6 pb-6">
            {question.type === 'mcq' || question.type === 'true-false' ? (
              (question.options || []).map((option) => {
                const selected = answers[question._id] === option;
                return (
                  <button
                    key={option}
                    onClick={() => setAnswers({ ...answers, [question._id]: option })}
                    className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                      selected ? 'border-brand-400 bg-brand-50 text-brand-900 ring-1 ring-brand-200' : 'border-ink-200 hover:border-brand-200 hover:bg-ink-50'
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold ${
                        selected ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-300 text-ink-400'
                      }`}
                    >
                      {selected ? '✓' : String.fromCharCode(65 + (question.options || []).indexOf(option))}
                    </span>
                    <span>{option}</span>
                  </button>
                );
              })
            ) : (
              <textarea
                className="input min-h-[180px] resize-y"
                placeholder={
                  question.type === 'numerical'
                    ? 'Show your calculation and write the final answer…'
                    : question.type === 'long-answer'
                      ? 'Write a detailed answer covering definition, explanation and examples…'
                      : 'Write your answer…'
                }
                value={answers[question._id] || ''}
                onChange={(event) => setAnswers({ ...answers, [question._id]: event.target.value })}
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-ink-100 p-4">
            <Button variant="secondary" disabled={current === 0} onClick={() => setCurrent((value) => value - 1)}>
              <ChevronLeft size={16} /> Previous
            </Button>

            <div className="flex flex-wrap justify-center gap-1.5">
              {questions.map((item, index) => (
                <button
                  key={item._id}
                  onClick={() => setCurrent(index)}
                  title={`Question ${index + 1}`}
                  className={`h-7 w-7 rounded-lg text-xs font-semibold transition ${
                    index === current
                      ? 'bg-brand-600 text-white'
                      : String(answers[item._id] || '').trim()
                        ? 'bg-success-100 text-success-700'
                        : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            {current === questions.length - 1 ? (
              <Button onClick={() => setConfirmOpen(true)} loading={submitting}>
                <Send size={16} /> Submit
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setCurrent((value) => value + 1)}>
                Next <ChevronRight size={16} />
              </Button>
            )}
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-500">
            Tip: unanswered questions are marked as skipped. You can navigate freely using the numbers above.
          </p>
          <Button variant="ghost" onClick={() => setConfirmOpen(true)}>
            Finish and submit
          </Button>
        </div>

        <Modal
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title="Submit this attempt?"
          subtitle={`${answeredCount} of ${questions.length} questions answered`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                Keep attempting
              </Button>
              <Button onClick={() => submit(false)} loading={submitting}>
                Yes, submit
              </Button>
            </>
          }
        >
          {answeredCount < questions.length ? (
            <Alert tone="warning" title={`${questions.length - answeredCount} unanswered question(s)`}>
              Unanswered questions will be treated as skipped and will not earn any marks.
            </Alert>
          ) : (
            <Alert tone="success" title="All questions answered">
              Great! You can submit now.
            </Alert>
          )}
        </Modal>
      </div>
    );
  }

  /* ------------------------------- result ------------------------------- */
  if (state === 'result' && result) {
    const passed = result.percentage >= 40;
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <button onClick={() => navigate('/student/quizzes')} className="btn-ghost btn-sm">
          <ArrowLeft size={15} /> Back to assessments
        </button>

        <Card className="overflow-hidden">
          <div className={`p-6 text-white ${passed ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-rose-500 to-orange-500'}`}>
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <p className="text-sm text-white/85">{quiz?.title}</p>
                <h1 className="mt-1 text-3xl font-bold">
                  {result.score}/{result.totalMarks} <span className="text-lg font-medium">({pct(result.percentage)})</span>
                </h1>
                <p className="mt-2 text-sm text-white/90">
                  {result.needsReview ? 'Descriptive answers are pending teacher evaluation.' : passed ? 'Well done! Keep practising.' : 'Revise the topics below and try again.'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-5xl font-extrabold">{result.grade}</p>
                <p className="text-xs uppercase tracking-wide text-white/80">Grade</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-4">
            {[
              { label: 'Correct', value: result.correctCount, icon: CheckCircle2, tone: 'text-success-600' },
              { label: 'Incorrect', value: result.wrongCount, icon: XCircle, tone: 'text-danger-600' },
              { label: 'Skipped', value: result.skippedCount, icon: Info, tone: 'text-ink-500' },
              { label: 'Time taken', value: `${Math.round((attempt?.timeTakenSeconds || 0) / 60)}m`, icon: Clock, tone: 'text-brand-600' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-xl bg-ink-50 p-4">
                <item.icon size={20} className={item.tone} />
                <div>
                  <p className="text-lg font-bold text-ink-900">{item.value}</p>
                  <p className="text-xs text-ink-500">{item.label}</p>
                </div>
              </div>
            ))}
          </div>

          {result.topicBreakdown?.length ? (
            <div className="border-t border-ink-100 p-6">
              <p className="mb-3 text-sm font-semibold text-ink-800">Topic-wise performance</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {result.topicBreakdown.map((topic) => (
                  <div key={topic.topic} className="rounded-xl border border-ink-100 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium text-ink-700">{topic.topic}</span>
                      <span className="text-xs text-ink-500">
                        {topic.correct}/{topic.total}
                      </span>
                    </div>
                    <ProgressBar value={(topic.correct / topic.total) * 100} className="mt-2" height="h-1.5" />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="Answer review" subtitle="Question-wise breakdown with explanations" icon={Lightbulb} />
          <div className="divide-y divide-ink-100">
            {review.length ? (
              review.map((answer, index) => (
                <div key={answer.questionId || index} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-medium text-ink-800">
                      <span className="mr-2 text-ink-400">Q{index + 1}.</span>
                      {answer.questionText}
                    </p>
                    <Badge tone={answer.needsManualReview ? 'warning' : answer.isCorrect ? 'success' : answer.marksAwarded > 0 ? 'info' : 'danger'} className="shrink-0">
                      {answer.needsManualReview ? 'Under review' : `${answer.marksAwarded}/${answer.maxMarks}`}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div className={`rounded-lg px-3 py-2 ${answer.isCorrect ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'}`}>
                      <p className="text-xs uppercase tracking-wide opacity-70">Your answer</p>
                      <p className="mt-0.5">{answer.answer || 'Not attempted'}</p>
                    </div>
                    {answer.showAnswer !== false && answer.correctAnswer ? (
                      <div className="rounded-lg bg-ink-50 px-3 py-2 text-ink-700">
                        <p className="text-xs uppercase tracking-wide text-ink-500">Correct answer</p>
                        <p className="mt-0.5">{answer.correctAnswer}</p>
                      </div>
                    ) : null}
                  </div>

                  {answer.explanation ? (
                    <p className="mt-2 flex items-start gap-2 text-xs text-ink-500">
                      <Lightbulb size={13} className="mt-0.5 shrink-0 text-amber-500" />
                      {answer.explanation}
                    </p>
                  ) : null}

                  {answer.feedback ? <p className="mt-2 text-xs font-medium text-ink-600">{answer.feedback}</p> : null}
                </div>
              ))
            ) : (
              <EmptyState icon={AlertTriangle} title="No detailed review available" message="The answer key will be visible once your teacher publishes it." />
            )}
          </div>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Link to="/student/quizzes" className="btn-primary">
            Back to assessments
          </Link>
          <Link to="/student/marks" className="btn-secondary">
            View my marks
          </Link>
        </div>

        <p className="text-center text-xs text-ink-400">
          Completed {formatDateTime(attempt?.submittedAt)} · Grade {result.grade} · {pct(result.percentage)} ·{" "}
          <span className={percentageColor(result.percentage)}>{gradeColor(result.grade) ? 'Recorded in internal assessment' : ''}</span>
        </p>
      </div>
    );
  }

  return (
    <Card>
      <EmptyState icon={Brain} title="This assessment is not available" message="The deadline may have passed or you have used all your attempts.">
        <Link to="/student/quizzes" className="btn-primary mt-2">
          Browse assessments
        </Link>
      </EmptyState>
    </Card>
  );
}

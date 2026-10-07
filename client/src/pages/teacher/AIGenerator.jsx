import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  Brain,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileText,
  Layers,
  Lightbulb,
  ListChecks,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { aiApi, quizApi, subjectApi } from '../../api/endpoints';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Modal,
  PageLoader,
  SectionTitle,
  Select,
  StatCard,
  Textarea,
  Toggle,
  toast,
} from '../../components/ui';
import { humanise } from '../../utils/format';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy — recall & definitions' },
  { value: 'medium', label: 'Medium — application & understanding' },
  { value: 'hard', label: 'Hard — analysis & design' },
  { value: 'mixed', label: 'Mixed — balanced paper' },
];

export default function AIGenerator() {
  const navigate = useNavigate();
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [format, setFormat] = useState({

    subject: '',
    unit: '',
    topics: [],
    difficulty: 'medium',
    questionType: 'mcq',
    count: 10,
    totalMarks: 10,
    paperType: 'quiz',
    durationMinutes: 15,
    title: '',
    instructions: '',
    status: 'draft',
    showAnswers: true,
    dueDate: '',
  });
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    Promise.all([aiApi.options(), aiApi.history({ limit: 6 })])
      .then(([optionsResult, historyResult]) => {
        setOptions(optionsResult.data);
        setHistory(historyResult.data || []);
        const firstSubject = optionsResult.data?.subjects?.[0];
        if (firstSubject) {
          setFormat((current) => ({
            ...current,
            subject: firstSubject._id,
            unit: firstSubject.units?.[0]?.title || '',
          }));
        }
      })
      .catch((requestError) => toast(requestError.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const subjects = options?.subjects || [];
  const selectedSubject = useMemo(() => subjects.find((subject) => subject._id === format.subject), [subjects, format.subject]);
  const units = selectedSubject?.units || [];
  const selectedUnit = useMemo(() => units.find((unit) => unit.title === format.unit), [units, format.unit]);
  const allTopics = selectedUnit?.topics?.length ? selectedUnit.topics : (selectedSubject?.units || []).flatMap((unit) => unit.topics || []);

  const toggleTopic = (topic) =>
    setFormat((current) => ({
      ...current,
      topics: current.topics.includes(topic) ? current.topics.filter((item) => item !== topic) : [...current.topics, topic],
    }));

  const generate = async (mode = 'preview') => {
    if (!format.subject) {
      toast('Please choose a subject first', 'error');
      return;
    }
    setGenerating(true);
    setPreviewMode(mode === 'preview');
    try {
      const payload = {
        subject: format.subject,
        unit: format.unit,
        topics: format.topics,
        difficulty: format.difficulty,
        questionType: format.questionType,
        count: Number(format.count),
        totalMarks: Number(format.totalMarks),
        paperType: format.paperType,
        durationMinutes: Number(format.durationMinutes),
        title: format.title || undefined,
        extraInstructions: format.instructions || undefined,
      };

      if (mode === 'preview') {
        const result = await quizApi.preview(payload);
        setPreview(result.data);
        setShowPreview(true);
        toast(`Generated ${result.data.questions.length} questions with ${result.data.provider}`, 'success');
      } else {
        setSaving(true);
        const result = await quizApi.generate({ ...payload, status: format.status, showAnswers: format.showAnswers, dueDate: format.dueDate || undefined });
        toast('Assessment saved! Find it under Assessments.', 'success');
        setPreview({ ...result.data.quiz, provider: result.data.provider, model: result.data.model });
        setShowPreview(true);
        const refreshed = await aiApi.history({ limit: 6 });
        setHistory(refreshed.data || []);
      }
    } catch (generateError) {
      toast(generateError.message, 'error');
    } finally {
      setGenerating(false);
      setSaving(false);
    }
  };

  const copyPreview = () => {
    if (!preview) return;
    const text = [
      preview.title,
      '',
      preview.instructions,
      '',
      ...preview.questions.map(
        (question, index) =>
          `${index + 1}. ${question.questionText} (${question.marks} marks)\n${
            question.options?.length ? question.options.map((option, optionIndex) => `   ${String.fromCharCode(65 + optionIndex)}. ${option}`).join('\n') : ''
          }\n   Answer: ${question.correctAnswer}\n`
      ),
    ].join('\n');
    navigator.clipboard.writeText(text);
    toast('Question paper copied to clipboard', 'success');
  };

  const downloadPreview = () => {
    if (!preview) return;
    const text = [
      preview.title,
      '',
      preview.instructions || '',
      '',
      ...preview.questions.map(
        (question, index) =>
          `${index + 1}. ${question.questionText} (${question.marks} marks)${
            question.options?.length ? `\n${question.options.map((option, optionIndex) => `   ${String.fromCharCode(65 + optionIndex)}) ${option}`).join('\n')}` : ''
          }\n   Answer: ${question.correctAnswer}\n   Explanation: ${question.explanation || ''}\n`
      ),
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(preview.title || 'question-paper').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <PageLoader />;

  const provider = options?.provider;

  return (
    <div className="space-y-6">
      <SectionTitle
        title="AI Question & Assessment Generator"
        subtitle="Pick a subject, unit, topic, difficulty and marks — the AI writes the paper, students attempt it and scores come back automatically"
        action={
          <Badge tone={provider?.active === 'local' ? 'warning' : 'success'} dot>
            {provider?.active === 'local' ? 'Offline generator' : `AI: ${humanise(provider?.active || '')}`}
          </Badge>
        }
      />

      {provider?.active === 'local' ? (
        <Alert tone="warning" title="Running with the built-in offline generator">
          {provider.note} Generation is topic-aware and fully functional — add an API key in <code>server/.env</code> and restart the API for
          live AI output.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Subjects available" value={subjects.length} hint="From your assigned classes" icon={BookOpen} tone="brand" />
        <StatCard label="Syllabus units" value={subjects.reduce((total, subject) => total + (subject.units?.length || 0), 0)} icon={Layers} tone="info" />
        <StatCard label="Topics mapped" value={options?.topics?.length || 0} icon={ListChecks} tone="purple" />
        <StatCard
          label="Generated by you"
          value={history.length}
          hint="Recent AI papers"
          icon={Sparkles}
          tone="success"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader title="Configure the paper" subtitle="Every field is used to steer the AI prompt" icon={Settings2} />

          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <Select
              label="Subject"
              value={format.subject}
              onChange={(event) => {
                const subjectId = event.target.value;
                const subject = subjects.find((item) => item._id === subjectId);
                setFormat({ ...format, subject: subjectId, unit: subject?.units?.[0]?.title || '', topics: [] });
              }}
              options={subjects.map((subject) => ({ value: subject._id, label: `${subject.code} — ${subject.name}` }))}
              placeholder="Select subject"
            />

            <Select
              label="Unit / Chapter"
              value={format.unit}
              onChange={(event) => setFormat({ ...format, unit: event.target.value, topics: [] })}
              placeholder="Select unit"
              options={units.map((unit) => ({ value: unit.title, label: unit.title }))}
            />

            <div className="sm:col-span-2">
              <Field label="Topics" help="Leave empty to let the AI choose from the selected unit, or pick specific topics below">
                <div className="flex flex-wrap gap-2 rounded-xl border border-ink-200 bg-white p-3 min-h-[56px]">
                  {allTopics.length ? (
                    allTopics.map((topic) => (
                      <button
                        type="button"
                        key={topic}
                        onClick={() => toggleTopic(topic)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          format.topics.includes(topic)
                            ? 'border-brand-400 bg-brand-50 text-brand-700'
                            : 'border-ink-200 text-ink-600 hover:border-brand-300 hover:bg-ink-50'
                        }`}
                      >
                        {format.topics.includes(topic) ? '✓ ' : '+ '}
                        {topic}
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-ink-500">
                      No syllabus topics mapped for this unit. Add them from the Subjects page, or leave empty — the AI will still generate
                      from the unit title.
                    </p>
                  )}
                </div>
              </Field>
            </div>

            <Select
              label="Difficulty level"
              value={format.difficulty}
              onChange={(event) => setFormat({ ...format, difficulty: event.target.value })}
              options={DIFFICULTIES}
            />

            <Select
              label="Question type"
              value={format.questionType}
              onChange={(event) => setFormat({ ...format, questionType: event.target.value })}
              options={options?.questionTypes || []}
            />

            <Input
              label="Number of questions"
              type="number"
              min={1}
              max={30}
              value={format.count}
              onChange={(event) => setFormat({ ...format, count: event.target.value })}
              help="1 – 30 questions"
            />

            <Input
              label="Total marks"
              type="number"
              min={1}
              max={200}
              value={format.totalMarks}
              onChange={(event) => setFormat({ ...format, totalMarks: event.target.value })}
              help="Marks are distributed across questions"
            />

            <Select
              label="Paper type"
              value={format.paperType}
              onChange={(event) => setFormat({ ...format, paperType: event.target.value })}
              options={options?.paperTypes || []}
            />

            <Input
              label="Duration (minutes)"
              type="number"
              min={5}
              max={240}
              value={format.durationMinutes}
              onChange={(event) => setFormat({ ...format, durationMinutes: event.target.value })}
            />

            <Input
              label="Custom title (optional)"
              className="sm:col-span-2"
              value={format.title}
              onChange={(event) => setFormat({ ...format, title: event.target.value })}
              placeholder="Leave blank for an auto-generated title"
            />

            <Textarea
              label="Extra instructions for the AI (optional)"
              className="sm:col-span-2"
              rows={3}
              value={format.instructions}
              onChange={(event) => setFormat({ ...format, instructions: event.target.value })}
              placeholder="e.g. Focus on numerical problems, avoid theory questions, include one case study…"
            />

            <div className="sm:col-span-2 rounded-xl bg-ink-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink-800">
                <FileText size={15} className="text-brand-500" /> Saving options
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Select
                  label="After generating"
                  value={format.status}
                  onChange={(event) => setFormat({ ...format, status: event.target.value })}
                  options={[
                    { value: 'draft', label: 'Save as draft (review first)' },
                    { value: 'published', label: 'Publish to students immediately' },
                  ]}
                />
                <Input
                  label="Deadline (optional)"
                  type="date"
                  value={format.dueDate}
                  onChange={(event) => setFormat({ ...format, dueDate: event.target.value })}
                />
                <div className="sm:col-span-2">
                  <Toggle
                    checked={format.showAnswers}
                    onChange={(value) => setFormat({ ...format, showAnswers: value })}
                    label="Show answer key to students after submission"
                    hint="Recommended for practice quizzes. Keep it off for formal question papers."
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <Button onClick={() => generate('preview')} loading={generating && previewMode} variant="secondary" icon={Eye}>
                Preview questions
              </Button>
              <Button onClick={() => generate('save')} loading={generating && !previewMode} icon={Wand2}>
                Generate &amp; save
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="What the AI will produce" subtitle="Guided by your selections" icon={Brain} />
            <div className="space-y-4 p-5 text-sm">
              <div className="rounded-xl bg-brand-50 p-4 text-brand-900">
                <p className="font-semibold">{selectedSubject ? selectedSubject.name : 'Choose a subject'}</p>
                <p className="mt-0.5 text-xs">
                  {format.unit || 'Any unit'} {format.topics.length ? `· ${format.topics.length} topic(s) selected` : ''}
                </p>
              </div>

              <ul className="space-y-2 text-ink-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success-500" />
                  {format.count} {humanise(format.questionType)} questions worth {format.totalMarks} marks in total
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success-500" />
                  {DIFFICULTIES.find((item) => item.value === format.difficulty)?.label}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success-500" />
                  Model answers and explanations for every question
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success-500" />
                  {format.paperType === 'quiz'
                    ? 'Auto-graded with instant results for students'
                    : format.paperType === 'assessment'
                      ? 'Auto-graded assessment with topic-wise analytics'
                      : 'Printable question paper with a separate answer key'}
                </li>
              </ul>

              <div className="rounded-xl border border-dashed border-ink-200 p-3 text-xs text-ink-500">
                <Lightbulb size={14} className="mb-1 text-amber-500" />
                Tip: generate a preview first, tweak the topics, then save. Teachers can edit questions or add descriptive questions manually
                from the Assessments page.
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Recently generated" subtitle="Your latest AI papers" icon={Sparkles} />
            <div className="divide-y divide-ink-100">
              {history.length ? (
                history.map((quiz) => (
                  <button
                    key={quiz._id}
                    onClick={() => navigate(`/teacher/quizzes/${quiz._id}`)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition hover:bg-ink-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-800">{quiz.title}</p>
                      <p className="text-xs text-ink-500">
                        {quiz.subject?.name} · {quiz.questions?.length || 0} questions · {quiz.totalMarks} marks
                      </p>
                    </div>
                    <Badge tone={quiz.status === 'published' ? 'success' : 'neutral'}>{quiz.status}</Badge>
                  </button>
                ))
              ) : (
                <EmptyState icon={Sparkles} title="No AI papers yet" message="Your generated assessments will be listed here." />
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* preview modal */}
      <Modal
        open={showPreview && Boolean(preview)}
        onClose={() => setShowPreview(false)}
        size="lg"
        title={preview?.title || 'Generated paper'}
        subtitle={
          preview
            ? `${preview.questions?.length || 0} questions · ${preview.totalMarks} marks · generated by ${preview.provider || 'AI'} ${preview.model ? `(${preview.model})` : ''}`
            : ''
        }
        footer={
          <>
            <Button variant="secondary" icon={Copy} onClick={copyPreview}>
              Copy
            </Button>
            <Button variant="secondary" icon={Download} onClick={downloadPreview}>
              Download
            </Button>
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
              Print
            </Button>
            {preview?._id ? (
              <Button icon={Send} onClick={() => navigate(`/teacher/quizzes/${preview._id}`)}>
                Open in Assessments
              </Button>
            ) : (
              <Button icon={Save} onClick={() => generate('save')} loading={saving}>
                Save this paper
              </Button>
            )}
          </>
        }
      >
        {preview ? (
          <div className="space-y-4">
            <Alert tone="info" title="Instructions to students">
              {preview.instructions}
            </Alert>

            {preview.questions?.map((question, index) => (
              <div key={question._id || index} className="rounded-xl border border-ink-100 p-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm font-medium text-ink-800">
                    <span className="mr-2 text-ink-400">Q{index + 1}.</span>
                    {question.questionText}
                  </p>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge tone="neutral">{question.marks} mark{question.marks === 1 ? '' : 's'}</Badge>
                    <Badge tone="brand">{humanise(question.type)}</Badge>
                  </div>
                </div>

                {question.options?.length ? (
                  <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {question.options.map((option, optionIndex) => (
                      <li
                        key={option}
                        className={`rounded-lg px-3 py-1.5 text-xs ${
                          option === question.correctAnswer ? 'bg-success-50 font-semibold text-success-700' : 'bg-ink-50 text-ink-600'
                        }`}
                      >
                        {String.fromCharCode(65 + optionIndex)}. {option}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="mt-3 rounded-lg bg-success-50 px-3 py-2 text-xs text-success-700">
                    <span className="font-semibold">Model answer: </span>
                    {question.correctAnswer}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
                  {question.topic ? <span>Topic: {question.topic}</span> : null}
                  {question.difficulty ? <span>Difficulty: {question.difficulty}</span> : null}
                  {question.explanation ? <span className="text-ink-500">💡 {question.explanation}</span> : null}
                </div>
              </div>
            ))}

            {preview.fallback ? (
              <Alert tone="warning" title={`${humanise(preview.fallback.from)} was unavailable`}>
                {preview.fallback.reason} — the offline generator produced this paper instead.
              </Alert>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* hint for teachers with no subjects */}
      {!subjects.length ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="No subjects found"
            message="Create a subject first so the AI knows which syllabus units and topics to use."
            action={
              <Button onClick={() => navigate('/teacher/subjects')} icon={Plus}>
                Add a subject
              </Button>
            }
          />
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-3 text-xs text-ink-500">
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => aiApi.options().then((result) => setOptions(result.data))}>
          Refresh syllabus
        </Button>
        <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setFormat({ ...format, topics: [], title: '', instructions: '' })}>
          Reset form
        </Button>
      </div>
    </div>
  );
}

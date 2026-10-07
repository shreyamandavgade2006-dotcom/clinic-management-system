import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, FileSpreadsheet, Save, TrendingUp, Users } from 'lucide-react';
import { markApi, subjectApi } from '../../api/endpoints';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageLoader,
  ProgressBar,
  SectionTitle,
  StatCard,
  Tabs,
  toast,
} from '../../components/ui';
import { GradeDistributionChart, SubjectBarChart } from '../../components/charts';
import { formatDate, gradeColor, gradeFromPercentage, percentageColor, pct } from '../../utils/format';

const EXAM_TYPES = [
  { value: 'unit-test', label: 'Unit Test' },
  { value: 'insem', label: 'In-Semester' },
  { value: 'mid-term', label: 'Mid Term' },
  { value: 'endsem', label: 'End Semester' },
  { value: 'practical', label: 'Practical' },
  { value: 'internal', label: 'Internal' },
  { value: 'assignment', label: 'Assignment' },
];

export default function TeacherMarks() {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [examType, setExamType] = useState('unit-test');
  const [title, setTitle] = useState('Unit Test 1');
  const [maxMarks, setMaxMarks] = useState(20);
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10));
  const [sheet, setSheet] = useState(null);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('entry');
  const [className, setClassName] = useState('');
  const [classes, setClasses] = useState([]);
  const [classPerformance, setClassPerformance] = useState(null);

  useEffect(() => {
    subjectApi
      .list({ mine: true })
      .then((result) => {
        const list = result.data || [];
        setSubjects(list);
        if (list[0]) setSubjectId(list[0]._id);
        setClasses([...new Set(list.map((subject) => subject.className))]);
      })
      .catch((error) => toast(error.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!classes.length) return;
    if (!className) setClassName(classes[0]);
  }, [classes, className]);

  const loadSheet = useCallback(() => {
    if (!subjectId) return;
    markApi
      .subjectMarks(subjectId)
      .then((result) => {
        setSheet(result.data);
        const initial = {};
        result.data.rows.forEach((row) => {
          const existing = row.exams.find((exam) => exam.examType === examType && (!title || exam.title === title));
          initial[row.studentId] = existing ? existing.marksObtained : '';
        });
        setValues(initial);
      })
      .catch((error) => toast(error.message, 'error'));
  }, [subjectId, examType, title]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  const loadPerformance = useCallback(() => {
    if (!className) return;
    markApi
      .classPerformance(className)
      .then((result) => setClassPerformance(result.data))
      .catch((error) => toast(error.message, 'error'));
  }, [className]);

  useEffect(() => {
    if (tab === 'analytics') loadPerformance();
  }, [tab, loadPerformance]);

  const stats = useMemo(() => {
    if (!sheet) return { entered: 0, average: 0, highest: 0, failing: 0 };
    const numbers = Object.values(values)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const percentages = numbers.map((value) => (value / maxMarks) * 100);
    return {
      entered: numbers.length,
      average: percentages.length ? Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 10) / 10 : 0,
      highest: percentages.length ? Math.round(Math.max(...percentages) * 10) / 10 : 0,
      failing: percentages.filter((value) => value < 40).length,
    };
  }, [values, maxMarks]);

  const save = async () => {
    setSaving(true);
    try {
      const marks = Object.entries(values)
        .filter(([, value]) => value !== '' && value !== null && value !== undefined)
        .map(([student, value]) => ({
          student,
          subject: subjectId,
          examType,
          title,
          marksObtained: Number(value),
          maxMarks: Number(maxMarks),
          examDate,
        }));

      if (!marks.length) {
        toast('Enter at least one mark before saving', 'error');
        return;
      }

      const result = await markApi.create({ marks, notifyStudents: true });
      toast(`Saved ${result.data.saved} new and updated ${result.data.updated} mark entries`, 'success');
      loadSheet();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  const selectedSubject = subjects.find((subject) => subject._id === subjectId);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Marks & Performance"
        subtitle="Enter exam marks — grades, results and analytics update automatically"
        action={
          <Button onClick={save} loading={saving} icon={Save} disabled={tab !== 'entry'}>
            Save marks
          </Button>
        }
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'entry', label: 'Marks entry', icon: FileSpreadsheet },
          { value: 'analytics', label: 'Class analytics', icon: TrendingUp },
        ]}
      />

      {tab === 'entry' ? (
        <>
          <Card className="card-pad">
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <label className="label">Subject</label>
                <select className="input" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
                  {subjects.map((subject) => (
                    <option key={subject._id} value={subject._id}>
                      {subject.code} — {subject.name} ({subject.className})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Exam type</label>
                <select className="input" value={examType} onChange={(event) => setExamType(event.target.value)}>
                  {EXAM_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Title</label>
                <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Unit Test 1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Max marks</label>
                  <input type="number" min={1} className="input" value={maxMarks} onChange={(event) => setMaxMarks(event.target.value)} />
                </div>
                <div>
                  <label className="label">Exam date</label>
                  <input type="date" className="input" value={examDate} onChange={(event) => setExamDate(event.target.value)} />
                </div>
              </div>
            </div>

            {!subjects.length ? (
              <Alert tone="warning" className="mt-4" title="No subjects assigned">
                Create a subject or ask the administrator to assign one to your account.
              </Alert>
            ) : null}
          </Card>

          {sheet ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Students" value={sheet.rows.length} hint={selectedSubject?.name} icon={Users} tone="brand" />
                <StatCard label="Marks entered" value={`${stats.entered}/${sheet.rows.length}`} icon={FileSpreadsheet} tone="info" />
                <StatCard label="Average" value={pct(stats.average)} hint={`Highest ${stats.highest}%`} icon={TrendingUp} tone="success" trend={<ProgressBar value={stats.average} />} />
                <StatCard label="Below 40%" value={stats.failing} hint="Need remedial support" icon={Award} tone={stats.failing ? 'danger' : 'success'} />
              </div>

              <Card>
                <CardHeader
                  title={`${sheet.subject.name} · ${title || EXAM_TYPES.find((type) => type.value === examType)?.label}`}
                  subtitle={`Max marks ${maxMarks} · ${formatDate(examDate)} · press Tab to move quickly between fields`}
                  icon={FileSpreadsheet}
                />
                <div className="overflow-x-auto">
                  <table className="table min-w-full">
                    <thead>
                      <tr>
                        <th>Roll No</th>
                        <th>Student</th>
                        <th className="w-40">Marks (out of {maxMarks})</th>
                        <th>Grade</th>
                        <th>Overall %</th>
                        <th>Existing exams</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.rows.map((row) => {
                        const value = values[row.studentId];
                        const percentage = value !== '' && value !== undefined ? (Number(value) / Number(maxMarks)) * 100 : null;
                        return (
                          <tr key={row.studentId}>
                            <td className="font-mono text-xs">{row.rollNo}</td>
                            <td className="font-medium text-ink-800">{row.name}</td>
                            <td>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={maxMarks}
                                  className="input w-24 py-2"
                                  value={value ?? ''}
                                  placeholder="—"
                                  onChange={(event) => setValues({ ...values, [row.studentId]: event.target.value })}
                                />
                                <span className="text-xs text-ink-400">/ {maxMarks}</span>
                              </div>
                            </td>
                            <td>
                              {percentage !== null && Number.isFinite(percentage) ? (
                                <Badge className={gradeColor(gradeFromPercentage(percentage))}>{gradeFromPercentage(percentage)}</Badge>
                              ) : (
                                <span className="text-xs text-ink-400">—</span>
                              )}
                            </td>
                            <td className={percentage !== null ? percentageColor(percentage) : 'text-ink-400'}>
                              {percentage !== null && Number.isFinite(percentage) ? pct(percentage) : '—'}
                            </td>
                            <td className="text-xs text-ink-500">
                              {row.exams.length ? row.exams.map((exam) => `${exam.examLabel}: ${exam.marksObtained}/${exam.maxMarks}`).join(' · ') : 'None yet'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 p-4">
                  <p className="text-xs text-ink-500">
                    Saving notifies each student about their new marks and updates their performance analytics instantly.
                  </p>
                  <Button onClick={save} loading={saving} icon={Save}>
                    Save marks
                  </Button>
                </div>
              </Card>
            </>
          ) : (
            <Card>
              <EmptyState icon={FileSpreadsheet} title="Select a subject to start entering marks" />
            </Card>
          )}
        </>
      ) : null}

      {tab === 'analytics' ? (
        <>
          <Card className="card-pad">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="label">Class</label>
                <select className="input w-48" value={className} onChange={(event) => setClassName(event.target.value)}>
                  {classes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="secondary" onClick={loadPerformance}>
                Refresh
              </Button>
              {classPerformance ? (
                <>
                  <Badge tone="brand">Class average {pct(classPerformance.classAverage)}</Badge>
                  <Badge tone="success">Pass {classPerformance.passPercentage}%</Badge>
                  <Badge tone="neutral">{classPerformance.totalMarksRecords} records</Badge>
                </>
              ) : null}
            </div>
          </Card>

          {classPerformance ? (
            <>
              <div className="grid gap-5 xl:grid-cols-2">
                <Card>
                  <CardHeader title="Subject averages" subtitle="Average marks percentage per subject" icon={BookOpen} />
                  <div className="p-4">
                    <SubjectBarChart data={classPerformance.subjectAverages} dataKey="average" />
                  </div>
                </Card>
                <Card>
                  <CardHeader title="Grade distribution" subtitle="Students grouped by grade band" icon={Award} />
                  <div className="p-4">
                    <GradeDistributionChart data={classPerformance.distribution} />
                  </div>
                </Card>
              </div>

              <Card>
                <CardHeader title="Student ranking" subtitle="Sorted by overall percentage" icon={TrendingUp} />
                <div className="table-wrapper border-0 shadow-none">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Student</th>
                        <th>Roll No</th>
                        <th>Exams</th>
                        <th>Percentage</th>
                        <th>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classPerformance.students.map((student) => (
                        <tr key={student.studentId}>
                          <td>
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{student.rank}</span>
                          </td>
                          <td className="font-medium text-ink-800">{student.name}</td>
                          <td className="font-mono text-xs">{student.rollNo}</td>
                          <td>{student.exams}</td>
                          <td className="w-44">
                            <ProgressBar value={student.percentage} showLabel />
                          </td>
                          <td>
                            <Badge className={gradeColor(student.grade)}>{student.grade}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                  <CardHeader title="Top 5 toppers" icon={Award} />
                  <div className="divide-y divide-ink-100">
                    {classPerformance.toppers.map((student) => (
                      <div key={student.studentId} className="flex items-center justify-between px-5 py-3">
                        <span className="text-sm font-medium text-ink-800">{student.name}</span>
                        <span className="text-sm font-bold text-success-600">{student.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card>
                  <CardHeader title="Needs attention" subtitle="Lowest scores in the class" icon={TrendingUp} />
                  <div className="divide-y divide-ink-100">
                    {classPerformance.needsAttention.map((student) => (
                      <div key={student.studentId} className="flex items-center justify-between px-5 py-3">
                        <span className="text-sm font-medium text-ink-800">{student.name}</span>
                        <span className="text-sm font-bold text-danger-600">{student.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <EmptyState icon={TrendingUp} title="Pick a class to view analytics" />
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

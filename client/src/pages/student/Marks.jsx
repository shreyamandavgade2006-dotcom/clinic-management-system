import { useEffect, useState } from 'react';
import { Award, BadgeCheck, BookOpen, GraduationCap, Percent, TrendingUp } from 'lucide-react';
import { markApi } from '../../api/endpoints';
import {
  Alert,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageLoader,
  ProgressBar,
  SectionTitle,
  StatCard,
  Tabs,
} from '../../components/ui';
import { DonutChart, GradeDistributionChart, PerformanceTrendChart, SubjectBarChart } from '../../components/charts';
import { formatDate, gradeColor, percentageColor, pct } from '../../utils/format';

export default function StudentMarks() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [openSubject, setOpenSubject] = useState(null);

  useEffect(() => {
    markApi
      .studentPerformance('me')
      .then((result) => setData(result.data))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;
  if (error) return <Alert tone="danger" title="Could not load marks">{error}</Alert>;
  if (!data) return null;

  const { student, subjects, results, cgpa, overallPercentage, trend, strongSubjects, weakSubjects, creditsEarned, creditsTotal } = data;

  const gradeSpread = ['O', 'A+', 'A', 'B+', 'B', 'C', 'P', 'F'].map((grade) => ({
    label: grade,
    range: grade,
    count: results.filter((result) => result.grade === grade).length,
  }));

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Marks & Results"
        subtitle={`${student?.user?.name || ''} · ${student?.rollNo || ''} · Semester ${student?.semester || ''}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Overall percentage"
          value={pct(overallPercentage)}
          hint={`${results.length} subjects graded`}
          icon={Percent}
          tone="brand"
          trend={<ProgressBar value={overallPercentage} />}
        />
        <StatCard label="CGPA" value={cgpa} hint="Credit weighted grade points" icon={GraduationCap} tone="purple" />
        <StatCard label="Credits earned" value={`${creditsEarned}/${creditsTotal}`} hint="Subjects with 40% or above" icon={BookOpen} tone="success" />
        <StatCard label="Exam records" value={data.totalExams} hint="All exams and tests" icon={Award} tone="info" />
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview', icon: TrendingUp },
          { value: 'subjects', label: 'Subject-wise marks', icon: BookOpen },
          { value: 'results', label: 'Result sheet', icon: BadgeCheck },
        ]}
      />

      {tab === 'overview' ? (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader title="Performance trend" subtitle="Exam average per month" icon={TrendingUp} />
              <div className="p-4">
                <PerformanceTrendChart data={trend} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Subject comparison" subtitle="Percentage per subject" icon={BookOpen} />
              <div className="p-4">
                <SubjectBarChart data={subjects} />
              </div>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card>
              <CardHeader title="Grade spread" subtitle="Subjects by grade" icon={Award} />
              <div className="p-4">
                <GradeDistributionChart data={gradeSpread} />
              </div>
            </Card>

            <Card>
              <CardHeader title="Exam type averages" subtitle="How you perform in each exam type" icon={BadgeCheck} />
              <div className="p-4">
                <DonutChart
                  data={(data.byExamType || []).map((entry) => ({ name: entry.label, value: entry.percentage }))}
                  centerValue={pct(overallPercentage)}
                  centerLabel="Overall"
                />
              </div>
            </Card>

            <Card>
              <CardHeader title="Focus areas" subtitle="Automatically identified from your marks" icon={TrendingUp} />
              <div className="space-y-4 p-5">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-success-600">Strong subjects</p>
                  {strongSubjects?.length ? (
                    <div className="space-y-2">
                      {strongSubjects.map((subject) => (
                        <div key={subject.subjectId} className="flex items-center justify-between gap-3 rounded-xl bg-success-50 px-3 py-2">
                          <span className="text-sm font-medium text-ink-700">{subject.name}</span>
                          <span className="text-sm font-bold text-success-700">{subject.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-ink-500">Not enough data.</p>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-danger-600">Needs improvement</p>
                  {weakSubjects?.length ? (
                    <div className="space-y-2">
                      {weakSubjects.map((subject) => (
                        <div key={subject.subjectId} className="flex items-center justify-between gap-3 rounded-xl bg-danger-50 px-3 py-2">
                          <span className="text-sm font-medium text-ink-700">{subject.name}</span>
                          <span className="text-sm font-bold text-danger-600">{subject.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-ink-500">Not enough data.</p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : null}

      {tab === 'subjects' ? (
        <div className="space-y-4">
          {subjects.length ? (
            subjects.map((subject) => (
              <Card key={subject.subjectId}>
                <button
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                  onClick={() => setOpenSubject(openSubject === subject.subjectId ? null : subject.subjectId)}
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="h-11 w-1.5 shrink-0 rounded-full" style={{ background: subject.color }} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink-900">{subject.name}</p>
                      <p className="text-xs text-ink-500">
                        {subject.code} · {subject.credits} credits · {subject.count} exam records
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <div className="hidden w-40 sm:block">
                      <ProgressBar value={subject.percentage} showLabel />
                    </div>
                    <Badge className={gradeColor(subject.grade)}>Grade {subject.grade}</Badge>
                  </div>
                </button>

                {openSubject === subject.subjectId ? (
                  <div className="border-t border-ink-100 px-5 pb-5 pt-4">
                    <div className="table-wrapper">
                      <table className="table min-w-full">
                        <thead>
                          <tr>
                            <th>Exam</th>
                            <th>Date</th>
                            <th>Marks</th>
                            <th>Percentage</th>
                            <th>Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subject.exams.map((exam) => (
                            <tr key={exam._id}>
                              <td className="font-medium text-ink-700">
                                {exam.title || exam.examLabel} <span className="text-xs text-ink-400">({exam.examLabel})</span>
                              </td>
                              <td>{formatDate(exam.examDate)}</td>
                              <td>
                                {exam.marksObtained}/{exam.maxMarks}
                              </td>
                              <td className={percentageColor(exam.percentage)}>{exam.percentage}%</td>
                              <td>
                                <Badge className={gradeColor(subject.grade)}>{subject.grade}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </Card>
            ))
          ) : (
            <Card>
              <EmptyState icon={BookOpen} title="No marks published yet" message="Your subject-wise marks appear here once your teachers publish them." />
            </Card>
          )}
        </div>
      ) : null}

      {tab === 'results' ? (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Subject</th>
                <th>Credits</th>
                <th>Percentage</th>
                <th>Grade</th>
                <th>Grade points</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {results.length ? (
                results.map((result, index) => (
                  <tr key={result.subjectId}>
                    <td>{index + 1}</td>
                    <td>
                      <span className="font-medium text-ink-800">{result.name}</span>
                      <span className="ml-2 text-xs text-ink-400">{result.subject}</span>
                    </td>
                    <td>{result.credits}</td>
                    <td className={percentageColor(result.percentage)}>{result.percentage}%</td>
                    <td>
                      <Badge className={gradeColor(result.grade)}>{result.grade}</Badge>
                    </td>
                    <td>{result.gradePoints}</td>
                    <td>
                      <Badge tone={result.status === 'PASS' ? 'success' : 'danger'} dot>
                        {result.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState icon={BadgeCheck} title="No results yet" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {results.length ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-4 py-3 text-sm">
              <span className="text-ink-500">Credit weighted grade point average</span>
              <span className="font-bold text-ink-900">CGPA {cgpa} · {pct(overallPercentage)}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

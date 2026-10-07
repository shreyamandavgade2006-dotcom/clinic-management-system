import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Award,
  Layers,
  Plus,
  Save,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { subjectApi } from '../../api/endpoints';
import {
  Alert,
  Avatar,
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
import { gradeColor, pct } from '../../utils/format';

export default function TeacherSubjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [units, setUnits] = useState([]);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('syllabus');

  useEffect(() => {
    subjectApi
      .get(id)
      .then((result) => {
        setData(result.data);
        setUnits(
          (result.data.subject.units || []).map((unit, index) => ({
            unitNo: unit.unitNo || index + 1,
            title: unit.title || `Unit ${index + 1}`,
            topics: unit.topics || [],
          }))
        );
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [id]);

  const addUnit = () =>
    setUnits([...units, { unitNo: units.length + 1, title: `Unit ${units.length + 1}`, topics: [] }]);

  const removeUnit = (index) => setUnits(units.filter((_, position) => position !== index));

  const updateUnit = (index, patch) => setUnits(units.map((unit, position) => (position === index ? { ...unit, ...patch } : unit)));

  const saveUnits = async () => {
    setSaving(true);
    try {
      await subjectApi.saveUnits(id, units);
      toast('Syllabus saved — the AI generator will use these topics', 'success');
    } catch (saveError) {
      toast(saveError.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error) return <Alert tone="danger" title="Could not load this subject">{error}</Alert>;
  if (!data) return null;

  const { subject, performance, attendance, students } = data;
  const subjectBarData = (performance?.subjectAverages || []).map((item) => ({
    shortName: item.shortName || item.code,
    percentage: item.average,
    color: item.color,
    subjectId: item.subjectId,
  }));

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="btn-ghost btn-sm">
        <ArrowLeft size={15} /> Back to subjects
      </button>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white" style={{ background: subject.color || '#6366f1' }}>
              <BookOpen size={24} />
            </span>
            <div>
              <h1 className="text-xl font-bold text-ink-900">{subject.name}</h1>
              <p className="mt-1 text-sm text-ink-500">
                {subject.code} · Class {subject.className} · Semester {subject.semester} · {subject.credits} credits · Max marks {subject.maxMarks}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="brand">{subject.teacher?.user?.name || 'Unassigned'}</Badge>
                <Badge tone="neutral">{subject.units?.length || 0} units</Badge>
                <Badge tone="info">{students?.length || 0} students</Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/teacher/ai-generator?subject=${subject._id}`} className="btn-primary">
              <Sparkles size={16} /> Generate question paper
            </Link>
            <Link to={`/teacher/marks`} className="btn-secondary">
              Enter marks
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Class average" value={pct(performance?.classAverage || 0)} icon={TrendingUp} tone="brand" trend={<ProgressBar value={performance?.classAverage || 0} />} />
        <StatCard label="Attendance" value={pct(attendance?.classAverage || 0)} hint={`${attendance?.totalRecords || 0} sessions marked`} icon={Users} tone={attendance?.classAverage >= 75 ? 'success' : 'warning'} />
        <StatCard label="Marks records" value={performance?.totalMarksRecords || 0} hint={`Pass rate ${performance?.passPercentage || 0}%`} icon={Save} tone="info" />
        <StatCard label="Defaulters" value={attendance?.defaulters?.length || 0} hint="Below 75% attendance" icon={Users} tone={attendance?.defaulters?.length ? 'danger' : 'success'} />
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'syllabus', label: 'Syllabus', icon: Layers, count: units.length },
          { value: 'students', label: 'Students', icon: Users, count: students?.length || 0 },
          { value: 'performance', label: 'Performance', icon: TrendingUp },
        ]}
      />

      {tab === 'syllabus' ? (
        <Card>
          <CardHeader
            title="Units & topics"
            subtitle="Topics listed here are offered to the AI question generator"
            icon={Layers}
            action={
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" icon={Plus} onClick={addUnit}>
                  Add unit
                </Button>
                <Button size="sm" icon={Save} onClick={saveUnits} loading={saving}>
                  Save syllabus
                </Button>
              </div>
            }
          />
          <div className="space-y-4 p-5">
            {units.map((unit, index) => (
              <div key={index} className="rounded-2xl border border-ink-100 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700">{index + 1}</span>
                  <input
                    className="input max-w-sm py-2"
                    value={unit.title}
                    onChange={(event) => updateUnit(index, { title: event.target.value })}
                    placeholder="Unit title"
                  />
                  <span className="text-xs text-ink-500">{unit.topics.length} topics</span>
                  <button onClick={() => removeUnit(index)} className="btn-ghost btn-sm ml-auto text-danger-600 hover:bg-danger-50">
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {unit.topics.map((topic) => (
                    <span key={topic} className="badge bg-ink-100 text-ink-700">
                      {topic}
                      <button
                        onClick={() => updateUnit(index, { topics: unit.topics.filter((item) => item !== topic) })}
                        className="ml-1 text-ink-400 hover:text-danger-600"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    className="input w-48 py-1.5 text-xs"
                    placeholder="Add topic + Enter"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && event.currentTarget.value.trim()) {
                        updateUnit(index, { topics: [...unit.topics, event.currentTarget.value.trim()] });
                        event.currentTarget.value = '';
                      }
                    }}
                  />
                </div>
              </div>
            ))}
            {!units.length ? <EmptyState icon={Layers} title="No units yet" message="Add units and topics so the AI generator can craft questions." action={<Button icon={Plus} onClick={addUnit}>Add unit</Button>} /> : null}
          </div>
        </Card>
      ) : null}

      {tab === 'students' ? (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll No</th>
                <th>Guardian</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(students || []).map((student) => (
                <tr key={student._id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar name={student.user?.name || student.rollNo} size={34} />
                      <span className="font-medium text-ink-800">{student.user?.name}</span>
                    </div>
                  </td>
                  <td className="font-mono text-xs">{student.rollNo}</td>
                  <td className="text-xs text-ink-500">{student.guardian?.phone || 'No WhatsApp number'}</td>
                  <td>
                    <Badge tone="success" dot>
                      {student.status || 'active'}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <Link to={`/teacher/students/${student._id}`} className="btn-ghost btn-sm">
                      View profile
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'performance' ? (
        <>
          <Card>
            <CardHeader title="Subject comparison" subtitle={`Average scores across ${subject.className} subjects`} icon={TrendingUp} />
            <div className="p-4">
              <SubjectBarChart data={subjectBarData} />
            </div>
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader title="Ranking" subtitle="Highest scorers first" icon={TrendingUp} />
              <div className="divide-y divide-ink-100">
                {(performance?.students || []).map((student) => (
                  <div key={student.studentId} className="flex items-center gap-3 px-5 py-3">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{student.rank}</span>
                    <Link to={`/teacher/students/${student.studentId}`} className="flex-1 truncate text-sm font-medium text-ink-800 hover:text-brand-600">
                      {student.name}
                    </Link>
                    <span className="text-xs text-ink-500">{student.exams} exams</span>
                    <Badge className={gradeColor(student.grade)}>{student.grade}</Badge>
                    <span className="w-16 text-right text-sm font-bold text-ink-700">{pct(student.percentage)}</span>
                  </div>
                ))}
                {!performance?.students?.length ? <EmptyState icon={TrendingUp} title="No marks recorded yet" /> : null}
              </div>
            </Card>

            <Card>
              <CardHeader title="Grade distribution" subtitle="How the class is spread across grade bands" icon={Award} />
              <div className="p-4">
                <GradeDistributionChart data={(performance?.distribution || []).map((entry) => ({ ...entry, label: entry.label || entry.range }))} />
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Attendance board" subtitle="Students below 75% are flagged" icon={Users} />
            <div className="table-wrapper border-0 shadow-none">
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Sessions</th>
                    <th>Attended</th>
                    <th>Percentage</th>
                    <th>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {(attendance?.rows || []).map((row) => (
                    <tr key={row.studentId}>
                      <td>
                        <Link to={`/teacher/students/${row.studentId}`} className="font-medium text-ink-800 hover:text-brand-600">
                          {row.name}
                        </Link>
                      </td>
                      <td>{row.totalSessions}</td>
                      <td>{row.attended}</td>
                      <td className="w-44">
                        <ProgressBar value={row.percentage} showLabel />
                      </td>
                      <td>
                        {row.isDefaulter ? (
                          <Badge tone="danger" dot>
                            Below 75%
                          </Badge>
                        ) : (
                          <Badge tone="success" dot>
                            Safe
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

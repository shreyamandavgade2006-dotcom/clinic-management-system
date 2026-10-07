import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CalendarDays, Clock, MapPin, Timer } from 'lucide-react';
import { examApi } from '../../api/endpoints';
import { Alert, Badge, Card, CardHeader, EmptyState, PageLoader, SectionTitle, StatCard, Tabs } from '../../components/ui';
import { formatDate, humanise } from '../../utils/format';

export default function StudentExams() {
  const [exams, setExams] = useState([]);
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('upcoming');
  const [className, setClassName] = useState('');

  useEffect(() => {
    Promise.all([examApi.list(), examApi.list().catch(() => null)])
      .then(([listResult]) => {
        setExams(listResult.data || []);
        const studentClass = listResult.data?.[0]?.className;
        if (studentClass) {
          setClassName(studentClass);
          return examApi.timetable(studentClass).then((result) => setTimeline(result.data));
        }
        return null;
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    return {
      upcoming: exams.filter((exam) => new Date(exam.date).getTime() >= now && exam.status !== 'cancelled'),
      past: exams.filter((exam) => new Date(exam.date).getTime() < now || exam.status === 'completed'),
    };
  }, [exams]);

  const filtered = tab === 'upcoming' ? upcoming : tab === 'past' ? past : exams;

  if (loading) return <PageLoader />;

  const nextExam = upcoming[0];

  return (
    <div className="space-y-6">
      <SectionTitle title="Exams & Timetable" subtitle="Exam schedule, syllabus coverage and countdown to your next paper" />

      {error ? <Alert tone="danger" title="Could not load exams">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Upcoming exams" value={upcoming.length} icon={CalendarClock} tone="brand" />
        <StatCard label="Completed" value={past.length} icon={CalendarDays} tone="info" />
        <StatCard
          label="Next exam"
          value={nextExam ? `${nextExam.daysLeft}d` : '—'}
          hint={nextExam ? `${nextExam.title} · ${formatDate(nextExam.date)}` : 'Nothing scheduled'}
          icon={Timer}
          tone={nextExam && nextExam.daysLeft <= 2 ? 'danger' : 'warning'}
        />
        <StatCard label="Class" value={className || '—'} hint="Your examination group" icon={MapPin} tone="purple" />
      </div>

      {nextExam ? (
        <Card className="overflow-hidden">
          <div className="gradient-brand p-5 text-white">
            <p className="text-xs uppercase tracking-wide text-white/75">Next up</p>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">{nextExam.title}</h3>
                <p className="mt-1 text-sm text-white/85">
                  {nextExam.subject?.name} · {formatDate(nextExam.date, { weekday: 'long' })}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
                    <Clock size={13} /> {nextExam.startTime} · {nextExam.durationMinutes} min
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
                    <MapPin size={13} /> {nextExam.room || 'Room TBA'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
                    {nextExam.totalMarks} marks · pass {nextExam.passingMarks}
                  </span>
                </div>
              </div>
              <div className="rounded-2xl bg-white/15 px-6 py-4 text-center backdrop-blur">
                <p className="text-3xl font-bold">{nextExam.daysLeft}</p>
                <p className="text-xs text-white/80">days left</p>
              </div>
            </div>
          </div>
          {nextExam.syllabus?.length || nextExam.instructions ? (
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {nextExam.syllabus?.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Syllabus</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-ink-600">
                    {nextExam.syllabus.map((unit) => (
                      <li key={unit} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                        {unit}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {nextExam.instructions ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Instructions</p>
                  <p className="mt-2 text-sm text-ink-600">{nextExam.instructions}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
          { value: 'past', label: 'Completed', count: past.length },
          { value: 'all', label: 'All exams', count: exams.length },
        ]}
      />

      {filtered.length ? (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Exam</th>
                <th>Subject</th>
                <th>Type</th>
                <th>Date & time</th>
                <th>Room</th>
                <th>Marks</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((exam) => (
                <tr key={exam._id}>
                  <td className="font-medium text-ink-800">{exam.title}</td>
                  <td>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: exam.subject?.color || '#6366f1' }} />
                      {exam.subject?.shortName || exam.subject?.name}
                    </span>
                  </td>
                  <td>{humanise(exam.type)}</td>
                  <td>
                    {formatDate(exam.date, { weekday: 'short' })} · {exam.startTime}
                    <span className="ml-2 text-xs text-ink-400">{exam.durationMinutes} min</span>
                  </td>
                  <td>{exam.room || '—'}</td>
                  <td>
                    {exam.totalMarks} <span className="text-xs text-ink-400">(pass {exam.passingMarks})</span>
                  </td>
                  <td>
                    <Badge
                      tone={
                        exam.status === 'completed' ? 'success' : exam.status === 'cancelled' ? 'danger' : exam.daysLeft <= 2 ? 'warning' : 'brand'
                      }
                      dot
                    >
                      {exam.status === 'scheduled' && exam.daysLeft >= 0 ? `in ${exam.daysLeft}d` : humanise(exam.status)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Card>
          <EmptyState icon={CalendarClock} title="No exams to show" message="Exam dates published by your teachers will appear here." />
        </Card>
      )}

      {timeline?.days?.length ? (
        <Card>
          <CardHeader title="Exam timetable" subtitle={`Day-wise schedule for ${timeline.className}`} icon={CalendarDays} />
          <div className="space-y-4 p-5">
            {timeline.days.map((day) => (
              <div key={day.date} className="rounded-xl border border-ink-100 p-4">
                <p className="text-sm font-semibold text-ink-800">{formatDate(day.date, { weekday: 'long' })}</p>
                <div className="mt-3 space-y-2">
                  {day.exams.map((exam) => (
                    <div key={exam._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ink-50 px-3 py-2 text-sm">
                      <span className="font-medium text-ink-700">{exam.title}</span>
                      <span className="text-xs text-ink-500">
                        {exam.startTime} · {exam.room || 'TBA'} · {exam.subject?.shortName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

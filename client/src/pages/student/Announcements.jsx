import { useEffect, useMemo, useState } from 'react';
import { Calendar, Megaphone, Pin, Search } from 'lucide-react';
import { announcementApi } from '../../api/endpoints';
import { Alert, Badge, Card, EmptyState, PageLoader, SectionTitle } from '../../components/ui';
import { formatDate } from '../../utils/format';

const categoryTone = {
  general: 'neutral',
  academic: 'brand',
  exam: 'info',
  event: 'success',
  holiday: 'success',
  urgent: 'danger',
};

export default function StudentAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    announcementApi
      .list()
      .then((result) => setAnnouncements(result.data || []))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = announcements;
    if (category !== 'all') list = list.filter((item) => item.category === category);
    if (search) {
      const needle = search.toLowerCase();
      list = list.filter((item) => `${item.title} ${item.content}`.toLowerCase().includes(needle));
    }
    return list;
  }, [announcements, category, search]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <SectionTitle title="Announcements" subtitle="Notices, exam updates and events from your teachers" />

      {error ? <Alert tone="danger" title="Could not load announcements">{error}</Alert> : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-3 text-ink-400" />
          <input className="input w-64 pl-9" placeholder="Search announcements…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <select className="input w-44" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">All categories</option>
          <option value="academic">Academic</option>
          <option value="exam">Exam</option>
          <option value="event">Event</option>
          <option value="holiday">Holiday</option>
          <option value="urgent">Urgent</option>
          <option value="general">General</option>
        </select>
      </div>

      {filtered.length ? (
        <div className="space-y-4">
          {filtered.map((item) => (
            <Card key={item._id} className={item.pinned ? 'border-brand-200 bg-brand-50/40' : ''}>
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.pinned ? (
                        <Badge tone="brand">
                          <Pin size={12} /> Pinned
                        </Badge>
                      ) : null}
                      <Badge tone={categoryTone[item.category] || 'neutral'}>{item.category}</Badge>
                      {item.priority === 'urgent' ? <Badge tone="danger">Urgent</Badge> : null}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-ink-900">{item.title}</h3>
                  </div>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-ink-500">
                    <Calendar size={13} /> {formatDate(item.publishAt)}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-700">{item.content}</p>
                <p className="mt-3 text-xs text-ink-500">— {item.authorName || 'Administration'}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={Megaphone} title="No announcements" message="Notices published by your teachers will appear here." />
        </Card>
      )}
    </div>
  );
}

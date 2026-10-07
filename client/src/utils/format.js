export const cn = (...classes) => classes.filter(Boolean).join(' ');

export const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const pct = (value, digits = 1) => `${num(value).toFixed(digits)}%`;

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

export const formatDate = (value, options = {}) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', ...options });
};

export const formatDateShort = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';

export const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return `${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · ${date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

export const relativeTime = (value) => {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 1) return 'just now';
  if (Math.abs(minutes) < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return `${days}d ago`;
  return formatDate(value);
};

export const daysLeftLabel = (days) => {
  if (days === null || days === undefined) return '—';
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `${days} days left`;
};

export const gradeColor = (grade) => {
  switch (grade) {
    case 'O':
      return 'bg-emerald-100 text-emerald-700';
    case 'A+':
      return 'bg-green-100 text-green-700';
    case 'A':
      return 'bg-lime-100 text-lime-700';
    case 'B+':
      return 'bg-amber-100 text-amber-700';
    case 'B':
      return 'bg-orange-100 text-orange-700';
    case 'C':
      return 'bg-rose-100 text-rose-700';
    case 'P':
      return 'bg-sky-100 text-sky-700';
    case 'F':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-ink-100 text-ink-600';
  }
};

export const percentageColor = (value) => {
  if (value >= 85) return 'text-emerald-600';
  if (value >= 75) return 'text-green-600';
  if (value >= 60) return 'text-amber-600';
  if (value >= 40) return 'text-orange-600';
  return 'text-red-600';
};

export const percentageBg = (value) => {
  if (value >= 85) return 'bg-emerald-500';
  if (value >= 75) return 'bg-green-500';
  if (value >= 60) return 'bg-amber-500';
  if (value >= 40) return 'bg-orange-500';
  return 'bg-red-500';
};

export const riskBadge = (risk) => {
  switch (risk) {
    case 'critical':
      return 'bg-red-100 text-red-700';
    case 'high':
      return 'bg-orange-100 text-orange-700';
    case 'moderate':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-ink-100 text-ink-600';
  }
};

export const humanise = (value = '') =>
  String(value)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

export const compactNumber = (value) => {
  const parsed = num(value);
  if (Math.abs(parsed) >= 1000000) return `${(parsed / 1000000).toFixed(1)}M`;
  if (Math.abs(parsed) >= 1000) return `${(parsed / 1000).toFixed(1)}K`;
  return String(parsed);
};

export const toDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
};

export const CHART_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];

export const gradeFromPercentage = (value) => {
  const p = num(value);
  if (p >= 90) return 'O';
  if (p >= 80) return 'A+';
  if (p >= 70) return 'A';
  if (p >= 60) return 'B+';
  if (p >= 50) return 'B';
  if (p >= 45) return 'C';
  if (p >= 40) return 'P';
  return 'F';
};

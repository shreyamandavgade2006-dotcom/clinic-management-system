import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS } from '../../utils/format';
import { EmptyState } from '../ui';

const axisProps = {
  stroke: '#94a3b8',
  fontSize: 12,
  tickLine: false,
  axisLine: false,
};

const tooltipStyle = {
  contentStyle: {
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    boxShadow: '0 12px 32px -12px rgba(15,23,42,0.24)',
    fontSize: 12,
  },
};

export const AttendanceTrendChart = ({ data = [], height = 260 }) => {
  if (!data.length) return <EmptyState title="No attendance history yet" message="Attendance trends appear once sessions are marked." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="month" {...axisProps} />
        <YAxis domain={[0, 100]} {...axisProps} unit="%" />
        <Tooltip {...tooltipStyle} formatter={(value) => [`${value}%`, 'Attendance']} />
        <Area type="monotone" dataKey="percentage" stroke="#4f46e5" strokeWidth={2.5} fill="url(#attendanceFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export const SubjectBarChart = ({ data = [], dataKey = 'percentage', height = 280, color = '#6366f1', unit = '%' }) => {
  if (!data.length) return <EmptyState title="No data yet" message="Subject-wise data will appear here." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="shortName" {...axisProps} />
        <YAxis domain={[0, 100]} {...axisProps} unit={unit} />
        <Tooltip {...tooltipStyle} formatter={(value) => [`${value}${unit}`, 'Score']} />
        <Bar dataKey={dataKey} radius={[8, 8, 0, 0]} maxBarSize={48}>
          {data.map((entry, index) => (
            <Cell key={entry.subjectId || entry.shortName || index} fill={entry.color || color || CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export const PerformanceTrendChart = ({ data = [], height = 260 }) => {
  if (!data.length) return <EmptyState title="No marks published yet" message="Your performance trend appears after the first exam." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="month" {...axisProps} />
        <YAxis domain={[0, 100]} {...axisProps} unit="%" />
        <Tooltip {...tooltipStyle} formatter={(value) => [`${value}%`, 'Score']} />
        <Line type="monotone" dataKey="percentage" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 3, fill: '#0ea5e9' }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export const GradeDistributionChart = ({ data = [], height = 260 }) => {
  const filtered = data.filter((entry) => entry.count > 0);
  if (!filtered.length) return <EmptyState title="No results yet" message="Grade distribution appears after exams are graded." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip {...tooltipStyle} formatter={(value, name, payload) => [`${value} students`, payload?.payload?.range]} />
        <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={56} fill="#8b5cf6" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export const DonutChart = ({ data = [], height = 240, innerRadius = 58, outerRadius = 88, centerLabel, centerValue }) => {
  const filtered = data.filter((entry) => Number(entry.value) > 0);
  if (!filtered.length) return <EmptyState title="Nothing to show yet" />;
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={filtered} dataKey="value" nameKey="name" innerRadius={innerRadius} outerRadius={outerRadius} paddingAngle={3}>
            {filtered.map((entry, index) => (
              <Cell key={entry.name} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip {...tooltipStyle} />
          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      {centerValue !== undefined ? (
        <div className="pointer-events-none absolute inset-x-0 top-[38%] -translate-y-1/2 text-center">
          <p className="text-2xl font-bold text-ink-900">{centerValue}</p>
          {centerLabel ? <p className="text-xs text-ink-500">{centerLabel}</p> : null}
        </div>
      ) : null}
    </div>
  );
};

export const TopicRadarChart = ({ data = [], height = 280 }) => {
  if (!data.length) return <EmptyState title="No topic data yet" message="Attempt a quiz to see your topic strengths." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="topic" tick={{ fontSize: 11, fill: '#64748b' }} />
        <Radar name="Score" dataKey="percentage" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} />
        <Tooltip {...tooltipStyle} formatter={(value) => [`${value}%`, 'Accuracy']} />
      </RadarChart>
    </ResponsiveContainer>
  );
};

export const ComparisionBarChart = ({ data = [], bars = [], height = 300, xKey = 'shortName' }) => {
  if (!data.length) return <EmptyState title="No analytics yet" message="Analytics appear once marks are entered." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis domain={[0, 100]} {...axisProps} unit="%" />
        <Tooltip {...tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        {bars.map((bar, index) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            name={bar.name}
            fill={bar.color || CHART_COLORS[index % CHART_COLORS.length]}
            radius={[6, 6, 0, 0]}
            maxBarSize={30}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

export { CHART_COLORS };

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Brain,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { authApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { Badge, Button } from '../components/ui';

const features = [
  {
    icon: ClipboardCheck,
    title: 'Attendance Management',
    text: 'Mark attendance in seconds, track subject-wise percentages and instantly spot students below the 75% threshold.',
  },
  {
    icon: TrendingUp,
    title: 'Marks & Performance',
    text: 'Unit tests, in-semester and practical marks with automatic grades, CGPA, results and strong/weak subject analysis.',
  },
  {
    icon: Brain,
    title: 'AI Question Generator',
    text: 'Teachers pick subject, unit, topic, difficulty and marks — the AI writes the quiz, assessment or full question paper.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp Attendance Alerts',
    text: 'Guardians automatically receive a WhatsApp message the moment attendance drops below the required percentage.',
  },
  {
    icon: CalendarClock,
    title: 'Assignments & Exams',
    text: 'Deadlines, submissions, grading, exam schedules and reminders — all in one timeline for every class.',
  },
  {
    icon: BarChart3,
    title: 'Dashboards & Analytics',
    text: 'Beautiful charts for attendance trends, grade distribution, class averages, toppers and students needing help.',
  },
];

export default function Landing() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);

  useEffect(() => {
    authApi.config().then((result) => setConfig(result.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (isAuthenticated) navigate(user?.role === 'teacher' ? '/teacher' : '/student', { replace: true });
  }, [isAuthenticated, user, navigate]);

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-20 border-b border-ink-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl gradient-brand text-lg text-white shadow-sm">🎓</span>
            <div className="leading-tight">
              <p className="text-sm font-bold text-ink-900">Smart Student</p>
              <p className="text-xs text-ink-500">Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-secondary btn-sm sm:btn">
              Sign in
            </Link>
            <Link to="/register" className="btn-primary btn-sm sm:btn">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-mesh opacity-70" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 lg:pb-24 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <Badge tone="brand" className="mb-5">
                <Sparkles size={13} /> AI powered assessments
              </Badge>
              <h1 className="text-balance text-4xl font-extrabold leading-tight text-ink-900 sm:text-5xl lg:text-[3.4rem]">
                One platform for <span className="bg-gradient-to-r from-brand-600 to-sky-500 bg-clip-text text-transparent">teachers</span> and{' '}
                <span className="bg-gradient-to-r from-sky-500 to-emerald-500 bg-clip-text text-transparent">students</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-ink-600">
                Attendance, marks, assignments, exams, notifications and AI generated question papers — everything a modern classroom
                needs, with automatic WhatsApp alerts for parents when attendance slips below 75%.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/login" className="btn-primary px-6 py-3 text-base">
                  Open the dashboard <ArrowRight size={18} />
                </Link>
                <Link to="/register" className="btn-secondary px-6 py-3 text-base">
                  Create an account
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-ink-600">
                {['Role based access (JWT)', '75% attendance automation', 'Gemini / OpenAI supported', 'MongoDB + Express + React'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-success-500" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* demo credentials card */}
            <div className="card overflow-hidden lg:justify-self-end">
              <div className="gradient-brand px-5 py-4 text-white">
                <p className="text-sm font-semibold uppercase tracking-wide opacity-90">Live demo accounts</p>
                <p className="text-xs opacity-80">Seed data is loaded automatically on first run</p>
              </div>
              <div className="space-y-4 p-5">
                {(config?.demoAccounts || []).slice(0, 3).map((account) => (
                  <div key={account.email} className="flex items-center justify-between gap-3 rounded-xl border border-ink-200/70 p-3">
                    <div className="min-w-0">
                      <Badge tone={account.role === 'teacher' ? 'brand' : 'success'}>{account.role}</Badge>
                      <p className="mt-2 truncate text-sm font-semibold text-ink-800">{account.email}</p>
                      <p className="text-xs text-ink-500">password: {account.password}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        navigate('/login', { state: { email: account.email, password: account.password, role: account.role } })
                      }
                    >
                      Use
                    </Button>
                  </div>
                ))}
                {!config ? <p className="text-sm text-ink-500">Loading demo accounts…</p> : null}

                <div className="grid gap-2 rounded-xl bg-ink-50 p-3 text-xs text-ink-600">
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck size={14} className="text-brand-500" /> {config?.database?.mode === 'memory' ? 'In-memory demo store' : 'MongoDB connected'}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Brain size={14} className="text-brand-500" /> AI provider: {config?.ai?.active || 'local'}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <MessageCircle size={14} className="text-emerald-500" /> WhatsApp: {config?.whatsapp?.provider || 'console'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="mb-10 text-center">
          <Badge tone="brand" className="mb-3">
            Everything included
          </Badge>
          <h2 className="text-3xl font-bold text-ink-900">Built for real classroom workflows</h2>
          <p className="mx-auto mt-3 max-w-2xl text-ink-600">
            Six complete modules working together, from the first lecture of the semester to the final result sheet.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="card card-pad transition hover:-translate-y-0.5 hover:shadow-pop">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                <feature.icon size={20} />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-ink-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="card grid gap-6 p-6 sm:grid-cols-3 sm:p-8">
          {[
            { icon: Users, label: 'Students managed', value: `${config ? 12 : '—'}+`, hint: 'Per class, extensible to any department' },
            { icon: BellRing, label: 'Alerts automated', value: '24×7', hint: 'Below-threshold WhatsApp notifications' },
            { icon: Brain, label: 'AI papers', value: 'Unlimited', hint: 'Quiz, assessment and question-paper modes' },
          ].map((stat) => (
            <div key={stat.label} className="flex items-start gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                <stat.icon size={22} />
              </span>
              <div>
                <p className="text-2xl font-bold text-ink-900">{stat.value}</p>
                <p className="text-sm font-medium text-ink-700">{stat.label}</p>
                <p className="text-xs text-ink-500">{stat.hint}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-ink-200/70 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-ink-500 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} Smart Student Management System · MERN + AI + WhatsApp</p>
          <div className="flex gap-4">
            <Link to="/login" className="hover:text-brand-600">
              Sign in
            </Link>
            <Link to="/register" className="hover:text-brand-600">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

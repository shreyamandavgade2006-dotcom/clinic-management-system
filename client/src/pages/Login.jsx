import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Brain, GraduationCap, Lock, Mail, MessageCircle, ShieldCheck, Sparkles, UserCog } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/endpoints';
import { Alert, Badge, Button, Input } from '../components/ui';
import { cn } from '../utils/format';

export default function Login() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [role, setRole] = useState(location.state?.role || 'student');
  const [form, setForm] = useState({ email: location.state?.email || '', password: location.state?.password || '' });
  const [error, setError] = useState(location.search.includes('expired') ? 'Your session expired. Please sign in again.' : '');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    authApi.config().then((result) => setConfig(result.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (isAuthenticated) navigate(user?.role === 'teacher' ? '/teacher' : '/student', { replace: true });
  }, [isAuthenticated, user, navigate]);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const session = await login({ ...form, role });
      const destination = session?.user?.role === 'teacher' ? '/teacher' : '/student';
      navigate(location.state?.from || destination, { replace: true });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (account) => {
    setRole(account.role);
    setForm({ email: account.email, password: account.password });
    setError('');
  };

  const demoAccounts = config?.demoAccounts || [];

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* left: brand panel */}
      <div className="relative hidden overflow-hidden gradient-brand p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 gradient-mesh opacity-40" />
        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 text-xl backdrop-blur">
              <GraduationCap size={22} />
            </span>
            <div className="leading-tight">
              <p className="font-bold">Smart Student</p>
              <p className="text-xs text-white/70">Management System</p>
            </div>
          </Link>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight">Teach smarter. Learn better.</h1>
          <p className="mt-4 text-white/80">
            Attendance, marks, assignments, exams and AI generated question papers — plus automatic WhatsApp alerts to guardians when
            attendance drops below 75%.
          </p>

          <div className="mt-8 space-y-4 text-sm">
            {[
              { icon: Brain, text: 'AI question & assessment generator for every unit and topic' },
              { icon: MessageCircle, text: 'WhatsApp attendance alerts to parents and guardians' },
              { icon: ShieldCheck, text: 'Secure JWT authentication with teacher and student roles' },
            ].map((item) => (
              <div key={item.text} className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 backdrop-blur">
                  <item.icon size={17} />
                </span>
                <p className="pt-1.5 text-white/85">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/60">React · Node.js · Express · MongoDB · Gemini / OpenAI · Twilio</p>
      </div>

      {/* right: form */}
      <div className="flex items-center justify-center bg-ink-50 px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <Link to="/" className="inline-flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl gradient-brand text-xl text-white">🎓</span>
              <div className="leading-tight">
                <p className="font-bold text-ink-900">Smart Student</p>
                <p className="text-xs text-ink-500">Management System</p>
              </div>
            </Link>
          </div>

          <div className="card card-pad">
            <h2 className="text-2xl font-bold text-ink-900">Welcome back</h2>
            <p className="mt-1 text-sm text-ink-500">Sign in to your student or teacher dashboard.</p>

            {/* role switch */}
            <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-ink-100/70 p-1">
              {[
                { value: 'student', label: 'Student', icon: GraduationCap },
                { value: 'teacher', label: 'Teacher', icon: UserCog },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRole(option.value)}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition',
                    role === option.value ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-600 hover:text-ink-900'
                  )}
                >
                  <option.icon size={16} />
                  {option.label}
                </button>
              ))}
            </div>

            {error ? (
              <Alert tone="danger" className="mt-4" onClose={() => setError('')}>
                {error}
              </Alert>
            ) : null}

            <form onSubmit={submit} className="mt-5 space-y-4">
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3.5 top-[42px] text-ink-400" />
                <Input
                  label="Email address"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@ssms.edu"
                  className="[&>input]:pl-10"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </div>

              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3.5 top-[42px] text-ink-400" />
                <Input
                  label="Password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="[&>input]:pl-10"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
              </div>

              <Button type="submit" loading={loading} className="w-full py-3 text-base">
                Sign in as {role} <ArrowRight size={17} />
              </Button>
            </form>

            {demoAccounts.length ? (
              <div className="mt-6 rounded-xl border border-dashed border-brand-200 bg-brand-50/60 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-700">
                  <Sparkles size={13} /> Demo accounts — one click
                </p>
                <div className="mt-3 space-y-2">
                  {demoAccounts.slice(0, 3).map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      onClick={() => quickFill(account)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-left text-xs shadow-sm transition hover:shadow"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink-800">{account.email}</span>
                        <span className="text-ink-500">{account.password}</span>
                      </span>
                      <Badge tone={account.role === 'teacher' ? 'brand' : 'success'}>{account.role}</Badge>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="mt-5 text-center text-sm text-ink-500">
              New here?{' '}
              <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">
                Create an account
              </Link>
            </p>
          </div>

          {config?.database?.mode === 'memory' ? (
            <Alert tone="warning" className="mt-4" title="Demo mode">
              MongoDB is not reachable, so the API is running with the built-in in-memory store. Everything works, but data resets when the
              server restarts.
            </Alert>
          ) : null}
        </div>
      </div>
    </div>
  );
}

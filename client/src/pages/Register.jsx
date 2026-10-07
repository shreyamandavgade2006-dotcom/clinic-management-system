import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, GraduationCap, KeyRound, UserCog } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Alert, Button, Input, Select } from '../components/ui';
import { cn } from '../utils/format';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('student');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    inviteCode: '',
    className: 'TE-A',
    rollNo: '',
    employeeId: '',
    department: 'Computer Engineering',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const session = await register({ ...form, role });
      navigate(session?.user?.role === 'teacher' ? '/teacher' : '/student', { replace: true });
    } catch (registerError) {
      setError(registerError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-xl">
        <Link to="/" className="mb-6 inline-flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl gradient-brand text-xl text-white">🎓</span>
          <div className="leading-tight">
            <p className="font-bold text-ink-900">Smart Student</p>
            <p className="text-xs text-ink-500">Management System</p>
          </div>
        </Link>

        <div className="card card-pad">
          <h2 className="text-2xl font-bold text-ink-900">Create your account</h2>
          <p className="mt-1 text-sm text-ink-500">
            Students need the class code shared by their teacher. Teachers need the faculty invite code.
          </p>

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

          <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
            <Input label="Full name" required className="sm:col-span-2" value={form.name} onChange={update('name')} placeholder="Aarav Patil" />
            <Input label="Email" type="email" required value={form.email} onChange={update('email')} placeholder="you@ssms.edu" />
            <Input
              label="Password"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={update('password')}
              placeholder="min. 6 characters"
            />

            <div className="sm:col-span-2">
              <div className="relative">
                <KeyRound size={16} className="pointer-events-none absolute left-3.5 top-[42px] text-ink-400" />
                <Input
                  label={role === 'teacher' ? 'Faculty invite code' : 'Class code'}
                  required
                  className="[&>input]:pl-10"
                  value={form.inviteCode}
                  onChange={update('inviteCode')}
                  placeholder={role === 'teacher' ? 'provided by your institution' : 'shared by your teacher'}
                  help={role === 'teacher' ? 'Demo code: TEACH2024' : 'Demo code: CLASS2024'}
                />
              </div>
            </div>

            {role === 'student' ? (
              <>
                <Input label="Class" value={form.className} onChange={update('className')} placeholder="TE-A" />
                <Input label="Roll number" value={form.rollNo} onChange={update('rollNo')} placeholder="auto-generated if blank" />
              </>
            ) : (
              <Input label="Employee ID" className="sm:col-span-2" value={form.employeeId} onChange={update('employeeId')} placeholder="FAC-004 (auto if blank)" />
            )}

            <Select label="Department" value={form.department} onChange={update('department')} className="sm:col-span-2"
              options={['Computer Engineering', 'Information Technology', 'Electronics', 'Mechanical', 'Civil']} />

            <Button type="submit" loading={loading} className="sm:col-span-2 w-full py-3 text-base">
              Create {role} account <ArrowRight size={17} />
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-ink-500">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

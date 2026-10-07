import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  BookOpen,
  Briefcase,
  Building2,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import { authApi, teacherApi } from '../../api/endpoints';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  PageLoader,
  SectionTitle,
  StatCard,
  Tabs,
  Textarea,
  toast,
} from '../../components/ui';
import { formatDate } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';

export default function TeacherProfile() {
  const { refresh } = useAuth();
  const [profile, setProfile] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    designation: '',
    department: '',
    qualification: '',
    experienceYears: '',
    cabin: '',
    about: '',
  });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    teacherApi
      .me()
      .then((result) => {
        const teacher = result.data.teacher;
        setProfile(teacher);
        setSubjects(result.data.subjects || []);
        setForm({
          name: teacher.user?.name || '',
          phone: teacher.user?.phone || teacher.phone || '',
          designation: teacher.designation || '',
          department: teacher.department || '',
          qualification: teacher.qualification || '',
          experienceYears: teacher.experienceYears ?? '',
          cabin: teacher.cabin || '',
          about: teacher.about || '',
        });
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const result = await teacherApi.updateMe({ ...form, experienceYears: form.experienceYears === '' ? undefined : Number(form.experienceYears) });
      setProfile(result.data);
      await refresh?.();
      toast('Profile updated', 'success');
    } catch (saveError) {
      toast(saveError.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (passwords.newPassword !== passwords.confirm) {
      toast('New passwords do not match', 'error');
      return;
    }
    setChanging(true);
    try {
      await authApi.changePassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      toast('Password changed successfully', 'success');
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (passwordError) {
      toast(passwordError.message, 'error');
    } finally {
      setChanging(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error) return <Alert tone="danger" title="Could not load your profile">{error}</Alert>;
  if (!profile) return null;

  const classes = profile.classes || [];

  return (
    <div className="space-y-6">
      <SectionTitle title="My Profile" subtitle="Faculty details, subjects taught and account security" />

      <Card>
        <div className="flex flex-wrap items-start gap-5 p-6">
          <Avatar name={profile.user?.name || 'Teacher'} size={76} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-ink-900">{profile.user?.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
              <span className="flex items-center gap-1.5">
                <Mail size={14} /> {profile.user?.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Phone size={14} /> {profile.user?.phone || profile.phone || 'No phone'}
              </span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="brand">{profile.employeeId}</Badge>
              <Badge tone="info">{profile.designation}</Badge>
              <Badge tone="neutral">{profile.department}</Badge>
              {classes.map((item) => (
                <Badge key={item} tone="success">
                  Class {item}
                </Badge>
              ))}
            </div>
          </div>
          <div className="text-right text-xs text-ink-500">
            <p>Last login</p>
            <p className="font-semibold text-ink-700">{formatDate(profile.user?.lastLoginAt)}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Subjects" value={subjects.length} hint="Assigned to you" icon={BookOpen} tone="brand" />
        <StatCard label="Classes" value={classes.length} hint={classes.join(', ') || 'None yet'} icon={Users} tone="info" />
        <StatCard label="Experience" value={profile.experienceYears ? `${profile.experienceYears} yrs` : '—'} hint={profile.qualification || 'Qualification not added'} icon={Briefcase} tone="purple" />
        <StatCard label="Employee ID" value={profile.employeeId} hint={profile.cabin ? `Cabin ${profile.cabin}` : 'Cabin not set'} icon={BadgeCheck} tone="success" />
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'profile', label: 'Edit profile', icon: BadgeCheck },
          { value: 'subjects', label: 'My subjects', icon: BookOpen, count: subjects.length },
          { value: 'security', label: 'Security', icon: Shield },
        ]}
      />

      {tab === 'profile' ? (
        <Card>
          <CardHeader title="Faculty details" subtitle="Visible to students on assignment cards and announcements" icon={Briefcase} />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Input label="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <Input label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            <Input label="Designation" value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} />
            <Input label="Department" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} />
            <Input label="Qualification" value={form.qualification} onChange={(event) => setForm({ ...form, qualification: event.target.value })} placeholder="M.Tech, Ph.D" />
            <Input label="Experience (years)" type="number" value={form.experienceYears} onChange={(event) => setForm({ ...form, experienceYears: event.target.value })} />
            <Input label="Cabin / office" value={form.cabin} onChange={(event) => setForm({ ...form, cabin: event.target.value })} placeholder="Block A · 210" />
            <div className="sm:col-span-2">
              <Textarea label="About" rows={4} value={form.about} onChange={(event) => setForm({ ...form, about: event.target.value })} placeholder="Research interests, office hours, teaching philosophy…" />
            </div>
          </div>
          <div className="flex justify-end border-t border-ink-100 p-4">
            <Button icon={Save} onClick={saveProfile} loading={saving}>
              Save changes
            </Button>
          </div>
        </Card>
      ) : null}

      {tab === 'subjects' ? (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {subjects.map((subject) => (
            <Card key={subject._id} className="p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white" style={{ background: subject.color || '#6366f1' }}>
                  <BookOpen size={20} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-ink-900">{subject.name}</h3>
                  <p className="text-xs text-ink-500">
                    {subject.code} · {subject.className} · Semester {subject.semester}
                  </p>
                  <p className="mt-2 text-xs text-ink-500">{subject.units?.length || 0} units mapped for the AI generator</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/teacher/subjects/${subject._id}`} className="btn-secondary btn-sm">
                  Manage syllabus
                </Link>
                <Link to={`/teacher/ai-generator?subject=${subject._id}`} className="btn-primary btn-sm">
                  <Sparkles size={13} /> Generate
                </Link>
              </div>
            </Card>
          ))}
          {!subjects.length ? (
            <Card className="p-6 lg:col-span-2 xl:col-span-3">
              <p className="text-sm text-ink-500">No subjects are assigned to you yet. Create one from the Subjects page to start teaching.</p>
              <Link to="/teacher/subjects" className="btn-primary btn-sm mt-4 w-fit">
                Go to subjects
              </Link>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === 'security' ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader title="Change password" subtitle="Use a strong password with letters, numbers and symbols" icon={KeyRound} />
            <div className="space-y-4 p-5">
              <Input
                label="Current password"
                type="password"
                value={passwords.currentPassword}
                onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })}
              />
              <Input
                label="New password"
                type="password"
                value={passwords.newPassword}
                onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })}
                help="Minimum 6 characters"
              />
              <Input label="Confirm new password" type="password" value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} />
              <Button icon={Shield} onClick={changePassword} loading={changing} disabled={!passwords.currentPassword || !passwords.newPassword}>
                Update password
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Account & access" subtitle="Role based access control is enforced by the API" icon={Building2} />
            <div className="space-y-3 p-5 text-sm">
              {[
                ['Role', 'Teacher'],
                ['Account status', profile.user?.isActive === false ? 'Disabled' : 'Active'],
                ['Employee ID', profile.employeeId],
                ['Department', profile.department],
                ['Classes', classes.join(', ') || 'None assigned'],
                ['Cabin', profile.cabin || 'Not set'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-2">
                  <span className="text-xs uppercase tracking-wide text-ink-500">{label}</span>
                  <span className="font-semibold text-ink-800">{value}</span>
                </div>
              ))}
              <p className="flex items-start gap-2 rounded-xl bg-sky-50 px-4 py-3 text-xs text-sky-800">
                <MapPin size={14} className="mt-0.5 shrink-0" />
                Your account only sees students, marks and attendance for the classes you teach — students never get access to other students&apos; records.
              </p>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { BookOpen, IdCard, KeyRound, Mail, MapPin, Phone, Save, ShieldCheck, User } from 'lucide-react';
import { authApi, studentApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  PageLoader,
  ProgressBar,
  SectionTitle,
  Select,
  toast,
} from '../../components/ui';
import { formatDate, pct } from '../../utils/format';

export default function StudentProfile() {
  const { user, refresh } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    bloodGroup: '',
    gender: '',
    batch: '',
    guardianName: '',
    guardianRelation: '',
    guardianPhone: '',
    guardianEmail: '',
    whatsappOptIn: true,
  });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  useEffect(() => {
    studentApi
      .me()
      .then((result) => {
        const { student } = result.data;
        setData(result.data);
        setForm({
          name: user?.name || '',
          phone: user?.phone || '',
          address: student.address || '',
          dateOfBirth: student.dateOfBirth ? String(student.dateOfBirth).slice(0, 10) : '',
          bloodGroup: student.bloodGroup || '',
          gender: student.gender || '',
          batch: student.batch || '',
          guardianName: student.guardian?.name || '',
          guardianRelation: student.guardian?.relation || '',
          guardianPhone: student.guardian?.phone || '',
          guardianEmail: student.guardian?.email || '',
          whatsappOptIn: student.guardian?.whatsappOptIn !== false,
        });
      })
      .catch((requestError) => toast(requestError.message, 'error'))
      .finally(() => setLoading(false));
  }, [user]);

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const saveProfile = async () => {
    setSaving(true);
    try {
      await authApi.updateStudentProfile({
        name: form.name,
        phone: form.phone,
        address: form.address,
        dateOfBirth: form.dateOfBirth || undefined,
        bloodGroup: form.bloodGroup,
        gender: form.gender,
        batch: form.batch,
        guardian: {
          name: form.guardianName,
          relation: form.guardianRelation,
          phone: form.guardianPhone,
          email: form.guardianEmail,
          whatsappOptIn: form.whatsappOptIn,
        },
      });
      toast('Profile updated successfully', 'success');
      await refresh();
      const refreshed = await studentApi.me();
      setData(refreshed.data);
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
    setPasswordSaving(true);
    try {
      await authApi.changePassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      toast('Password changed successfully', 'success');
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (passwordError) {
      toast(passwordError.message, 'error');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  const student = data?.student;
  const attendance = data?.attendance;
  const performance = data?.performance;

  return (
    <div className="space-y-6">
      <SectionTitle title="My Profile" subtitle="Keep your contact details and guardian WhatsApp number up to date" />

      <Card>
        <div className="flex flex-wrap items-center gap-5 p-6">
          <Avatar name={user?.name || ''} size={76} />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-ink-900">{user?.name}</h2>
            <p className="mt-0.5 flex items-center gap-2 text-sm text-ink-500">
              <Mail size={14} /> {user?.email}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="brand">
                <IdCard size={13} /> {student?.rollNo}
              </Badge>
              <Badge tone="info">Class {student?.className}</Badge>
              <Badge tone="neutral">Semester {student?.semester}</Badge>
              <Badge tone="success">{student?.department}</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="rounded-xl bg-ink-50 px-5 py-3">
              <p className="text-xl font-bold text-ink-900">{pct(attendance?.overall?.percentage || 0)}</p>
              <p className="text-xs text-ink-500">Attendance</p>
            </div>
            <div className="rounded-xl bg-ink-50 px-5 py-3">
              <p className="text-xl font-bold text-ink-900">{performance?.cgpa || 0}</p>
              <p className="text-xs text-ink-500">CGPA</p>
            </div>
          </div>
        </div>
      </Card>

      {attendance?.overall?.belowThreshold ? (
        <Alert tone="warning" title="Attendance below threshold">
          Your attendance is {attendance.overall.percentage}%. Guardians receive automatic WhatsApp alerts when you fall below{" "}
          {attendance.overall.threshold}%.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Personal details" subtitle="Visible to your teachers" icon={User} />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Input label="Full name" value={form.name} onChange={update('name')} />
            <Input label="Phone" value={form.phone} onChange={update('phone')} placeholder="+91…" />
            <Input label="Date of birth" type="date" value={form.dateOfBirth} onChange={update('dateOfBirth')} />
            <Input label="Blood group" value={form.bloodGroup} onChange={update('bloodGroup')} />
            <Select
              label="Gender"
              value={form.gender}
              onChange={update('gender')}
              placeholder="Select"
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
              ]}
            />
            <Input label="Batch" value={form.batch} onChange={update('batch')} />
            <Input label="Address" className="sm:col-span-2" value={form.address} onChange={update('address')} />
            <Button onClick={saveProfile} loading={saving} icon={Save} className="sm:col-span-2">
              Save changes
            </Button>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Guardian & WhatsApp alerts"
              subtitle="Alerts are sent to this number when attendance drops below the threshold"
              icon={Phone}
            />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Input label="Guardian name" value={form.guardianName} onChange={update('guardianName')} />
              <Input label="Relation" value={form.guardianRelation} onChange={update('guardianRelation')} placeholder="Father / Mother" />
              <Input label="WhatsApp number" value={form.guardianPhone} onChange={update('guardianPhone')} placeholder="+919000000001" />
              <Input label="Guardian email" value={form.guardianEmail} onChange={update('guardianEmail')} />
              <label className="sm:col-span-2 flex cursor-pointer items-center gap-3 rounded-xl bg-ink-50 p-3">
                <input
                  type="checkbox"
                  checked={form.whatsappOptIn}
                  onChange={(event) => setForm({ ...form, whatsappOptIn: event.target.checked })}
                  className="h-4 w-4 rounded border-ink-300 text-brand-600"
                />
                <span className="text-sm text-ink-700">
                  Send WhatsApp attendance alerts to my guardian
                  <span className="block text-xs text-ink-500">Unchecking stops all automated alerts for your account.</span>
                </span>
              </label>
              <Button onClick={saveProfile} loading={saving} variant="whatsapp" icon={Save} className="sm:col-span-2">
                Save guardian details
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Academic summary" subtitle="Read-only information from the academic office" icon={BookOpen} />
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {[
                ['Admission number', student?.admissionNo || '—'],
                ['Roll number', student?.rollNo],
                ['Class & division', `${student?.className} / ${student?.division}`],
                ['Semester', student?.semester],
                ['Subjects enrolled', student?.subjects?.length || 0],
                ['Joined on', formatDate(student?.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-ink-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-ink-800">{value}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-ink-100 p-5">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-800">
                <MapPin size={15} className="text-brand-500" /> Enrolled subjects
              </p>
              <div className="flex flex-wrap gap-2">
                {(student?.subjects || []).map((subject) => (
                  <Badge key={subject._id || subject} tone="neutral">
                    {subject.shortName || subject.code || subject.name}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Security" subtitle="Change your password" icon={ShieldCheck} />
            <div className="grid gap-4 p-5">
              <Input
                label="Current password"
                type="password"
                value={passwords.currentPassword}
                onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="New password"
                  type="password"
                  value={passwords.newPassword}
                  onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })}
                />
                <Input
                  label="Confirm password"
                  type="password"
                  value={passwords.confirm}
                  onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
                />
              </div>
              <Button onClick={changePassword} loading={passwordSaving} icon={KeyRound} variant="secondary">
                Update password
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Attendance snapshot" subtitle="Subject-wise percentage" icon={BookOpen} />
        <div className="space-y-3 p-5">
          {(attendance?.subjectWise || []).map((subject) => (
            <div key={subject.subjectId}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-ink-700">{subject.name}</span>
                <span className="text-xs text-ink-500">
                  {subject.attended}/{subject.totalSessions} · {subject.percentage}%
                </span>
              </div>
              <ProgressBar value={subject.percentage} height="h-1.5" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Filter, Mail, Phone, Search, Trash2, Upload, UserPlus, Users } from 'lucide-react';
import { studentApi } from '../../api/endpoints';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageLoader,
  ProgressBar,
  SectionTitle,
  Select,
  StatCard,
  Textarea,
  toast,
} from '../../components/ui';
import { formatDate } from '../../utils/format';

const emptyForm = {
  name: '',
  email: '',
  password: 'Student@123',
  rollNo: '',
  className: 'TE-A',
  department: 'Computer Engineering',
  semester: 5,
  division: 'A',
  batch: '',
  gender: '',
  phone: '',
  bloodGroup: '',
  address: '',
  guardianName: '',
  guardianRelation: 'Father',
  guardianPhone: '',
  guardianEmail: '',
};

export default function TeacherStudents() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [students, setStudents] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [className, setClassName] = useState(searchParams.get('className') || '');
  const [belowAttendance, setBelowAttendance] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [bulkText, setBulkText] = useState('');
  const [classes, setClasses] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    studentApi
      .list({ search, className, belowAttendance: belowAttendance || undefined, limit: 200 })
      .then((result) => {
        setStudents(result.data || []);
        setMeta(result.meta || {});
        if (result.meta?.classes) setClasses(result.meta.classes);
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [search, className, belowAttendance]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const next = {};
    if (search) next.search = search;
    if (className) next.className = className;
    setSearchParams(next, { replace: true });
  }, [search, className, setSearchParams]);

  const createStudent = async () => {
    setSaving(true);
    try {
      await studentApi.create({
        ...form,
        semester: Number(form.semester),
        guardian: {
          name: form.guardianName,
          relation: form.guardianRelation,
          phone: form.guardianPhone,
          email: form.guardianEmail,
          whatsappOptIn: true,
        },
      });
      toast(`${form.name} added successfully with login credentials`, 'success');
      setCreateOpen(false);
      setForm(emptyForm);
      load();
    } catch (createError) {
      toast(createError.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const bulkImport = async () => {
    setSaving(true);
    try {
      const rows = bulkText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, email, rollNo, rowClass, guardianPhone] = line.split(',').map((value) => value?.trim());
          return { name, email, rollNo, className: rowClass || className || 'TE-A', guardian: { name: '', phone: guardianPhone || '' } };
        });

      const result = await studentApi.bulkImport(rows);
      toast(`Imported ${result.data.created} students (${result.data.skipped} skipped)`, 'success');
      setBulkOpen(false);
      setBulkText('');
      load();
    } catch (bulkError) {
      toast(bulkError.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeStudent = async (student) => {
    if (!window.confirm(`Remove ${student.user?.name}? All attendance, marks and submissions will be deleted.`)) return;
    try {
      await studentApi.remove(student._id);
      toast('Student removed', 'success');
      load();
    } catch (removeError) {
      toast(removeError.message, 'error');
    }
  };

  const exportCsv = () => {
    const header = 'Roll No,Name,Email,Class,Department,Semester,Attendance %,Performance %,Guardian,Guardian Phone';
    const rows = students.map((student) =>
      [
        student.rollNo,
        student.user?.name,
        student.user?.email,
        student.className,
        student.department,
        student.semester,
        student.attendancePercentage,
        student.performancePercentage,
        student.guardian?.name || '',
        student.guardian?.phone || '',
      ].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'students.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const defaulterCount = students.filter((student) => student.attendancePercentage < 75 && student.attendanceRecords > 0).length;
  const averageAttendance = students.length
    ? Math.round((students.reduce((sum, student) => sum + (student.attendancePercentage || 0), 0) / students.length) * 10) / 10
    : 0;

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Student Management"
        subtitle={`${meta.total || students.length} students · profiles, academic details and guardian contacts`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Upload} onClick={() => setBulkOpen(true)}>
              Bulk import
            </Button>
            <Button variant="secondary" icon={Download} onClick={exportCsv}>
              Export CSV
            </Button>
            <Button icon={UserPlus} onClick={() => setCreateOpen(true)}>
              Add student
            </Button>
          </div>
        }
      />

      {error ? <Alert tone="danger" title="Could not load students">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total students" value={students.length} icon={Users} tone="brand" />
        <StatCard label="Classes" value={classes.length} hint={classes.join(', ')} icon={Filter} tone="info" />
        <StatCard label="Average attendance" value={`${averageAttendance}%`} icon={Users} tone={averageAttendance >= 75 ? 'success' : 'warning'} trend={<ProgressBar value={averageAttendance} />} />
        <StatCard label="Below 75%" value={defaulterCount} hint="Attendance defaulters" icon={Filter} tone="danger" />
      </div>

      <Card className="card-pad">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Search size={15} className="pointer-events-none absolute left-3 top-3.5 text-ink-400" />
            <input
              className="input pl-9"
              placeholder="Search by name, roll number, email or guardian…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select className="input" value={className} onChange={(event) => setClassName(event.target.value)}>
            <option value="">All classes</option>
            {classes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="input" value={belowAttendance} onChange={(event) => setBelowAttendance(event.target.value)}>
            <option value="">Everyone</option>
            <option value="75">Below 75% attendance</option>
            <option value="60">Below 60% attendance</option>
            <option value="40">Below 40% attendance</option>
          </select>
        </div>
      </Card>

      {loading ? (
        <PageLoader />
      ) : students.length ? (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll No</th>
                <th>Class</th>
                <th>Attendance</th>
                <th>Performance</th>
                <th>Guardian</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const atRisk = student.attendanceRecords > 0 && student.attendancePercentage < 75;
                return (
                  <tr key={student._id}>
                    <td>
                      <Link to={`/teacher/students/${student._id}`} className="flex items-center gap-3 group">
                        <Avatar name={student.user?.name || student.rollNo} size={36} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-800 group-hover:text-brand-600">{student.user?.name}</p>
                          <p className="flex items-center gap-1 text-xs text-ink-500">
                            <Mail size={11} /> {student.user?.email}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="font-mono text-xs">{student.rollNo}</td>
                    <td>
                      <Badge tone="neutral">{student.className}</Badge>
                    </td>
                    <td className="w-44">
                      {student.attendanceRecords ? (
                        <>
                          <ProgressBar value={student.attendancePercentage} showLabel={false} />
                          <p className={`mt-1 text-xs font-semibold ${atRisk ? 'text-danger-600' : 'text-ink-500'}`}>
                            {student.attendancePercentage}% ({student.attendanceRecords} records)
                          </p>
                        </>
                      ) : (
                        <span className="text-xs text-ink-400">No records</span>
                      )}
                    </td>
                    <td className="w-44">
                      {student.marksRecords ? (
                        <>
                          <ProgressBar value={student.performancePercentage} showLabel={false} />
                          <p className="mt-1 text-xs text-ink-500">
                            {student.performancePercentage}% ({student.marksRecords} marks)
                          </p>
                        </>
                      ) : (
                        <span className="text-xs text-ink-400">No marks</span>
                      )}
                    </td>
                    <td>
                      <p className="text-sm text-ink-700">{student.guardian?.name || '—'}</p>
                      <p className="flex items-center gap-1 text-xs text-ink-500">
                        <Phone size={11} /> {student.guardian?.phone || 'No WhatsApp'}
                      </p>
                    </td>
                    <td>
                      {atRisk ? (
                        <Badge tone="danger" dot>
                          At risk
                        </Badge>
                      ) : (
                        <Badge tone="success" dot>
                          {student.status}
                        </Badge>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Link to={`/teacher/students/${student._id}`} className="btn-ghost btn-sm">
                          Open
                        </Link>
                        <button onClick={() => removeStudent(student)} className="btn-ghost btn-sm text-danger-600 hover:bg-danger-50">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={Users}
            title="No students found"
            message="Adjust the filters or add a new student to get started."
            action={
              <Button icon={UserPlus} onClick={() => setCreateOpen(true)}>
                Add student
              </Button>
            }
          />
        </Card>
      )}

      {/* create student */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add a new student"
        subtitle="A login is created automatically with the password you set here"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createStudent} loading={saving}>
              Create student
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <Input label="Email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <Input label="Roll number" required value={form.rollNo} onChange={(event) => setForm({ ...form, rollNo: event.target.value })} />
          <Input label="Login password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          <Input label="Class" value={form.className} onChange={(event) => setForm({ ...form, className: event.target.value })} />
          <Input label="Division" value={form.division} onChange={(event) => setForm({ ...form, division: event.target.value })} />
          <Select
            label="Department"
            value={form.department}
            onChange={(event) => setForm({ ...form, department: event.target.value })}
            options={['Computer Engineering', 'Information Technology', 'Electronics', 'Mechanical', 'Civil']}
          />
          <Input label="Semester" type="number" value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value })} />
          <Input label="Student phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          <Input label="Batch" value={form.batch} onChange={(event) => setForm({ ...form, batch: event.target.value })} />
          <Select
            label="Gender"
            value={form.gender}
            onChange={(event) => setForm({ ...form, gender: event.target.value })}
            placeholder="Select"
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'other', label: 'Other' },
            ]}
          />
          <Input label="Blood group" value={form.bloodGroup} onChange={(event) => setForm({ ...form, bloodGroup: event.target.value })} />

          <div className="sm:col-span-2">
            <Textarea label="Address" rows={2} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          </div>

          <div className="sm:col-span-2 rounded-xl bg-emerald-50/60 p-4">
            <p className="mb-3 text-sm font-semibold text-emerald-800">Guardian details (used for WhatsApp alerts)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Guardian name" value={form.guardianName} onChange={(event) => setForm({ ...form, guardianName: event.target.value })} />
              <Input label="Relation" value={form.guardianRelation} onChange={(event) => setForm({ ...form, guardianRelation: event.target.value })} />
              <Input
                label="WhatsApp number"
                value={form.guardianPhone}
                onChange={(event) => setForm({ ...form, guardianPhone: event.target.value })}
                placeholder="+919000000001"
                help="Include the country code"
              />
              <Input label="Guardian email" value={form.guardianEmail} onChange={(event) => setForm({ ...form, guardianEmail: event.target.value })} />
            </div>
          </div>
        </div>
      </Modal>

      {/* bulk import */}
      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Bulk import students"
        subtitle="One student per line: name, email, roll number, class, guardian WhatsApp"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={bulkImport} loading={saving}>
              Import students
            </Button>
          </>
        }
      >
        <Textarea
          rows={10}
          value={bulkText}
          onChange={(event) => setBulkText(event.target.value)}
          placeholder={`Riya Sharma, riya.sharma@ssms.edu, TE-A-013, TE-A, +919000000013\nArjun Verma, arjun.verma@ssms.edu, TE-A-014, TE-A, +919000000014`}
        />
        <p className="help">
          Default password for every imported student is <code>Student@123</code> (they can change it after signing in).
        </p>
      </Modal>
    </div>
  );
}

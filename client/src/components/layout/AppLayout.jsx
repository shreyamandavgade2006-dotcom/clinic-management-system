import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Award,
  BellRing,
  BookOpen,
  Brain,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  NotebookPen,
  PieChart,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { notificationApi } from '../../api/endpoints';
import { Avatar, Badge } from '../ui';
import { cn } from '../../utils/format';

export const STUDENT_NAV = [
  { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/student/attendance', label: 'Attendance', icon: ClipboardCheck },
  { to: '/student/marks', label: 'Marks & Results', icon: TrendingUp },
  { to: '/student/assignments', label: 'Assignments', icon: NotebookPen },
  { to: '/student/exams', label: 'Exams', icon: CalendarClock },
  { to: '/student/quizzes', label: 'AI Quizzes', icon: Brain, highlight: true },
  { to: '/student/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/student/notifications', label: 'Notifications', icon: BellRing },
  { to: '/student/profile', label: 'My Profile', icon: Settings },
];

export const TEACHER_NAV = [
  { to: '/teacher', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/teacher/students', label: 'Students', icon: Users },
  { to: '/teacher/subjects', label: 'Subjects', icon: BookOpen },
  { to: '/teacher/attendance', label: 'Attendance', icon: ClipboardCheck },
  { to: '/teacher/marks', label: 'Marks Entry', icon: FileSpreadsheet },
  { to: '/teacher/assignments', label: 'Assignments', icon: NotebookPen },
  { to: '/teacher/exams', label: 'Exams', icon: CalendarClock },
  { to: '/teacher/ai-generator', label: 'AI Question Generator', icon: Sparkles, highlight: true },
  { to: '/teacher/quizzes', label: 'Assessments', icon: ClipboardList },
  { to: '/teacher/analytics', label: 'Analytics', icon: PieChart },
  { to: '/teacher/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/teacher/whatsapp-alerts', label: 'WhatsApp Alerts', icon: MessageCircle, highlight: true },
  { to: '/teacher/notifications', label: 'Notifications', icon: BellRing },
  { to: '/teacher/profile', label: 'My Profile', icon: Settings },
];

export default function AppLayout() {
  const { user, student, teacher, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const nav = user?.role === 'teacher' ? TEACHER_NAV : STUDENT_NAV;

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let active = true;
    notificationApi
      .list({ limit: 1 })
      .then((result) => active && setUnread(result.meta.unread || 0))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [location.pathname]);

  const identity = useMemo(() => {
    if (user?.role === 'student') {
      return {
        name: user?.name || '',
        meta: `${student?.rollNo || ''} · ${student?.className || ''}`,
        badge: 'Student',
      };
    }
    return {
      name: user?.name || '',
      meta: `${teacher?.designation || 'Faculty'} · ${(teacher?.classes || []).join(', ') || teacher?.department || ''}`,
      badge: 'Teacher',
    };
  }, [user, student, teacher]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-ink-50">
      {/* sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-ink-200/70 bg-gradient-to-b from-brand-50 via-white to-white transition-transform duration-200 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0 shadow-pop' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl gradient-brand text-white shadow-sm">
              <GraduationCap size={20} />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold text-ink-900">Smart Student</p>
              <p className="text-xs text-ink-500">Management System</p>
            </div>
          </div>
          <button className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn('sidebar-link', isActive && 'sidebar-link-active')}
            >
              <item.icon size={17} className={item.highlight ? 'text-brand-500' : ''} />
              <span className="flex-1">{item.label}</span>
              {item.highlight ? <Sparkles size={13} className="text-brand-400" /> : null}
              {item.to.endsWith('/notifications') && unread > 0 ? (
                <span className="rounded-full bg-danger-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-ink-200/70 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white/80 p-3 shadow-sm">
            <Avatar name={identity.name} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-800">{identity.name}</p>
              <p className="truncate text-xs text-ink-500">{identity.meta}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-ghost mt-2 w-full justify-start text-danger-600 hover:bg-danger-50">
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-30 bg-ink-900/40 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      ) : null}

      {/* main */}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-ink-200/70 bg-white/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button className="rounded-xl border border-ink-200 p-2 text-ink-600 lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu size={18} />
            </button>

            <div className="hidden flex-1 items-center gap-2 rounded-xl border border-ink-200 bg-ink-50/70 px-3 py-2 sm:flex">
              <Search size={16} className="text-ink-400" />
              <input
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  const value = event.currentTarget.value.trim();
                  if (!value) return;
                  navigate(`/${user?.role === 'teacher' ? 'teacher/students' : 'student/exams'}?search=${encodeURIComponent(value)}`);
                }}
                placeholder={user?.role === 'teacher' ? 'Search students, roll numbers…' : 'Search exams, subjects…'}
                className="w-full bg-transparent text-sm text-ink-700 placeholder:text-ink-400 focus:outline-none"
              />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Badge tone={user?.role === 'teacher' ? 'brand' : 'success'} className="hidden sm:inline-flex">
                <Award size={13} />
                {identity.badge}
              </Badge>
              <button
                className="relative rounded-xl border border-ink-200 p-2 text-ink-600 transition hover:bg-ink-50"
                onClick={() => navigate(`/${user?.role}/notifications`)}
                title="Notifications"
              >
                <BellRing size={18} />
                {unread > 0 ? (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                ) : null}
              </button>
              <NavLink to={`/${user?.role}/profile`} className="hidden sm:block">
                <Avatar name={identity.name} size={36} />
              </NavLink>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export const ChartIcon = AreaChart;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { isDebug } from '../../config/env';
import { apiClient } from '../../services/apiClient';
import { projectService } from '../../services/projectService';
import { attendanceService } from '../../services/attendanceService';
import { taskService } from '../../services/taskService';
import { dsrService } from '../../services/dsrService';
import { formatDate } from '../../utils/formatters';
import { formatDuration } from '../../utils/dsr';
import StatusBadge from '../ui/StatusBadge';
import WorkerTaskModal from './WorkerTaskModal';
import {
  ArrowRightIcon,
  Building2Icon,
  CalendarCheckIcon,
  CalendarIcon,
  FileTextIcon,
  ListChecksIcon,
  LogInIcon,
  LogOutIcon,
  PlusIcon,
} from '../ui/icons';

const NO_TIME = new Set(['', '-', '—', null, undefined]);
const hasTime = (value) => !NO_TIME.has(value);

const isoDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};

/** Where a worker's punch comes from: the phone's location (or the office pin in the standalone mock mode). */
async function readLocation() {
  const fromBrowser = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('This device cannot share its location.'));
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
          }),
        () => reject(new Error('Could not get your location. Allow location access for this site and try again.')),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  try {
    return await fromBrowser();
  } catch (err) {
    if (!isDebug()) throw err;
    const office = await attendanceService.getOfficeLocation();
    return { lat: office.lat, lng: office.lng, accuracy: 10 };
  }
}

/** The stage a project is at: the one in progress, else the first not finished. */
function currentStageName(project) {
  const stages = [...(project.stages || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const stage =
    stages.find((s) => s.status === 'in progress') || stages.find((s) => s.status !== 'done' && s.status !== 'completed');
  return stage ? stage.name : null;
}

const SHIFT_MINUTES = 8 * 60; // the ring fills over an eight hour day

/** A circle that fills with the day's worked time. */
function TimeRing({ minutes, active }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.min(1, (minutes || 0) / SHIFT_MINUTES);
  return (
    <div className="relative size-28 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono text-lg font-bold leading-none tabular-nums">{minutes != null ? formatDuration(minutes) : '0m'}</span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-primary-foreground/70">
          {active ? 'working' : 'today'}
        </span>
      </div>
    </div>
  );
}

/** Punch in, working, punch out: where the day is right now. */
function DaySteps({ checkedIn, checkedOut, inTime, outTime }) {
  const steps = [
    { label: 'Punch in', note: checkedIn ? inTime : '—', done: checkedIn, current: !checkedIn },
    { label: 'Working', note: checkedIn && !checkedOut ? 'now' : checkedOut ? 'done' : '—', done: checkedOut, current: checkedIn && !checkedOut },
    { label: 'Punch out', note: checkedOut ? outTime : '—', done: checkedOut, current: false },
  ];
  return (
    <ol className="flex items-start">
      {steps.map((step, index) => (
        <li key={step.label} className="flex flex-1 items-start last:flex-none">
          <div className="flex flex-col items-center text-center">
            <span
              className={`flex size-6 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                step.done
                  ? 'border-white bg-white text-primary'
                  : step.current
                  ? 'animate-pulse border-white bg-transparent text-white'
                  : 'border-white/35 text-white/50'
              }`}
            >
              {step.done ? '✓' : index + 1}
            </span>
            <span className="mt-1.5 text-[11px] font-semibold">{step.label}</span>
            <span className="text-[10px] text-primary-foreground/70">{step.note}</span>
          </div>
          {index < steps.length - 1 && <span className={`mx-2 mt-3 h-0.5 flex-1 rounded ${step.done ? 'bg-white' : 'bg-white/25'}`} />}
        </li>
      ))}
    </ol>
  );
}

/** The last seven days as seven dots: filled when he punched in that day. */
function WeekStrip({ records }) {
  const byDate = new Map(records.map((r) => [r.date, r]));
  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = isoDay(i - 6);
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return { iso, letter: date.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 1), isToday: i === 6, record: byDate.get(iso), off: date.getDay() === 0 };
  });
  const present = days.filter((d) => d.record && hasTime(d.record.checkInTime)).length;
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-sm font-bold text-text-main">This week</h3>
        <p className="mt-0.5 text-xs text-text-muted">
          {present} {present === 1 ? 'day' : 'days'} punched in over the last 7 days
        </p>
      </div>
      <div className="flex items-center gap-3">
        {days.map((day) => {
          const here = day.record && hasTime(day.record.checkInTime);
          return (
            <div key={day.iso} className="flex flex-col items-center gap-1.5">
              <span
                className={`flex size-8 items-center justify-center rounded-full text-[11px] font-bold ${
                  here
                    ? 'bg-primary text-primary-foreground'
                    : day.isToday
                    ? 'border-2 border-primary text-primary'
                    : day.off
                    ? 'bg-muted/60 text-muted-foreground'
                    : 'border border-border text-muted-foreground'
                }`}
                title={day.iso}
              >
                {here ? '✓' : day.off ? '·' : ''}
              </span>
              <span className={`text-[10px] font-semibold ${day.isToday ? 'text-primary' : 'text-text-muted'}`}>{day.letter}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const rangeText = (r) => (r.startDate === r.endDate ? formatDate(r.startDate) : `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`);

/** A plain white card that opens its tab: the number in the app's primary colour. */
function StatCard({ label, value, note, Icon, to }) {
  return (
    <Link
      to={to}
      className="group block rounded-2xl border border-border bg-card p-4 shadow-2xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-[18px]" />
      </div>
      <div className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-primary">{value}</div>
      <div className="mt-0.5 text-xs font-semibold text-text-main">{label}</div>
      <p className="mt-0.5 truncate text-[11px] text-text-muted">{note}</p>
    </Link>
  );
}

/** A titled white block with a link to the full tab. */
function Section({ title, to, linkText, children }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-text-main">{title}</h3>
        <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          {linkText}
          <ArrowRightIcon className="size-3" />
        </Link>
      </div>
      {children}
    </div>
  );
}

const Empty = ({ children }) => (
  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-text-muted">{children}</div>
);

/**
 * The Dashboard of a site worker: a calm greeting with the Punch In / Punch Out button, one card per tab
 * (Attendance, Projects, Tasks, Daily Report, Leave) and two short lists (tasks and projects). Only their own data:
 * no company-wide numbers, progress, birthdays, HR overview or payslips.
 */
export function WorkerDashboard() {
  const { currentUser, hasPermission } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [record, setRecord] = useState(null);
  const [dsrToday, setDsrToday] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [week, setWeek] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [projectList, taskList, today] = await Promise.all([
        projectService.getAllProjects(currentUser),
        taskService.getAllTasks().catch(() => []),
        attendanceService.getTodayAttendance(),
      ]);
      setProjects(projectList || []);
      setTasks(taskList || []);
      setRecord((today || []).find((row) => String(row.userId) === String(currentUser?.id)) || null);

      if (!isDebug()) {
        // these come from the server only (the standalone mock mode has no data for them)
        const [entries, leaveRows, weekRows] = await Promise.all([
          dsrService.listEntries({ from: isoDay(0), to: isoDay(0) }).catch(() => []),
          apiClient.getAll('/leave/requests/').catch(() => []),
          apiClient.getAll('/attendance/records/', { from: isoDay(-6), to: isoDay(0) }).catch(() => []),
        ]);
        setDsrToday(entries);
        setLeaves(leaveRows);
        setWeek(weekRows);
      }
    } catch (err) {
      toast.error(err.message || 'Could not load your dashboard');
    } finally {
      setLoading(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // keep in step when something changes elsewhere in the app, or when the person comes back to this tab
  useEffect(() => {
    const refresh = () => load();
    const events = ['osm_attendance_updated', 'osm_projects_changed', 'osm_project_updated', 'task-allocated', 'focus'];
    events.forEach((name) => window.addEventListener(name, refresh));
    return () => events.forEach((name) => window.removeEventListener(name, refresh));
  }, [load]);

  const checkedIn = hasTime(record?.checkInTime);
  const checkedOut = checkedIn && hasTime(record?.checkOutTime);
  const working = checkedIn && !checkedOut; // punched in and not yet out: the button now says Punch Out

  // minutes worked today: counts up while punched in, fixed once punched out
  useEffect(() => {
    if (!working) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [working]);
  const workedToday = working
    ? record?.checkInAt
      ? Math.max(0, Math.floor((now - new Date(record.checkInAt).getTime()) / 60000))
      : null
    : checkedOut
    ? record?.workedMinutes ?? null
    : 0;

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== 'completed' && p.status !== 'done'),
    [projects]
  );

  const openTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'done')
        .sort(
          (a, b) =>
            Number(Boolean(b.isOverdue)) - Number(Boolean(a.isOverdue)) ||
            String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'))
        ),
    [tasks]
  );
  const overdueCount = openTasks.filter((t) => t.isOverdue).length;
  const dueTodayCount = openTasks.filter((t) => t.dueDate === isoDay(0)).length;

  const dsrMinutes = dsrToday.reduce((sum, e) => sum + e.minutes, 0);
  const pendingLeaves = leaves.filter((l) => l.status === 'pending');
  const nextLeave = leaves
    .filter((l) => l.status === 'approved' && l.endDate >= isoDay(0))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  const handlePunch = async () => {
    setPunching(true);
    try {
      const coordinates = await readLocation();
      const action = working ? 'check-out' : 'check-in';
      const saved = await attendanceService.punchAttendance({ user: currentUser, coordinates, action });
      toast.success(
        action === 'check-out'
          ? `Punched out at ${saved.checkOutTime || 'now'}`
          : `Punched in at ${saved.checkInTime || 'now'}`
      );
      window.dispatchEvent(new CustomEvent('osm_attendance_updated'));
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not record your punch');
    } finally {
      setPunching(false);
    }
  };

  const firstName = currentUser?.name ? currentUser.name.trim().split(/\s+/)[0] : 'there';
  const canCreateTask = hasPermission('tasks.createOwn') || hasPermission('tasks.create');
  const dateText = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const dayLine = checkedOut
    ? `You punched out at ${record.checkOutTime}. Have a good evening.`
    : working
    ? `You punched in at ${record.checkInTime}.`
    : 'You have not punched in yet today.';

  return (
    <div className="space-y-6">
      {/* Greeting, today's time ring and the day's steps */}
      <div className="rounded-2xl bg-primary p-6 text-primary-foreground shadow-xs">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <TimeRing minutes={workedToday} active={working} />
            <div>
              <p className="text-xs font-medium text-primary-foreground/70">{dateText}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                {greeting()}, {firstName}
              </h1>
              <p className="mt-1.5 text-sm text-primary-foreground/80">{dayLine}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                {canCreateTask && (
                  <button
                    type="button"
                    onClick={() => setIsTaskModalOpen(true)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/30 bg-white/15 px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-white/25"
                  >
                    <PlusIcon className="size-3.5" />
                    <span>Create Task</span>
                  </button>
                )}

                {/* One button: Punch In until the worker has punched in, then Punch Out. Once out, the day is done. */}
                {checkedOut ? (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/15 px-4 py-2.5 text-xs font-semibold text-primary-foreground">
                    <CalendarCheckIcon className="size-3.5" />
                    <span>Day complete</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handlePunch}
                    disabled={punching || loading}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-2xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      working
                        ? 'border border-white/30 bg-white/15 text-primary-foreground hover:bg-white/25'
                        : 'border border-white bg-white text-primary hover:bg-white/90'
                    }`}
                  >
                    {working ? <LogOutIcon className="size-3.5" /> : <LogInIcon className="size-3.5" />}
                    <span>{punching ? 'Please wait…' : working ? 'Punch Out' : 'Punch In'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="w-full max-w-sm rounded-xl bg-white/10 p-4 lg:w-80">
            <DaySteps checkedIn={checkedIn} checkedOut={checkedOut} inTime={record?.checkInTime} outTime={record?.checkOutTime} />
          </div>
        </div>
      </div>

      {/* One card per tab */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Attendance"
          value={checkedOut ? 'Out' : working ? 'In' : '—'}
          note={checkedOut ? `Out at ${record.checkOutTime}` : working ? `In at ${record.checkInTime}` : 'Not punched in'}
          Icon={CalendarCheckIcon}
          to="/attendance"
        />
        <StatCard label="Projects" value={projects.length} note={`${activeProjects.length} active`} Icon={Building2Icon} to="/projects" />
        <StatCard
          label="Tasks"
          value={openTasks.length}
          note={overdueCount ? `${overdueCount} overdue` : dueTodayCount ? `${dueTodayCount} due today` : 'Open tasks'}
          Icon={ListChecksIcon}
          to="/tasks"
        />
        <StatCard
          label="Daily Report"
          value={dsrToday.length ? formatDuration(dsrMinutes) : '—'}
          note={dsrToday.length ? `${dsrToday.length} ${dsrToday.length === 1 ? 'entry' : 'entries'} today` : 'Nothing logged today'}
          Icon={FileTextIcon}
          to="/daily-reports"
        />
        <StatCard
          label="Leave"
          value={pendingLeaves.length ? pendingLeaves.length : nextLeave ? '1' : '—'}
          note={pendingLeaves.length ? 'Pending approval' : nextLeave ? `Next: ${rangeText(nextLeave)}` : 'No upcoming leave'}
          Icon={CalendarIcon}
          to="/leave/requests"
        />
      </div>

      <WeekStrip records={week} />

      {/* Two short lists */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="My Tasks" to="/tasks" linkText="All tasks">
          {loading ? (
            <Empty>Loading…</Empty>
          ) : openTasks.length === 0 ? (
            <Empty>No open tasks. Use Create Task to add one for yourself.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {openTasks.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-main">{t.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-text-muted">
                      {t.projectName || 'No project'}
                      {t.dueDate ? ` • Due ${formatDate(t.dueDate)}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {t.isOverdue && <span className="text-[10px] font-bold text-destructive">Overdue</span>}
                    <StatusBadge status={t.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="My Projects" to="/projects" linkText="All projects">
          {loading ? (
            <Empty>Loading…</Empty>
          ) : projects.length === 0 ? (
            <Empty>You are not assigned to any project yet.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {projects.slice(0, 5).map((project) => {
                const stage = currentStageName(project);
                return (
                  <li key={project.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="flex w-full cursor-pointer items-center justify-between gap-3 py-2.5 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text-main">{project.name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-text-muted">
                          {project.clientName || 'Client'}
                          {stage ? ` • Now: ${stage}` : ''}
                        </p>
                      </div>
                      <StatusBadge status={project.status} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      <WorkerTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        projects={projects}
        onCreated={() => navigate('/tasks')}
      />
    </div>
  );
}

export default WorkerDashboard;

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
import { cn } from '../../lib/utils';
import StatusBadge from '../ui/StatusBadge';
import WorkerTaskModal from './WorkerTaskModal';
import {
  Building2Icon,
  CalendarCheckIcon,
  CalendarIcon,
  FileTextIcon,
  ListChecksIcon,
  LogInIcon,
  LogOutIcon,
  MapPinIcon,
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

/** The API sends 24-hour clock text ('18:05'); the page shows '06:05 PM'. */
function to12h(clock) {
  if (!clock) return '—';
  const [h, m] = String(clock).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return clock;
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

const RECORD_LABELS = { present: 'Present', late: 'Late', 'half-day': 'Half Day', overtime: 'Overtime', absent: 'Absent', leave: 'Leave' };
const LEAVE_STYLES = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  rejected: 'bg-destructive/15 text-destructive border-destructive/30',
  withdrawn: 'bg-muted text-muted-foreground border-border',
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

const rangeText = (r) => (r.startDate === r.endDate ? formatDate(r.startDate) : `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`);

/** A summary card that opens its tab. */
function StatCard({ label, value, note, Icon, to }) {
  return (
    <Link
      to={to}
      className="p-4 rounded-2xl bg-surface border border-border hover:border-brand-300 shadow-2xs transition-all block"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-text-muted uppercase tracking-wider truncate">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 border border-brand-200 flex items-center justify-center shrink-0">
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-2 text-2xl font-black text-text-main leading-tight">{value}</div>
      <p className="text-[11px] text-text-muted mt-1 truncate">{note}</p>
    </Link>
  );
}

/** A titled block of the dashboard with a link to the full tab. */
function Section({ title, to, linkText, children }) {
  return (
    <div className="p-5 bg-surface rounded-2xl border border-border shadow-2xs space-y-3">
      <div className="flex items-center justify-between border-b border-border/80 pb-3">
        <h3 className="text-base font-bold text-text-main flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-600" />
          <span>{title}</span>
        </h3>
        <Link to={to} className="text-xs text-brand-600 hover:text-brand-700 font-semibold hover:underline">
          {linkText} →
        </Link>
      </div>
      {children}
    </div>
  );
}

const Empty = ({ children }) => (
  <div className="p-6 text-center text-xs text-text-muted bg-brand-50/50 rounded-xl">{children}</div>
);

/**
 * The Dashboard of a site worker: a summary of each of their tabs (Attendance, Projects, Tasks, Daily Report and
 * Leave), a Punch In / Punch Out button and a shortcut to create their own task. Only their own data: no
 * company-wide numbers, progress, birthdays, HR overview or payslips.
 */
export function WorkerDashboard() {
  const { currentUser, hasPermission } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [record, setRecord] = useState(null);
  const [recent, setRecent] = useState([]);
  const [dsrToday, setDsrToday] = useState([]);
  const [leaves, setLeaves] = useState([]);
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
        const [records, entries, leaveRows] = await Promise.all([
          apiClient.getAll('/attendance/records/', { from: isoDay(-6), to: isoDay(0) }).catch(() => []),
          dsrService.listEntries({ from: isoDay(0), to: isoDay(0) }).catch(() => []),
          apiClient.getAll('/leave/requests/').catch(() => []),
        ]);
        setRecent(records);
        setDsrToday(entries);
        setLeaves(leaveRows);
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

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== 'completed' && p.status !== 'done'),
    [projects]
  );

  // tasks
  const openTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'done')
        .sort((a, b) => Number(Boolean(b.isOverdue)) - Number(Boolean(a.isOverdue)) || String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'))),
    [tasks]
  );
  const overdueCount = openTasks.filter((t) => t.isOverdue).length;
  const dueTodayCount = openTasks.filter((t) => t.dueDate === isoDay(0)).length;

  // daily report
  const dsrMinutes = dsrToday.reduce((sum, e) => sum + e.minutes, 0);

  // leave
  const pendingLeaves = leaves.filter((l) => l.status === 'pending');
  const nextLeave = leaves
    .filter((l) => l.status === 'approved' && l.endDate >= isoDay(0))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const recentLeaves = leaves.filter((l) => l.status !== 'withdrawn').slice(0, 3);

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

  return (
    <div className="space-y-6">
      {/* Welcome and the two things a worker does first */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-primary text-primary-foreground shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Welcome back, {firstName}!</h1>
          <p className="text-xs sm:text-sm text-primary-foreground/80 mt-1">Your day at a glance</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-start md:self-center">
          {canCreateTask && (
            <button
              type="button"
              onClick={() => setIsTaskModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white/15 hover:bg-white/25 text-primary-foreground border border-white/30 transition-colors shadow-2xs cursor-pointer"
            >
              <PlusIcon className="size-3.5" />
              <span>Create Task</span>
            </button>
          )}

          {/* One button: Punch In until the worker has punched in, then Punch Out. Once out, the day is done. */}
          {checkedOut ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white/15 text-primary-foreground border border-white/30">
              <CalendarCheckIcon className="size-3.5" />
              <span>Day complete</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handlePunch}
              disabled={punching || loading}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-colors shadow-2xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                working
                  ? 'bg-white/15 hover:bg-white/25 text-primary-foreground border border-white/30'
                  : 'bg-white hover:bg-white/90 text-primary border border-white'
              }`}
            >
              {working ? <LogOutIcon className="size-3.5" /> : <LogInIcon className="size-3.5" />}
              <span>{punching ? 'Please wait…' : working ? 'Punch Out' : 'Punch In'}</span>
            </button>
          )}
        </div>
      </div>

      {/* One card per tab */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Today's Attendance"
          value={checkedOut ? 'Punched Out' : working ? 'Punched In' : 'Not In'}
          note={`In: ${checkedIn ? record.checkInTime : '—'} • Out: ${checkedOut ? record.checkOutTime : '—'}`}
          Icon={CalendarCheckIcon}
          to="/attendance"
        />
        <StatCard
          label="My Projects"
          value={projects.length}
          note={`${activeProjects.length} active`}
          Icon={Building2Icon}
          to="/projects"
        />
        <StatCard
          label="My Tasks"
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
          value={pendingLeaves.length ? `${pendingLeaves.length} Pending` : nextLeave ? 'Approved' : 'None'}
          note={nextLeave ? `Next: ${rangeText(nextLeave)}` : pendingLeaves.length ? 'Waiting for your manager' : 'No upcoming leave'}
          Icon={CalendarIcon}
          to="/leave/requests"
        />
      </div>

      {/* My tasks and today's daily report */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="My Tasks" to="/tasks" linkText="All tasks">
          {loading ? (
            <Empty>Loading…</Empty>
          ) : openTasks.length === 0 ? (
            <Empty>No open tasks. Use Create Task to add one for yourself.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {openTasks.slice(0, 5).map((t) => (
                <li key={t.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-main leading-snug truncate">{t.title}</p>
                    <p className="text-[11px] text-text-muted mt-0.5 truncate">
                      {t.projectName || 'No project'}
                      {t.dueDate ? ` • Due ${formatDate(t.dueDate)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {t.isOverdue && <span className="text-[10px] font-bold text-destructive">Overdue</span>}
                    <StatusBadge status={t.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Today's Daily Report" to="/daily-reports" linkText="Daily report">
          {loading ? (
            <Empty>Loading…</Empty>
          ) : isDebug() ? (
            <Empty>Open Daily Report to log your work.</Empty>
          ) : dsrToday.length === 0 ? (
            <Empty>Nothing logged today yet. Add what you worked on in Daily Report.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {dsrToday.slice(0, 5).map((e) => (
                <li key={e.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-main leading-snug truncate">{e.task}</p>
                    <p className="text-[11px] text-text-muted mt-0.5 truncate">{e.project} • {e.category}</p>
                  </div>
                  <span className="font-mono text-xs font-semibold text-text-main shrink-0">{formatDuration(e.minutes)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* My projects, recent attendance and leave */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="My Projects" to="/projects" linkText="All my projects">
          {loading ? (
            <Empty>Loading your projects…</Empty>
          ) : projects.length === 0 ? (
            <Empty>You are not assigned to any project yet.</Empty>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {projects.slice(0, 4).map((project) => {
                const stage = currentStageName(project);
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="text-left p-4 rounded-xl border border-border hover:border-brand-300 bg-background transition-colors cursor-pointer space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-text-main leading-snug">{project.name}</span>
                      <StatusBadge status={project.status} />
                    </div>
                    {project.clientName && <p className="text-xs text-text-muted truncate">Client: {project.clientName}</p>}
                    {project.siteAddress && (
                      <p className="text-xs text-text-muted flex items-start gap-1">
                        <MapPinIcon className="size-3.5 shrink-0 mt-px" />
                        <span className="line-clamp-2">{project.siteAddress}</span>
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted pt-1">
                      {stage && <span>Now: {stage}</span>}
                      {(project.targetDate || project.endDate) && <span>Due: {formatDate(project.targetDate || project.endDate)}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Section>

        <div className="space-y-6">
          <Section title="Recent Attendance" to="/attendance" linkText="Attendance">
            {loading ? (
              <Empty>Loading…</Empty>
            ) : isDebug() || recent.length === 0 ? (
              <Empty>{isDebug() ? 'Open Attendance to see your records.' : 'No attendance in the last 7 days.'}</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {[...recent].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((r) => (
                  <li key={r.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-text-main whitespace-nowrap">{formatDate(r.date)}</span>
                    <span className="font-mono text-text-muted">{to12h(r.checkInTime)} – {to12h(r.checkOutTime)}</span>
                    <span className="text-text-main">{RECORD_LABELS[r.status] || r.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="My Leave" to="/leave/requests" linkText="Leave">
            {loading ? (
              <Empty>Loading…</Empty>
            ) : isDebug() || recentLeaves.length === 0 ? (
              <Empty>{isDebug() ? 'Open Leave to see your requests.' : 'No leave requests yet.'}</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {recentLeaves.map((l) => (
                  <li key={l.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-text-main truncate">{l.leaveType}</p>
                      <p className="text-[11px] text-text-muted">{rangeText(l)}</p>
                    </div>
                    <span className={cn('inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border capitalize', LEAVE_STYLES[l.status])}>
                      {l.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
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

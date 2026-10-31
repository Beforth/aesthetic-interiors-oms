import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { clientService } from '../../services/clientService';
import WorkerTaskModal from './WorkerTaskModal';
import TaskAllocationModal from '../common/TaskAllocationModal';
import ConfirmDialog from '../ui/ConfirmDialog';
import {
  ArrowRightIcon,
  Building2Icon,
  CalendarCheckIcon,
  CalendarIcon,
  UsersIcon,
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
function currentStage(project) {
  const stages = [...(project.stages || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  return stages.find((s) => s.status === 'in progress') || stages.find((s) => s.status !== 'done' && s.status !== 'completed') || null;
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
 * The Dashboard of a site worker or a site supervisor. It is built from the person's permissions, so it follows the
 * role: every card and list below is shown only when the person holds the permission for it, and the permissions are
 * re-read from the server every minute, so when an admin changes the role the dashboard changes with it. No
 * company-wide numbers, progress, birthdays, HR overview or payslips.
 */
export function PersonalDashboard() {
  const { currentUser, hasPermission, reloadProfile } = useAuth();
  const userRef = useRef(currentUser);
  userRef.current = currentUser;
  const userId = currentUser?.id;
  const can = (...codes) => codes.some((code) => hasPermission(code));
  const navigate = useNavigate();
  const toast = useToast();

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [record, setRecord] = useState(null);
  const [dsrToday, setDsrToday] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [teamIn, setTeamIn] = useState(null);
  const [clientCount, setClientCount] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  const load = useCallback(async () => {
    const user = userRef.current;
    const ask = (code, fn, fallback) => (hasPermission(code) ? fn().catch(() => fallback) : Promise.resolve(fallback));
    try {
      const [projectList, taskList, today] = await Promise.all([
        can('projects.viewAssigned', 'projects.viewAll', 'projects.viewOwn') ? projectService.getAllProjects(user).catch(() => []) : [],
        can('tasks.updateOwn', 'tasks.viewAll', 'tasks.create') ? taskService.getAllTasks().catch(() => []) : [],
        hasPermission('attendance.markOwn') ? attendanceService.getTodayAttendance() : [],
      ]);
      setProjects(projectList || []);
      setTasks(taskList || []);
      setRecord((today || []).find((row) => String(row.userId) === String(user?.id)) || null);

      if (!isDebug()) {
        // these come from the server only (the standalone mock mode has no data for them)
        const [entries, leaveRows, overview, clients, approvals] = await Promise.all([
          ask('dsr.submit', () => dsrService.listEntries({ from: isoDay(0), to: isoDay(0) }), []),
          ask('leave.apply', () => apiClient.getAll('/leave/requests/', { person: 'me' }), []),
          ask('attendance.viewBoard', () => attendanceService.getOverviewStats(), null),
          ask('clients.view', () => clientService.getAllClients(), null),
          ask('leave.approve', () => apiClient.getAll('/leave/requests/', { status: 'pending' }), null),
        ]);
        setDsrToday(entries);
        setLeaves(leaveRows);
        setTeamIn(overview);
        setClientCount(clients ? clients.length : null);
        setPendingApprovals(approvals ? approvals.length : null);
      }
    } catch (err) {
      toast.error(err.message || 'Could not load your dashboard');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, toast, hasPermission]);

  useEffect(() => {
    load();
  }, [load]);

  // permissions are re-read from the server every minute and when the tab regains focus
  useEffect(() => {
    if (isDebug()) return undefined;
    const refreshPermissions = () => reloadProfile().catch(() => {});
    const timer = setInterval(refreshPermissions, 60 * 1000);
    window.addEventListener('focus', refreshPermissions);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refreshPermissions);
    };
  }, [reloadProfile]);

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

  const showTasks = can('tasks.updateOwn', 'tasks.viewAll', 'tasks.create');
  const showProjects = can('projects.viewAssigned', 'projects.viewAll', 'projects.viewOwn');
  const [busyStage, setBusyStage] = useState(null);

  /** The supervisor or worker finished the stage the project is at (needs stages.updateStatus). */
  const completeStage = async (project, stage) => {
    setBusyStage(stage.id);
    try {
      await projectService.updateStageStatus(project.id, stage.id, 'done');
      toast.success(`${stage.name} marked as completed`);
      window.dispatchEvent(new CustomEvent('osm_project_updated', { detail: { projectId: project.id } }));
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not update the stage');
    } finally {
      setBusyStage(null);
    }
  };

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
  const canCreateTask = can('tasks.createOwn', 'tasks.create');
  const createForOthers = hasPermission('tasks.create');
  const dateText = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const dayLine = checkedOut
    ? `You punched out at ${record.checkOutTime}. Have a good evening.`
    : working
    ? `You punched in at ${record.checkInTime}.`
    : 'You have not punched in yet today.';

  return (
    <div className="space-y-6">
      {/* Greeting and the two things a worker does first */}
      <div className="flex flex-col gap-5 rounded-2xl bg-primary p-6 text-primary-foreground shadow-xs md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-medium text-primary-foreground/70">{dateText}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-primary-foreground/80">{dayLine}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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
          {!hasPermission('attendance.markOwn') ? null : checkedOut ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/15 px-4 py-2.5 text-xs font-semibold text-primary-foreground">
              <CalendarCheckIcon className="size-3.5" />
              <span>Day complete</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => (working ? setConfirmOut(true) : handlePunch())}
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

      {/* One card per tab the person may use. Add a permission to the role and its card appears. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {can('attendance.markOwn') && (
          <StatCard
            label="Attendance"
            value={checkedOut ? 'Out' : working ? 'In' : '—'}
            note={checkedOut ? `Out at ${record.checkOutTime}` : working ? `In at ${record.checkInTime}` : 'Not punched in'}
            Icon={CalendarCheckIcon}
            to="/attendance"
          />
        )}
        {can('attendance.viewBoard') && teamIn && (
          <StatCard
            label="Team Attendance"
            value={`${teamIn.checkedIn ?? 0}/${teamIn.totalEmployees ?? 0}`}
            note="Punched in today"
            Icon={UsersIcon}
            to="/attendance"
          />
        )}
        {can('projects.viewAssigned', 'projects.viewAll', 'projects.viewOwn') && (
          <StatCard label="Projects" value={projects.length} note={`${activeProjects.length} active`} Icon={Building2Icon} to="/projects" />
        )}
        {can('tasks.updateOwn', 'tasks.viewAll', 'tasks.create') && (
          <StatCard
            label="Tasks"
            value={openTasks.length}
            note={overdueCount ? `${overdueCount} overdue` : dueTodayCount ? `${dueTodayCount} due today` : 'Open tasks'}
            Icon={ListChecksIcon}
            to="/tasks"
          />
        )}
        {can('dsr.submit') && (
          <StatCard
            label="Daily Report"
            value={dsrToday.length ? formatDuration(dsrMinutes) : '—'}
            note={dsrToday.length ? `${dsrToday.length} ${dsrToday.length === 1 ? 'entry' : 'entries'} today` : 'Nothing logged today'}
            Icon={FileTextIcon}
            to="/daily-reports"
          />
        )}
        {can('leave.apply') && (
          <StatCard
            label="Leave"
            value={pendingLeaves.length ? pendingLeaves.length : nextLeave ? '1' : '—'}
            note={pendingLeaves.length ? 'Pending approval' : nextLeave ? `Next: ${rangeText(nextLeave)}` : 'No upcoming leave'}
            Icon={CalendarIcon}
            to="/leave/requests"
          />
        )}
        {can('leave.approve') && pendingApprovals !== null && (
          <StatCard
            label="Leave Approvals"
            value={pendingApprovals}
            note={pendingApprovals ? 'Waiting for you' : 'Nothing waiting'}
            Icon={CalendarIcon}
            to="/leave/requests"
          />
        )}
        {can('clients.view') && clientCount !== null && (
          <StatCard label="Clients" value={clientCount} note="On your projects" Icon={UsersIcon} to="/clients" />
        )}
      </div>

      {/* Short lists, again only for the tabs the person may use */}
      <div className={`grid grid-cols-1 gap-6 ${showTasks && showProjects ? 'lg:grid-cols-2' : ''}`}>
        {showTasks && (
          <Section title="My Tasks" to="/tasks" linkText="All tasks">
            {loading ? (
              <Empty>Loading…</Empty>
            ) : openTasks.length === 0 ? (
              <Empty>{canCreateTask ? 'No open tasks. Use Create Task to add one.' : 'No open tasks.'}</Empty>
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
        )}

        {showProjects && (
          <Section title="My Projects" to="/projects" linkText="All projects">
            {loading ? (
              <Empty>Loading…</Empty>
            ) : projects.length === 0 ? (
              <Empty>You are not assigned to any project yet.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {projects.slice(0, 5).map((project) => {
                  const stage = currentStage(project);
                  return (
                    <li key={project.id} className="flex items-center justify-between gap-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/projects/${project.id}`)}
                        className="min-w-0 flex-1 cursor-pointer text-left"
                      >
                        <p className="truncate text-sm font-semibold text-text-main">{project.name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-text-muted">
                          {project.clientName || 'Client'}
                          {stage ? ` • Now: ${stage.name}` : ''}
                        </p>
                      </button>
                      {stage && can('stages.updateStatus') ? (
                        <button
                          type="button"
                          disabled={busyStage === stage.id}
                          onClick={() => completeStage(project, stage)}
                          className="shrink-0 cursor-pointer rounded-lg border border-primary/40 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
                          title={`Mark ${stage.name} as completed`}
                        >
                          {busyStage === stage.id ? 'Saving…' : 'Stage done'}
                        </button>
                      ) : (
                        <StatusBadge status={project.status} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmOut}
        title="Punch out?"
        message="Are you sure you want to punch out for today? You cannot punch in again today without a request."
        confirmText="Punch Out"
        confirmVariant="primary"
        onCancel={() => setConfirmOut(false)}
        onConfirm={() => {
          setConfirmOut(false);
          handlePunch();
        }}
      />

      {createForOthers ? (
        <TaskAllocationModal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} onTaskAllocated={() => load()} />
      ) : (
        <WorkerTaskModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          projects={projects}
          onCreated={() => navigate('/tasks')}
        />
      )}
    </div>
  );
}

export default PersonalDashboard;

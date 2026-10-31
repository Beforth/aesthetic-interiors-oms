import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { isDebug } from '../../config/env';
import { projectService } from '../../services/projectService';
import { attendanceService } from '../../services/attendanceService';
import { formatDate } from '../../utils/formatters';
import StatusBadge from '../ui/StatusBadge';
import WorkerTaskModal from './WorkerTaskModal';
import { Building2Icon, CalendarCheckIcon, LogInIcon, LogOutIcon, MapPinIcon, PlusIcon } from '../ui/icons';

const NO_TIME = new Set(['', '-', '—', null, undefined]);
const hasTime = (value) => !NO_TIME.has(value);

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

/**
 * The Dashboard of a site worker: only their own projects and today's attendance, a Punch In / Punch Out button
 * and a shortcut to create their own task. No company-wide numbers, progress, birthdays or HR overview.
 */
export function WorkerDashboard() {
  const { currentUser, hasPermission } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [projects, setProjects] = useState([]);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [projectList, today] = await Promise.all([
        projectService.getAllProjects(currentUser),
        attendanceService.getTodayAttendance(),
      ]);
      setProjects(projectList || []);
      setRecord((today || []).find((row) => String(row.userId) === String(currentUser?.id)) || null);
    } catch (err) {
      toast.error(err.message || 'Could not load your dashboard');
    } finally {
      setLoading(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // keep in step when attendance or projects change elsewhere in the app
  useEffect(() => {
    const refresh = () => load();
    ['osm_attendance_updated', 'osm_projects_changed', 'osm_project_updated'].forEach((name) =>
      window.addEventListener(name, refresh)
    );
    return () =>
      ['osm_attendance_updated', 'osm_projects_changed', 'osm_project_updated'].forEach((name) =>
        window.removeEventListener(name, refresh)
      );
  }, [load]);

  const checkedIn = hasTime(record?.checkInTime);
  const checkedOut = checkedIn && hasTime(record?.checkOutTime);
  const working = checkedIn && !checkedOut; // punched in and not yet out: the button now says Punch Out

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== 'completed' && p.status !== 'done'),
    [projects]
  );

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-brand-900 text-white shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Welcome back, {firstName}!</h1>
          <p className="text-xs sm:text-sm text-brand-200 mt-1">Your projects and today's attendance</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-start md:self-center">
          {canCreateTask && (
            <button
              type="button"
              onClick={() => setIsTaskModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-brand-800 hover:bg-brand-700 text-white border border-brand-700 transition-colors shadow-2xs cursor-pointer"
            >
              <PlusIcon className="size-3.5" />
              <span>Create Task</span>
            </button>
          )}

          {/* One button: Punch In until the worker has punched in, then Punch Out. Once out, the day is done. */}
          {checkedOut ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white/10 text-white border border-white/20">
              <CalendarCheckIcon className="size-3.5" />
              <span>Day complete</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handlePunch}
              disabled={punching || loading}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-white transition-colors shadow-2xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                working
                  ? 'bg-brand-800 hover:bg-brand-700 border border-brand-700'
                  : 'bg-emerald-700 hover:bg-emerald-600'
              }`}
            >
              {working ? <LogOutIcon className="size-3.5" /> : <LogInIcon className="size-3.5" />}
              <span>{punching ? 'Please wait…' : working ? 'Punch Out' : 'Punch In'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Two cards: my projects and today's attendance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-surface border border-border shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">My Projects</span>
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 border border-brand-200 flex items-center justify-center">
              <Building2Icon className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-text-main">{projects.length}</span>
            <span className="text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded-full">
              {activeProjects.length} Active
            </span>
          </div>
          <p className="text-[11px] text-text-muted mt-1 truncate">Sites you are assigned to</p>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-border shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Today's Attendance</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <CalendarCheckIcon className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-text-main">
              {checkedOut ? 'Punched Out' : working ? 'Punched In' : 'Not Punched In'}
            </span>
          </div>
          <p className="text-[11px] text-text-muted mt-1 truncate">
            In: {checkedIn ? record.checkInTime : '—'} • Out: {checkedOut ? record.checkOutTime : '—'}
          </p>
        </div>
      </div>

      {/* My own projects, without progress figures */}
      <div className="p-5 bg-surface rounded-2xl border border-border shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <h3 className="text-base font-bold text-text-main flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-600" />
            <span>My Projects</span>
          </h3>
          <Link to="/projects" className="text-xs text-brand-600 hover:text-brand-700 font-semibold hover:underline">
            All my projects →
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading your projects…</div>
        ) : projects.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted bg-brand-50/50 rounded-xl">
            You are not assigned to any project yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {projects.map((project) => {
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
                    {(project.targetDate || project.endDate) && (
                      <span>Due: {formatDate(project.targetDate || project.endDate)}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
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

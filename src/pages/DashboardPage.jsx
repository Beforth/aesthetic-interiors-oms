import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../config/roles';
import { projectService } from '../services/projectService';
import { taskService } from '../services/taskService';
import { attendanceService } from '../services/attendanceService';
import { userService } from '../services/userService';
import { dashboardService } from '../services/dashboardService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { calculateProgress } from '../utils/progress';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/utils';
import { mockUsers } from '../data/users';

import ProgressBar from '../components/ui/ProgressBar';
import Icon from '../components/ui/Icon';
import StatusBadge from '../components/ui/StatusBadge';
import Button from '../components/ui/Button';
import { Avatar } from '../components/ui/avatar';
import Modal from '../components/ui/Modal';
import TaskAllocationModal from '../components/common/TaskAllocationModal';
import { Leaderboard } from '../components/ui/leaderboard';
import { Building2Icon, CalendarCheckIcon, CakeIcon } from '../components/ui/icons';
import OverallProgressGraph from '../components/domain/OverallProgressGraph';
import HRWorkforceOverview from '../components/domain/HRWorkforceOverview';

export function DashboardPage() {
  const { currentUser, role } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [users, setUsers] = useState(mockUsers);
  const [loading, setLoading] = useState(true);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isBirthdaysModalOpen, setIsBirthdaysModalOpen] = useState(false);
  const [hoveredProject, setHoveredProject] = useState(null);

  const loadDashboardData = async () => {
    try {
      const [projList, taskList, attList, userList, summary] = await Promise.all([
        projectService.getAllProjects(currentUser),
        taskService.getAllTasks(),
        attendanceService.getTodayAttendance(),
        userService.getAllUsers(),
        dashboardService.getSummary().catch(() => null),
      ]);
      setProjects(projList || []);
      setTasks(taskList || []);
      setAttendance(attList || []);
      // Merge birthdays from summary or user profile
      const birthdays = new Map((summary?.birthdays || []).map((b) => [String(b.userId), b.birthday]));
      setUsers(
        (userList || []).map((u) => {
          const b = u.birthday || u.birthdate || birthdays.get(String(u.id));
          return b ? { ...u, birthday: b, birthdate: b } : u;
        })
      );
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentUser]);

  // Real-time synchronization when tasks, projects, or attendance are created or updated
  useEffect(() => {
    const handleDataUpdate = () => {
      loadDashboardData();
    };
    window.addEventListener('task-allocated', handleDataUpdate);
    window.addEventListener('osm_attendance_updated', handleDataUpdate);
    window.addEventListener('osm_attendance_requests_updated', handleDataUpdate);
    window.addEventListener('osm_project_created', handleDataUpdate);
    window.addEventListener('osm_project_updated', handleDataUpdate);
    window.addEventListener('osm_project_deleted', handleDataUpdate);
    window.addEventListener('osm_projects_changed', handleDataUpdate);
    window.addEventListener('osm_users_updated', handleDataUpdate);
    window.addEventListener('osm_user_created', handleDataUpdate);
    window.addEventListener('storage', handleDataUpdate);
    window.addEventListener('focus', handleDataUpdate);
    return () => {
      window.removeEventListener('task-allocated', handleDataUpdate);
      window.removeEventListener('osm_attendance_updated', handleDataUpdate);
      window.removeEventListener('osm_attendance_requests_updated', handleDataUpdate);
      window.removeEventListener('osm_project_created', handleDataUpdate);
      window.removeEventListener('osm_project_updated', handleDataUpdate);
      window.removeEventListener('osm_project_deleted', handleDataUpdate);
      window.removeEventListener('osm_projects_changed', handleDataUpdate);
      window.removeEventListener('osm_users_updated', handleDataUpdate);
      window.removeEventListener('osm_user_created', handleDataUpdate);
      window.removeEventListener('storage', handleDataUpdate);
      window.removeEventListener('focus', handleDataUpdate);
    };
  }, []);

  // Quick toggle task status
  const handleToggleTaskStatus = async (taskId, currentStatus) => {
    const nextStatus = currentStatus === 'done' ? 'in progress' : 'done';
    try {
      await taskService.updateTask(taskId, { status: nextStatus });
      toast.success(nextStatus === 'done' ? 'Task marked as completed!' : 'Task moved to in progress');
      loadDashboardData();
    } catch (e) {
      toast.error('Failed to update task');
    }
  };

  // Metric computations
  const activeProjects = useMemo(() => {
    return projects.filter((p) => p.status !== 'completed' && p.status !== 'done');
  }, [projects]);

  const completedProjects = useMemo(() => {
    return projects.filter((p) => p.status === 'completed' || p.status === 'done');
  }, [projects]);

  const totalContractValuation = useMemo(() => {
    return activeProjects.reduce((acc, p) => acc + (p.totalCost || p.budget || 0), 0);
  }, [activeProjects]);

  const pendingTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== 'done');
  }, [tasks]);

  const totalStaffCount = useMemo(() => {
    return attendance.length > 0 ? attendance.length : users.filter((u) => u.role !== 'client').length;
  }, [attendance, users]);

  const presentCount = useMemo(() => {
    return attendance.filter((a) => {
      const s = String(a.status || '').toLowerCase();
      const hasPunch = Boolean(a.checkInTime && a.checkInTime !== '-' && a.checkInTime !== '—');
      return s === 'present' || s === 'late' || s === 'overtime' || s === 'half-day' || hasPunch;
    }).length;
  }, [attendance]);

  const absentCount = useMemo(() => {
    return Math.max(0, totalStaffCount - presentCount);
  }, [totalStaffCount, presentCount]);

  const onDutyPercentage = totalStaffCount > 0 ? Math.round((presentCount / totalStaffCount) * 100) : 0;

  const currentMonth = new Date().getMonth();
  const currentMonthName = new Date().toLocaleString('en-US', { month: 'long' });
  const currentMonthShort = new Date().toLocaleString('en-US', { month: 'short' });
  const todayDate = new Date().getDate();

  const monthlyBirthdays = useMemo(() => {
    return users
      .filter((u) => (u.birthday || u.birthdate) && u.role !== 'client')
      .map((u) => {
        const raw = String(u.birthday || u.birthdate).trim();
        let month = -1;
        let day = -1;
        if (raw.includes('-')) {
          const parts = raw.split('-');
          if (parts[0].length === 4) {
            // YYYY-MM-DD
            month = parseInt(parts[1], 10) - 1;
            day = parseInt(parts[2], 10);
          } else {
            // DD-MM-YYYY
            month = parseInt(parts[1], 10) - 1;
            day = parseInt(parts[0], 10);
          }
        } else {
          const d = new Date(raw);
          if (!isNaN(d.getTime())) {
            month = d.getMonth();
            day = d.getDate();
          }
        }
        return {
          ...u,
          birthMonth: month,
          birthDay: day,
          displayDate: `${currentMonthShort} ${day}`,
          isUpcoming: day >= todayDate,
        };
      })
      .filter((u) => u.birthMonth === currentMonth && u.birthDay > 0)
      .sort((a, b) => a.birthDay - b.birthDay);
  }, [users, currentMonth, currentMonthShort, todayDate]);

  // Compute Leaderboard ranking items for Project Execution & Process Tracker
  const projectLeaderboardItems = useMemo(() => {
    return activeProjects.map((proj) => {
      const projProgress = calculateProgress(proj.stages || []);
      const currentStage =
        (proj.stages || []).find((s) => s.status === 'in progress') ||
        (proj.stages || []).find((s) => s.status === 'pending') || {
          name: 'Stage Initiation',
          order: 1,
        };
      const completedCount = (proj.stages || []).filter((s) => s.status === 'completed').length;

      return {
        name: proj.name,
        value: projProgress,
        delta: completedCount > 0 ? completedCount : undefined,
        subtitle: `Stage ${currentStage.order || '1'}: ${currentStage.name} • Client: ${proj.clientName || 'Private'} • Val: ${formatCurrency(proj.totalCost || proj.budget || 0)}`,
        onClick: () => navigate(`/projects/${proj.id}`),
        onMouseEnter: () => setHoveredProject({ name: proj.name, progress: projProgress }),
        onMouseLeave: () => setHoveredProject(null),
      };
    });
  }, [activeProjects, navigate]);

  // Calculate aggregate portfolio execution metrics for the Overall Progress graph
  const overallPortfolioStats = useMemo(() => {
    if (projects.length === 0) {
      return {
        percentage: 0,
        activeCount: 0,
        completedCount: 0,
        totalMilestones: 0,
        completedMilestones: 0,
      };
    }

    let totalProgressSum = 0;
    let totalMilestones = 0;
    let completedMilestones = 0;

    activeProjects.forEach((p) => {
      const prog = calculateProgress(p.stages || []);
      totalProgressSum += prog;
      const stages = p.stages || [];
      totalMilestones += stages.length;
      completedMilestones += stages.filter((s) => s.status === 'completed').length;
    });

    const avgProgress =
      activeProjects.length > 0
        ? Math.round(totalProgressSum / activeProjects.length)
        : 100;

    return {
      percentage: avgProgress,
      activeCount: activeProjects.length,
      completedCount: completedProjects.length,
      totalMilestones,
      completedMilestones,
    };
  }, [projects, activeProjects, completedProjects]);

  const userFirstName = currentUser?.name
    ? currentUser.name.trim().split(/\s+/)[0]
    : 'Partner';

  return (
    <div className="space-y-6">
      {/* Top Welcome Header - Solid Clean Indigo Canvas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-brand-900 text-white shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Welcome back, {userFirstName}!
          </h1>
          <p className="text-xs sm:text-sm text-brand-200 mt-1">
            Daily operations, projects, and workforce overview
          </p>
        </div>

        {/* Header Action Buttons (No Logout button here - logout is located at user avatar icon in topbar) */}
        <div className="flex items-center gap-2.5 flex-wrap self-start md:self-center">
          <button
            type="button"
            onClick={() => setIsTaskModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-brand-800 hover:bg-brand-700 text-white border border-brand-700 transition-colors shadow-2xs cursor-pointer"
          >
            <Icon name="plus" size={14} />
            <span>Allocate Task</span>
          </button>

          <Link
            to="/attendance"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white transition-colors shadow-2xs cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            <span>Mark Attendance</span>
          </Link>

          <Link
            to="/projects"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white text-brand-900 hover:bg-brand-50 transition-colors shadow-2xs cursor-pointer"
          >
            <Icon name="plus" size={14} />
            <span>New Site</span>
          </Link>
        </div>
      </div>

      {/* 3 Fresh Clean Stat Cards - Solid Modern Styling */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Active Projects (Brand Indigo) */}
        <div className="p-4 rounded-2xl bg-surface border border-border hover:border-brand-300 shadow-2xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Total Projects
            </span>
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
          <p className="text-[11px] text-text-muted mt-1 truncate">
            {activeProjects.length} live sites • {completedProjects.length} delivered
          </p>
        </div>

        {/* Card 2: Today's Attendance (Emerald) */}
        <div className="p-4 rounded-2xl bg-surface border border-border hover:border-emerald-300 shadow-2xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Today's Attendance
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <CalendarCheckIcon className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-text-main">{presentCount} Present</span>
            <span className="text-xs text-text-muted font-medium">/ {totalStaffCount} Staff</span>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
              onDutyPercentage >= 80
                ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                : 'text-amber-700 bg-amber-50 border border-amber-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${onDutyPercentage >= 80 ? 'bg-emerald-600' : 'bg-amber-600'} animate-pulse`} />
              {onDutyPercentage}% On-Duty
            </span>
          </div>
          <p className="text-[11px] text-text-muted mt-1 truncate">
            {presentCount} on-duty, {absentCount} absent from attendance muster
          </p>
        </div>

        {/* Card 3: Upcoming Employee Birthdays (This Month) */}
        <div className="p-4 rounded-2xl bg-surface border border-border hover:border-pink-300 shadow-2xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Birthdays ({currentMonthName})
            </span>
            <div className="w-8 h-8 rounded-lg bg-pink-50 text-pink-600 border border-pink-200 flex items-center justify-center">
              <CakeIcon className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-text-main">
              {monthlyBirthdays.length}
            </span>
            <span className="text-xs font-semibold text-pink-700 bg-pink-50 border border-pink-200 px-2 py-0.5 rounded-full">
              This Month
            </span>
          </div>
          <div className="mt-1 text-[11px] text-text-muted truncate">
            {monthlyBirthdays.length > 0 ? (
              <div className="flex items-center gap-1.5 truncate">
                <span className="font-semibold text-text-main truncate">
                  {monthlyBirthdays[0].name} ({monthlyBirthdays[0].displayDate})
                </span>
                {monthlyBirthdays.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setIsBirthdaysModalOpen(true)}
                    className="text-pink-600 font-medium hover:underline shrink-0 cursor-pointer"
                  >
                    +{monthlyBirthdays.length - 1} more
                  </button>
                )}
              </div>
            ) : (
              <span>No employee birthdays in {currentMonthName}</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Left Column (Project Process + Graphs + Tasks), Right Column (Today's Attendance + Operational Notes) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols wide) */}
        <div className="lg:col-span-2 space-y-6">
          {/* SECTION 1: Project Execution & Process Tracker */}
          <div className="p-5 bg-surface rounded-2xl border border-border shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
              <div>
                <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-600" />
                  <span>Project Tracker</span>
                  <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                    {activeProjects.length} Live Sites
                  </span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Real-time milestone velocity ranking, progress bars, and hand-off status
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  to="/projects"
                  className="text-xs text-brand-600 hover:text-brand-700 font-semibold underline-offset-2 hover:underline self-start sm:self-auto cursor-pointer"
                >
                  All Projects →
                </Link>
              </div>
            </div>

            {activeProjects.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted bg-brand-50/50 rounded-xl">
                No active projects found.
              </div>
            ) : (
              <div
                className={cn(
                  'pr-1 scrollbar-thin transition-all',
                  activeProjects.length > 4
                    ? 'max-h-[296px] overflow-y-auto'
                    : 'overflow-visible'
                )}
              >
                <Leaderboard
                  items={projectLeaderboardItems}
                  format={(val) => `${val}%`}
                  maxValue={100}
                  className="gap-2.5"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col wide): Overall Portfolio Progress */}
        <div className="space-y-6">
          {/* OVERALL PORTFOLIO PROGRESS: Fluid Organic Progress Visualizer */}
          <OverallProgressGraph
            percentage={hoveredProject ? hoveredProject.progress : overallPortfolioStats.percentage}
            previewProjectName={hoveredProject ? hoveredProject.name : null}
            activeCount={overallPortfolioStats.activeCount}
            completedCount={overallPortfolioStats.completedCount}
            totalMilestones={overallPortfolioStats.totalMilestones}
            completedMilestones={overallPortfolioStats.completedMilestones}
          />
        </div>
      </div>

      {/* Workforce & HR Operations (Recent Employees, Total Employees, Leave Applications, Holidays) */}
      <div className="border-t border-border/80 pt-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-text-main flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />
            <span>Workforce & HR Operations</span>
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Staff directory arrivals, leave workflow statuses, and upcoming holiday schedule
          </p>
        </div>
        <HRWorkforceOverview
          users={users}
          totalEmployees={users.filter((u) => u.role !== 'client' && u.status !== 'inactive').length}
          onDataRefresh={loadDashboardData}
        />
      </div>

      {/* Task Allocation Modal Dialog */}
      <TaskAllocationModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onTaskAllocated={() => loadDashboardData()}
      />

      {/* Employee Birthdays Modal Dialog */}
      <Modal
        isOpen={isBirthdaysModalOpen}
        onClose={() => setIsBirthdaysModalOpen(false)}
        title={`Employee Birthdays — ${currentMonthName}`}
        subtitle={`All ${monthlyBirthdays.length} team members celebrating birthdays in ${currentMonthName}`}
        size="md"
        footer={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBirthdaysModalOpen(false)}
          >
            Close
          </Button>
        }
      >
        <div className="space-y-2.5 max-h-[350px] overflow-y-auto scrollbar-thin pr-1 text-xs">
          {monthlyBirthdays.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-4">
              No birthdays found for ${currentMonthName}.
            </p>
          ) : (
            monthlyBirthdays.map((u) => {
              const isToday = u.birthDay === todayDate;
              return (
                <div
                  key={u.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                    isToday
                      ? 'bg-pink-50/70 border-pink-300 dark:bg-pink-950/20 dark:border-pink-800'
                      : 'bg-surface border-border hover:border-pink-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar name={u.name} size="sm" />
                    <div>
                      <div className="font-semibold text-xs text-text-main flex items-center gap-1.5">
                        <span>{u.name}</span>
                        {isToday && (
                          <span className="text-[10px] font-bold text-pink-700 bg-pink-100 px-1.5 py-0.2 rounded-full border border-pink-200">
                            Today! 🎂
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-text-muted">{u.role || 'Staff Member'}</div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-pink-600 font-mono bg-pink-50 border border-pink-200 px-2 py-0.5 rounded-lg">
                    {u.displayDate}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </Modal>

    </div>
  );
}

export default DashboardPage;

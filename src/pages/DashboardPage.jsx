import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../config/roles';
import { projectService } from '../services/projectService';
import { taskService } from '../services/taskService';
import { attendanceService } from '../services/attendanceService';
import { userService } from '../services/userService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { calculateProgress } from '../utils/progress';
import { useToast } from '../context/ToastContext';
import { mockUsers } from '../data/users';

import ProgressBar from '../components/ui/ProgressBar';
import Avatar from '../components/ui/Avatar';
import Icon from '../components/ui/Icon';
import StatusBadge from '../components/ui/StatusBadge';
import Button from '../components/ui/Button';
import TaskAllocationModal from '../components/common/TaskAllocationModal';
import { Leaderboard } from '../components/ui/leaderboard';
import OverallProgressGraph from '../components/domain/OverallProgressGraph';

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
  const [trackerTab, setTrackerTab] = useState('leaderboard'); // 'leaderboard' | 'cards'

  const loadDashboardData = async () => {
    try {
      const [projList, taskList, attList, userList] = await Promise.all([
        projectService.getAllProjects(currentUser),
        taskService.getAllTasks(),
        attendanceService.getTodayAttendance(),
        userService.getAllUsers(),
      ]);
      setProjects(projList || []);
      setTasks(taskList || []);
      setAttendance(attList || []);
      setUsers(userList || []);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentUser]);

  // Real-time synchronization when a task is allocated anywhere in the system
  useEffect(() => {
    const handleTaskAllocated = () => {
      loadDashboardData();
    };
    window.addEventListener('task-allocated', handleTaskAllocated);
    return () => window.removeEventListener('task-allocated', handleTaskAllocated);
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
    return attendance.filter((a) => a.status === 'present').length;
  }, [attendance]);

  const absentCount = useMemo(() => {
    return Math.max(0, totalStaffCount - presentCount);
  }, [totalStaffCount, presentCount]);

  const onDutyPercentage = totalStaffCount > 0 ? Math.round((presentCount / totalStaffCount) * 100) : 0;

  const presentStaff = useMemo(() => {
    return attendance.filter((a) => a.status === 'present');
  }, [attendance]);

  const chartProjects = activeProjects.slice(0, 4);

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

  // Live Milestone Hand-offs across active projects
  const recentHandOffs = useMemo(() => {
    const list = [];
    (projects || []).forEach((proj) => {
      (proj.stages || []).forEach((stg) => {
        if (stg.status === 'done') {
          list.push({
            projectId: proj.id,
            projectName: proj.name,
            clientName: proj.clientName,
            stageName: stg.name,
            agencyName: stg.agencyName || 'Specialized Agency',
            date: stg.endDate ? formatDate(stg.endDate) : 'Completed',
          });
        }
      });
    });
    return list.slice(0, 4);
  }, [projects]);

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
            Live Operations & Execution Dashboard • Aesthetic Interiors OMS
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
              Active Fit-out Sites
            </span>
            <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center">
              <Icon name="projects" size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-text-main">{activeProjects.length}</span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
              Live Execution
            </span>
          </div>
          <p className="text-[11px] text-text-muted mt-1 truncate">
            {completedProjects.length} sites successfully handed over
          </p>
        </div>

        {/* Card 2: Combined Valuation (Purple) */}
        <div className="p-4 rounded-2xl bg-surface border border-border hover:border-purple-300 shadow-2xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Active Valuation
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center">
              <Icon name="payments" size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-text-main">
              {formatCurrency(totalContractValuation)}
            </span>
          </div>
          <p className="text-[11px] text-text-muted mt-1 truncate">
            Across {activeProjects.length} active fit-out contracts
          </p>
        </div>

        {/* Card 3: Today's Attendance (Emerald) */}
        <div className="p-4 rounded-2xl bg-surface border border-border hover:border-emerald-300 shadow-2xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Today's Attendance
            </span>
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
                  <span>Project Execution & Process Tracker</span>
                  <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                    {activeProjects.length} Live Sites
                  </span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Real-time milestone velocity ranking, progress bars, and hand-off status
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* View Switcher Toggle */}
                <div className="flex items-center gap-1 bg-brand-50 p-0.5 rounded-lg border border-brand-200">
                  <button
                    type="button"
                    onClick={() => setTrackerTab('leaderboard')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      trackerTab === 'leaderboard'
                        ? 'bg-white text-brand-700 shadow-2xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    Leaderboard
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrackerTab('cards')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      trackerTab === 'cards'
                        ? 'bg-white text-brand-700 shadow-2xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    Stage Cards
                  </button>
                </div>

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
            ) : trackerTab === 'leaderboard' ? (
              <Leaderboard
                items={projectLeaderboardItems}
                format={(val) => `${val}% Done`}
                maxValue={100}
                className="gap-2.5"
              />
            ) : (
              <div className="space-y-3.5">
                {activeProjects.map((proj) => {
                  const projProgress = calculateProgress(proj.stages || []);
                  const currentStage = (proj.stages || []).find((s) => s.status === 'in progress') ||
                    (proj.stages || []).find((s) => s.status === 'pending') || {
                      name: 'Stage Initiation',
                      order: 1,
                    };

                  return (
                    <div
                      key={proj.id}
                      className="p-4 rounded-xl border border-border bg-surface hover:border-indigo-400 transition-all space-y-3 shadow-2xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              to={`/projects/${proj.id}`}
                              className="text-sm font-bold text-text-main hover:text-indigo-600 transition-colors truncate cursor-pointer"
                            >
                              {proj.name}
                            </Link>
                            <StatusBadge status={proj.status} size="sm" />
                          </div>
                          <p className="text-xs text-text-muted mt-0.5 truncate">
                            Client: <span className="font-medium text-text-main">{proj.clientName}</span>
                            {proj.siteAddress && ` • ${proj.siteAddress}`}
                          </p>
                        </div>

                        <div className="text-right sm:shrink-0">
                          <span className="text-xs font-mono font-bold text-text-main">
                            {formatCurrency(proj.totalCost || proj.budget || 0)}
                          </span>
                          <div className="text-[11px] text-text-muted">Contract Value</div>
                        </div>
                      </div>

                      {/* Process Stage Stepper & Metric Info */}
                      <div className="p-2.5 rounded-lg bg-brand-50/50 border border-border/80 flex flex-col sm:flex-row sm:items-between justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[11px]">
                            Stage {currentStage.order || '1'}
                          </span>
                          <span className="font-semibold text-text-main truncate">
                            {currentStage.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-text-muted text-[11px] shrink-0">
                          <span>Target: {formatDate(proj.endDate)}</span>
                          <span>•</span>
                          <span className="font-bold text-indigo-700">{projProgress}% Done</span>
                        </div>
                      </div>

                      {/* Progress Bar (Solid Color) */}
                      <div className="space-y-1">
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              projProgress >= 75
                                ? 'bg-emerald-600'
                                : projProgress >= 40
                                ? 'bg-indigo-600'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${projProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: Visual Charts & Analytics (Project Progress Multi-bar & Labor Muster Trends) */}
          <div className="p-5 bg-surface rounded-2xl border border-border shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div>
                <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                  <span>Execution Analytics & Labor Trends</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Visual milestone velocity comparison & weekly site workforce turnout
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                Weekly Metrics
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Chart A: Multi-Project Stage Progress Bars */}
              <div className="p-4 bg-brand-50/50 rounded-xl border border-border space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-text-main">
                  <span>Site Milestone Progress</span>
                  <span className="text-indigo-600 font-mono text-[11px]">4 Sites</span>
                </div>

                <div className="space-y-3">
                  {chartProjects.map((p, idx) => {
                    const prog = calculateProgress(p.stages || []);
                    const colors = ['bg-indigo-600', 'bg-emerald-600', 'bg-purple-600', 'bg-sky-600'];
                    return (
                      <div key={p.id} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-text-main truncate max-w-[180px]">
                            {p.name}
                          </span>
                          <span className="font-mono text-text-muted font-bold">{prog}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className={`h-full rounded-full ${colors[idx % colors.length]}`}
                            style={{ width: `${prog}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chart B: Weekly Site Turnout Area Graphic (SVG curve with solid fill) */}
              <div className="p-4 bg-brand-50/50 rounded-xl border border-border flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs font-bold text-text-main mb-2">
                  <span>Weekly Attendance Muster</span>
                  <span className="text-emerald-700 font-semibold text-[11px]">96% Avg Turnout</span>
                </div>

                {/* SVG Attendance Curve (Solid Tint, No Gradient) */}
                <div className="relative h-28 w-full mt-2">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 300 100" preserveAspectRatio="none">
                    {/* Area fill - clean solid emerald light tint */}
                    <path
                      d="M 0 80 Q 50 30, 100 45 T 200 20 T 300 15 L 300 100 L 0 100 Z"
                      fill="#d1fae5"
                      opacity="0.6"
                    />
                    {/* Stroke line */}
                    <path
                      d="M 0 80 Q 50 30, 100 45 T 200 20 T 300 15"
                      fill="none"
                      stroke="#059669"
                      strokeWidth="2.5"
                    />
                    {/* Data Points */}
                    <circle cx="0" cy="80" r="3.5" fill="#059669" />
                    <circle cx="75" cy="40" r="3.5" fill="#059669" />
                    <circle cx="150" cy="35" r="3.5" fill="#059669" />
                    <circle cx="225" cy="18" r="3.5" fill="#059669" />
                    <circle cx="300" cy="15" r="3.5" fill="#059669" />
                  </svg>
                </div>

                {/* Day Labels */}
                <div className="flex items-center justify-between text-[10px] text-text-muted font-mono font-medium pt-2 border-t border-border/80">
                  <span>Mon (4)</span>
                  <span>Tue (4)</span>
                  <span>Wed (4)</span>
                  <span>Thu (4)</span>
                  <span>Today (4)</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Recent Milestone Hand-offs & Site Execution Activity */}
          <div className="p-5 bg-surface rounded-2xl border border-border shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-3">
              <div>
                <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                  <span>Recent Milestone Hand-offs & Site Activity</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Live trade transitions, stage completions, and site approvals
                </p>
              </div>

              <Link
                to="/projects"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline-offset-2 hover:underline"
              >
                View All Sites →
              </Link>
            </div>

            {recentHandOffs.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-muted bg-brand-50/50 rounded-xl">
                No recent stage hand-offs recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recentHandOffs.map((item, idx) => (
                  <div
                    key={`${item.projectId}-${item.stageName}-${idx}`}
                    className="p-3.5 rounded-xl border border-border/80 bg-surface hover:border-brand-300 transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon name="check-circle" size={16} className="text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-text-main truncate">
                            {item.projectName}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {item.stageName}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">
                          Stage completed & verified snag-free for next trade handover.
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-text-muted mt-1.5 flex-wrap">
                          <span className="flex items-center gap-1 font-medium text-brand-700">
                            <Icon name="wrench" size={11} />
                            {item.agencyName}
                          </span>
                          {item.clientName && (
                            <>
                              <span>•</span>
                              <span>Client: {item.clientName}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{item.date}</span>
                        </div>
                      </div>
                    </div>

                    <Link
                      to={`/projects/${item.projectId}`}
                      className="self-end sm:self-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 hover:bg-slate-100 text-text-main border border-border transition-colors shrink-0"
                    >
                      Site Details →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col wide): Overall Portfolio Progress + Today Attendance + Operational Notes */}
        <div className="space-y-6">
          {/* OVERALL PORTFOLIO PROGRESS: Fluid Organic Progress Visualizer */}
          <OverallProgressGraph
            percentage={overallPortfolioStats.percentage}
            activeCount={overallPortfolioStats.activeCount}
            completedCount={overallPortfolioStats.completedCount}
            totalMilestones={overallPortfolioStats.totalMilestones}
            completedMilestones={overallPortfolioStats.completedMilestones}
          />

          {/* SECTION 4: Today All Employee Attendance (Who is currently present) */}
          <div className="p-5 bg-surface rounded-2xl border border-border shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div>
                <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Staff Attendance (Today)</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Live GPS geofenced check-in muster roll
                </p>
              </div>

              <Link
                to="/attendance"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline-offset-2 hover:underline"
              >
                View Muster →
              </Link>
            </div>

            {/* Attendance quick metrics */}
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                <Icon name="check-circle" size={15} className="text-emerald-600" />
                <span>Attendance Status</span>
              </span>
              <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                {presentCount} / {totalStaffCount} On Duty
              </span>
            </div>

            {attendance.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-muted bg-brand-50/50 rounded-xl">
                No attendance records logged today.
              </div>
            ) : (
              <div className="space-y-3">
                {attendance.map((record) => (
                  <div
                    key={record.id}
                    className="p-3 rounded-xl border border-border/80 bg-surface flex items-center justify-between gap-3 hover:border-emerald-300 transition-colors shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={record.userName} size="sm" status="online" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-text-main truncate">
                          {record.userName}
                        </div>
                        <div className="text-[11px] text-text-muted truncate">
                          {record.site}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          <span>Punched in: {record.checkInTime}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-brand-50 text-brand-700 border border-brand-200">
                        {record.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 5: Non-Technical Friendly Operational Guide (Solid Clean Background) */}
          <div className="p-4 rounded-2xl bg-brand-50/60 border border-brand-200/80 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-indigo-950">
              <Icon name="sparkles" size={16} className="text-indigo-600" />
              <span>Standard Operational Reminders</span>
            </div>
            <ul className="space-y-1.5 text-text-muted text-[11px] leading-relaxed pl-1">
              <li>• <strong>Site Safety:</strong> Hard hats and safety shoes must be worn on all active sites.</li>
              <li>• <strong>DSR Reports:</strong> Upload daily site photos before 06:00 PM.</li>
              <li>• <strong>Stage Milestones:</strong> Complete stages sequentially to prevent vendor clashes.</li>
              <li>• <strong>Fast Task Allocation:</strong> Click the <strong>+</strong> icon in the top navigation bar to assign urgent deliverables directly.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Task Allocation Modal Dialog */}
      <TaskAllocationModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onTaskAllocated={() => loadDashboardData()}
      />
    </div>
  );
}

export default DashboardPage;

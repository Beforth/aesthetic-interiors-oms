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
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [birthdayTab, setBirthdayTab] = useState('upcoming'); // 'upcoming' | 'all'
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

  // Birthday greeting toast trigger
  const handleSendBirthdayWishes = (empName) => {
    toast.success(`🎉 Birthday greetings and team card sent to ${empName}!`);
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

  // Current month & employee birthday calculations
  const now = new Date();
  const currentMonthIndex = now.getMonth(); // 0 = Jan, 9 = Oct
  const currentDay = now.getDate();
  const currentMonthName = now.toLocaleString('default', { month: 'long' });

  const currentMonthBirthdays = useMemo(() => {
    // Only internal personnel/employees (exclude clients)
    const staff = users.filter((u) => u.role !== 'client');

    const list = staff
      .map((emp) => {
        if (!emp.birthday) return null;
        const parts = emp.birthday.split('-');
        if (parts.length < 3) return null;
        const bMonth = parseInt(parts[1], 10) - 1;
        const bDay = parseInt(parts[2], 10);

        if (bMonth !== currentMonthIndex) return null;

        const isToday = bDay === currentDay;
        const isUpcoming = bDay >= currentDay;
        const daysRemaining = bDay - currentDay;

        return {
          ...emp,
          birthDay: bDay,
          isToday,
          isUpcoming,
          daysRemaining,
          formattedDate: `${now.toLocaleString('default', { month: 'short' })} ${bDay}`,
        };
      })
      .filter(Boolean);

    // Sort upcoming first by nearest day, then earlier celebrated days
    return list.sort((a, b) => {
      if (a.isUpcoming && !b.isUpcoming) return -1;
      if (!a.isUpcoming && b.isUpcoming) return 1;
      return a.birthDay - b.birthDay;
    });
  }, [users, currentMonthIndex, currentDay]);

  const upcomingBirthdays = useMemo(() => {
    return currentMonthBirthdays.filter((b) => b.isUpcoming);
  }, [currentMonthBirthdays]);

  const displayedBirthdays =
    birthdayTab === 'upcoming' ? upcomingBirthdays : currentMonthBirthdays;

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

      {/* 4 Fresh Clean Stat Cards - Solid Modern Styling */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <Icon name="attendance" size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-text-main">{presentStaff.length} Present</span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              100% On-Duty
            </span>
          </div>
          <p className="text-[11px] text-text-muted mt-1 truncate">
            All key site supervisors and artisans on-site
          </p>
        </div>

        {/* Card 4: Pending Tasks & Velocity (Amber) */}
        <div className="p-4 rounded-2xl bg-surface border border-border hover:border-amber-300 shadow-2xs transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Pending Tasks
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center">
              <Icon name="tasks" size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-text-main">{pendingTasks.length} Tasks</span>
            <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
              In Progress
            </span>
          </div>
          <p className="text-[11px] text-text-muted mt-1 truncate">
            {tasks.length - pendingTasks.length} tasks completed this sprint
          </p>
        </div>
      </div>

      {/* Main Grid: Left Column (Project Process + Graphs + Tasks), Right Column (Today's Attendance + Employee Birthdays + Operational Notes) */}
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
        </div>

        {/* Right Column (1 Col wide): Overall Portfolio Progress + Today Attendance + Employee Birthdays Tab + Operational Notes */}
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
                All Staff Present
              </span>
              <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                {presentStaff.length} / {presentStaff.length} On Duty
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

          {/* SECTION 5: Employee Birthdays This Month Tab Component */}
          <div className="p-5 bg-surface rounded-2xl border border-border shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/80 pb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                  <Icon name="cake" size={17} className="text-pink-600" />
                  <span>Employee Birthdays</span>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200">
                    {currentMonthName}
                  </span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Team members celebrating birthdays this month
                </p>
              </div>

              {/* Tab Selector: Upcoming vs All Month */}
              <div className="flex items-center gap-1 bg-brand-50 p-1 rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setBirthdayTab('upcoming')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    birthdayTab === 'upcoming'
                      ? 'bg-surface text-brand-700 shadow-2xs'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  Upcoming ({upcomingBirthdays.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBirthdayTab('all')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    birthdayTab === 'all'
                      ? 'bg-surface text-brand-700 shadow-2xs'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  All ({currentMonthBirthdays.length})
                </button>
              </div>
            </div>

            {/* Birthdays List */}
            {displayedBirthdays.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-muted bg-brand-50/50 rounded-xl space-y-1">
                <Icon name="cake" size={24} className="mx-auto text-text-muted/60 mb-1" />
                <p className="font-semibold text-text-main">
                  {birthdayTab === 'upcoming'
                    ? `No more upcoming birthdays in ${currentMonthName}.`
                    : `No employee birthdays scheduled for ${currentMonthName}.`}
                </p>
                <p className="text-[11px] text-text-muted">
                  Birthday celebrations for all staff members will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedBirthdays.map((emp) => (
                  <div
                    key={emp.id}
                    className={`p-3 rounded-xl border transition-colors shadow-2xs flex items-center justify-between gap-3 ${
                      emp.isToday
                        ? 'bg-emerald-50/60 border-emerald-300'
                        : emp.isUpcoming
                        ? 'bg-surface border-border hover:border-pink-300'
                        : 'bg-brand-50/30 border-border/70 opacity-80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={emp.name} size="sm" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-text-main truncate flex items-center gap-1.5">
                          <span>{emp.name}</span>
                          {emp.isToday && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-bold animate-pulse">
                              Today! 🎉
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-text-muted truncate">
                          {emp.title || emp.role?.replace('_', ' ').toUpperCase()}
                        </div>
                        <div className="text-[11px] font-semibold mt-0.5 flex items-center gap-1 text-pink-700">
                          <Icon name="cake" size={12} className="text-pink-600 shrink-0" />
                          <span>{emp.formattedDate}</span>
                          {emp.isUpcoming && !emp.isToday && (
                            <span className="text-[10px] text-brand-700 font-medium ml-0.5">
                              • in {emp.daysRemaining} day{emp.daysRemaining > 1 ? 's' : ''}
                            </span>
                          )}
                          {!emp.isUpcoming && (
                            <span className="text-[10px] text-text-muted font-normal ml-0.5">
                              • Celebrated
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSendBirthdayWishes(emp.name)}
                      title={`Send birthday greetings to ${emp.name}`}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 transition-colors shrink-0 flex items-center gap-1"
                    >
                      <Icon name="gift" size={12} />
                      <span>Wish 🎉</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 6: Non-Technical Friendly Operational Guide (Solid Clean Background) */}
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

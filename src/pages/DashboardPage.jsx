import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/projectService';
import { attendanceService } from '../services/attendanceService';
import { userService } from '../services/userService';
import { dashboardService } from '../services/dashboardService';
import { formatCurrency } from '../utils/formatters';
import { calculateProgress } from '../utils/progress';
import { cn } from '../lib/utils';
import { mockUsers } from '../data/users';

import Icon from '../components/ui/Icon';
import Button from '../components/ui/Button';
import { Avatar } from '../components/ui/avatar';
import Modal from '../components/ui/Modal';
import TaskAllocationModal from '../components/common/TaskAllocationModal';
import { Building2Icon, CalendarCheckIcon, TrendingIcon, TriangleAlertIcon, CalendarIcon } from '../components/ui/icons';
import Card from '../components/ui/Card';
import ProjectStems from '../components/domain/dashboard/ProjectStems';
import StatCard from '../components/ui/StatCard';
import HRWorkforceOverview from '../components/domain/HRWorkforceOverview';
import HolidaySpotlight from '../components/domain/HolidaySpotlight';
import ProjectList from '../components/domain/dashboard/ProjectList';

const HEADER_ACTION_CLASS =
  'inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full bg-card text-foreground border border-border hover:border-brand-300 transition-colors cursor-pointer';

const isPresent = (a) => {
  const s = String(a.status || '').toLowerCase();
  const hasPunch = Boolean(a.checkInTime && a.checkInTime !== '-' && a.checkInTime !== '—');
  return s === 'present' || s === 'late' || s === 'overtime' || s === 'half-day' || hasPunch;
};

/** Rupees in a few characters: lakhs and crores. */
const shortRupees = (v) => (v >= 10000000 ? `₹${(v / 10000000).toFixed(2)} Cr` : v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : formatCurrency(v));

export function DashboardPage() {
  const { currentUser, role, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [users, setUsers] = useState(mockUsers);
  const [loading, setLoading] = useState(true);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isBirthdaysModalOpen, setIsBirthdaysModalOpen] = useState(false);

  const loadDashboardData = async () => {
    try {
      const [projList, attList, userList, summary] = await Promise.all([
        projectService.getAllProjects(currentUser),
        attendanceService.getTodayAttendance(),
        userService.getAllUsers(),
        dashboardService.getSummary().catch(() => null),
      ]);
      setProjects(projList || []);
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

  // Metric computations
  const activeProjects = useMemo(() => {
    return projects.filter((p) => p.status !== 'completed' && p.status !== 'done');
  }, [projects]);

  const completedProjects = useMemo(() => {
    return projects.filter((p) => p.status === 'completed' || p.status === 'done');
  }, [projects]);

  const totalStaffCount = useMemo(() => {
    return attendance.length > 0 ? attendance.length : users.filter((u) => u.role !== 'client').length;
  }, [attendance, users]);

  const presentCount = useMemo(() => attendance.filter(isPresent).length, [attendance]);

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

  // ---------------------------------------------------------------- figures for the charts
  const liveProjects = useMemo(
    () =>
      activeProjects.map((p) => {
        const target = p.targetDate || p.endDate || '';
        const days = target ? Math.round((new Date(`${target}T00:00:00`) - new Date(new Date().toDateString())) / 86400000) : null;
        return { id: p.id, name: p.name, client: p.clientName || 'Private client', progress: calculateProgress(p.stages || []), cost: Number(p.totalCost || p.budget || 0), target, days };
      }),
    [activeProjects]
  );

  const portfolio = useMemo(() => {
    const stages = activeProjects.flatMap((p) => p.stages || []);
    const done = stages.filter((s) => s.status === 'done' || s.status === 'completed').length;
    const average = liveProjects.length ? Math.round(liveProjects.reduce((sum, p) => sum + p.progress, 0) / liveProjects.length) : projects.length ? 100 : 0;
    return { average, stagesDone: done, stagesTotal: stages.length, value: liveProjects.reduce((sum, p) => sum + p.cost, 0) };
  }, [activeProjects, liveProjects, projects.length]);

  const overdue = useMemo(() => liveProjects.filter((p) => p.days !== null && p.days < 0).sort((a, b) => a.days - b.days), [liveProjects]);
  const upcoming = useMemo(() => liveProjects.filter((p) => p.days !== null && p.days >= 0).sort((a, b) => a.days - b.days), [liveProjects]);

  const chartItems = liveProjects
    .slice()
    .sort((a, b) => (a.target || '9999').localeCompare(b.target || '9999'))
    .map((p) => ({ id: p.id, name: p.name, value: p.progress }));
  const chartTop = Math.min(100, Math.max(20, Math.ceil(Math.max(0, ...chartItems.map((item) => item.value)) / 20) * 20));

  const userFirstName = currentUser?.name ? currentUser.name.trim().split(/\s+/)[0] : 'Partner';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayText = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const attendancePercent = totalStaffCount ? Math.round((presentCount / totalStaffCount) * 100) : 0;
  const canSeeProjects = hasPermission('projects.viewAll');
  const canSeeAttendance = hasPermission('attendance.viewBoard');
  const canSeeHr = hasPermission('dashboard.hrOverview');

  const daysText = (days) => (days === 0 ? 'Due today' : days === 1 ? '1 day left' : `${days} days left`);

  return (
    <div className="rise space-y-4">
      {/* Greeting, the date and the main actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">
            {greeting}, <span className="text-primary">{userFirstName}</span>
          </h1>
          <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <CalendarIcon className="size-3.5 text-primary" />
            {todayText}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasPermission('attendance.markOwn') && (
            <Link to="/attendance" className={HEADER_ACTION_CLASS}>
              <span className="size-2 rounded-full bg-success" />
              <span>Mark Attendance</span>
            </Link>
          )}
          {hasPermission('tasks.create') && (
            <Button variant="primary" size="sm" leadingIcon="plus" onClick={() => setIsTaskModalOpen(true)}>
              Allocate Task
            </Button>
          )}
        </div>
      </div>

      {/* Headline figures; the first is filled blue */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {canSeeProjects && (
          <StatCard
            label="Work done"
            icon={<TrendingIcon />}
            value={`${portfolio.average}%`}
            progress={portfolio.average}
            onClick={() => navigate('/projects')}
          />
        )}
        {canSeeProjects && (
          <StatCard
            label="Live sites"
            icon={<Building2Icon />}
            value={activeProjects.length}
            subtext={`${shortRupees(portfolio.value)} in contracts`}
            onClick={() => navigate('/projects')}
          />
        )}
        {canSeeAttendance && (
          <StatCard
            label="Present today"
            icon={<CalendarCheckIcon />}
            value={`${presentCount}/${totalStaffCount}`}
            subtext={`${attendancePercent}% of staff`}
            onClick={() => navigate('/attendance')}
          />
        )}
        {canSeeProjects && (
          <StatCard
            label="Overdue sites"
            icon={<TriangleAlertIcon />}
            value={overdue.length}
            subtext={overdue.length ? `Oldest by ${Math.abs(overdue[0].days)} days` : 'All on time'}
            subtextClassName={overdue.length ? 'text-destructive' : ''}
            onClick={() => navigate('/projects')}
          />
        )}
      </div>

      {/* Every live site against the average */}
      {canSeeProjects && (
        <Card title="Site progress" subtitle={`Blue sites are at or above the ${portfolio.average}% average`}>
          {chartItems.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">{loading ? 'Loading sites…' : 'No live sites yet.'}</p>
          ) : (
            <ProjectStems
              items={chartItems}
              max={chartTop}
              average={portfolio.average}
              format={(v) => `${Math.round(v)}%`}
              onSelect={(item) => navigate(`/projects/${item.id}`)}
            />
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {canSeeProjects && (
          <ProjectList
            title="Next handovers"
            projects={upcoming}
            empty="No handovers coming up."
            chip={(p) => daysText(p.days)}
          />
        )}

        {canSeeProjects && (
          <ProjectList
            title="Needs attention"
            tone="bad"
            projects={overdue}
            empty="Nothing is overdue."
            chip={(p) => `${Math.abs(p.days)}d late`}
          />
        )}

        {(canSeeHr || hasPermission('dashboard.birthdays')) && (
          <div className="flex flex-col gap-4">
            {canSeeHr && <HolidaySpotlight />}
          {hasPermission('dashboard.birthdays') && (
            <Card
              className="flex-1"
              title={`Birthdays in ${currentMonthName}`}
              headerAction={
                monthlyBirthdays.length > 0 && (
                  <button type="button" onClick={() => setIsBirthdaysModalOpen(true)} className="cursor-pointer text-xs font-semibold text-primary hover:underline">
                    View all
                  </button>
                )
              }
            >
              {monthlyBirthdays.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No birthdays in {currentMonthName}.</p>
              ) : (
                <ul className="space-y-1">
                  {monthlyBirthdays.slice(0, 3).map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5">
                      <span className="flex min-w-0 items-center gap-2">
                        <Avatar name={u.name} size="sm" className="shrink-0" />
                        <span className="truncate text-[13px] font-semibold text-foreground">{u.name}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {u.birthDay === todayDate ? 'Today' : u.displayDate}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          </div>
        )}
      </div>

      {canSeeHr && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Workforce &amp; HR</h2>
          <HRWorkforceOverview users={users} onDataRefresh={loadDashboardData} />
        </div>
      )}

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
              No birthdays found for {currentMonthName}.
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

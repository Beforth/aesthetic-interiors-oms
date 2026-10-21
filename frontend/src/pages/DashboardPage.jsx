import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES, ROLE_LABELS } from '../config/roles';
import { projectService } from '../services/projectService';
import { taskService } from '../services/taskService';
import { attendanceService } from '../services/attendanceService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { calculateProgress } from '../utils/progress';

import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import Card from '../components/ui/Card';
import StatusBadge from '../components/ui/StatusBadge';
import ProgressBar from '../components/ui/ProgressBar';
import Avatar from '../components/ui/Avatar';
import Icon from '../components/ui/Icon';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';

export function DashboardPage() {
  const { currentUser, role } = useAuth();

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [projList, taskList, attList] = await Promise.all([
          projectService.getAllProjects(currentUser),
          taskService.getAllTasks(),
          attendanceService.getTodayAttendance(),
        ]);
        setProjects(projList || []);
        setTasks(taskList || []);
        setAttendance(attList || []);
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, [currentUser]);

  const isSupervisorOrWorker = role === ROLES.SUPERVISOR || role === ROLES.WORKER;

  // Filter tasks if worker/supervisor
  const displayedTasks = isSupervisorOrWorker
    ? tasks.filter((t) => t.assignedToId === currentUser?.id || role === ROLES.SUPERVISOR).slice(0, 5)
    : tasks.slice(0, 5);

  const activeProjects = projects.filter((p) => p.status === 'in progress');

  const totalContractValuation = activeProjects.reduce(
    (acc, p) => acc + (p.totalCost || p.budget || 0),
    0
  );

  const pendingTasksCount = tasks.filter((t) => t.status !== 'done').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${currentUser?.name || 'Administrator'}`}
        subtitle={`Role: ${ROLE_LABELS[role] || role} • Operations overview for Aesthetic Interiors`}
      />

      {/* 4 StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isSupervisorOrWorker ? (
          <>
            <StatCard
              title="Assigned Sites"
              value={`${projects.length} Active`}
              icon="projects"
              trend={projects.length > 0 ? `${projects.length} site(s) allocated` : 'No sites assigned yet'}
              trendDirection={projects.length > 0 ? 'up' : 'neutral'}
            />
            <StatCard
              title="My Tasks"
              value={`${displayedTasks.length} Assigned`}
              icon="tasks"
              trend={displayedTasks.length > 0 ? `${displayedTasks.length} active task(s)` : 'No pending tasks'}
              trendDirection={displayedTasks.length > 0 ? 'up' : 'neutral'}
            />
            <StatCard
              title="Today's Attendance"
              value={attendance.length > 0 ? 'Verified' : 'Pending'}
              icon="attendance"
              trend={attendance.length > 0 ? `${attendance.length} check-in(s) today` : 'No check-in logged'}
              trendDirection={attendance.length > 0 ? 'up' : 'neutral'}
            />
            <StatCard
              title="Active Role"
              value={ROLE_LABELS[role] || role}
              icon="hammer"
              trend={currentUser?.title || 'Site Operations'}
              trendDirection="neutral"
            />
          </>
        ) : (
          <>
            <StatCard
              title="Active Sites"
              value={`${activeProjects.length} Ongoing`}
              icon="projects"
              trend={activeProjects.length > 0 ? 'Ongoing site executions' : 'No active projects'}
              trendDirection={activeProjects.length > 0 ? 'up' : 'neutral'}
            />
            <StatCard
              title="Active Pipeline"
              value={formatCurrency(totalContractValuation)}
              icon="payments"
              trend={activeProjects.length > 0 ? 'Total contract valuation' : 'No active contracts'}
              trendDirection="neutral"
            />
            <StatCard
              title="Site Attendance"
              value={attendance.length > 0 ? `${attendance.length} Logged` : '0 Present'}
              icon="attendance"
              trend={attendance.length > 0 ? `${attendance.length} staff checked in today` : 'No records logged today'}
              trendDirection={attendance.length > 0 ? 'up' : 'neutral'}
            />
            <StatCard
              title="Active Tasks"
              value={`${pendingTasksCount} Pending`}
              icon="tasks"
              trend={pendingTasksCount > 0 ? `${pendingTasksCount} task(s) in progress` : 'All tasks completed'}
              trendDirection={pendingTasksCount > 0 ? 'neutral' : 'up'}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Tasks & Execution Progress */}
        <div className="lg:col-span-2 space-y-6">
          <Card
            title="Today's Site Tasks"
            subtitle="Prioritized trade checklists and supervisory inspections"
          >
            {displayedTasks.length === 0 ? (
              <EmptyState
                icon="tasks"
                title="No data available yet"
                description="No site tasks or checklists have been scheduled for today."
                className="py-8"
              />
            ) : (
              <div className="space-y-3">
                {displayedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded border border-border bg-surface hover:bg-brand-50 transition-colors gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-1 text-brand-500 shrink-0">
                        <Icon name="tasks" size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-main line-clamp-1">
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5 flex-wrap">
                          <span className="font-medium text-text-main">
                            {task.projectName}
                          </span>
                          <span>•</span>
                          <span className="text-brand-600 font-medium">
                            {task.stageName}
                          </span>
                          {task.dueDate && (
                            <>
                              <span>•</span>
                              <span>Due: {formatDate(task.dueDate)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                      <StatusBadge status={task.status} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Site Progress List with ProgressBar */}
          <Card
            title="Site Execution Progress"
            subtitle="Stage milestones and completion track across active properties"
          >
            {activeProjects.length === 0 ? (
              <EmptyState
                icon="projects"
                title="No data available yet"
                description="No fit-out projects are currently ongoing. Initiate a project from the Projects tab to track stage progress."
                className="py-8"
                action={
                  <Link to="/projects">
                    <Button variant="outline" size="sm">
                      Go to Projects
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-4">
                {activeProjects.map((project) => {
                  const currentStage =
                    project.stages?.find((s) => s.status === 'in progress') ||
                    project.stages?.[0];
                  const projProgress = calculateProgress(project.stages || []);

                  return (
                    <div
                      key={project.id}
                      className="p-3.5 rounded border border-border bg-surface"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-text-main">
                              {project.name}
                            </h4>
                            {project.clientName && (
                              <span className="text-xs text-text-muted">
                                ({project.clientName})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-muted mt-0.5">
                            Current Stage:{' '}
                            <span className="font-semibold text-brand-700">
                              {currentStage?.name || 'In Progress'}
                            </span>{' '}
                            {project.siteAddress && `• Location: ${project.siteAddress}`}
                          </p>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <span className="text-xs font-semibold text-text-main">
                            {formatCurrency(project.totalCost || project.budget)}
                          </span>
                          <div className="text-[11px] text-text-muted">Contract Value</div>
                        </div>
                      </div>

                      <ProgressBar
                        value={projProgress}
                        showLabel
                        label={`Progress: ${projProgress}%`}
                        color={projProgress > 70 ? 'success' : 'brand'}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Attendance Status & Operational Guidelines Card */}
        <div className="space-y-6">
          <Card
            title="Today's Site Attendance"
            subtitle="Live geo/site check-in log"
          >
            {attendance.length === 0 ? (
              <EmptyState
                icon="attendance"
                title="No data available yet"
                description="No site attendance records have been registered for today yet."
                className="py-8"
              />
            ) : (
              <div className="space-y-3">
                {attendance.map((record) => (
                  <div
                    key={record.id || record.userId}
                    className="p-3 rounded border border-border bg-surface flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={record.userName || 'Staff'} size="sm" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-text-main truncate">
                          {record.userName}
                        </div>
                        <div className="text-[11px] text-text-muted truncate">
                          {record.site}
                        </div>
                        <div className="text-[10px] text-brand-600 font-medium">
                          {record.role} • {record.checkInTime}
                        </div>
                      </div>
                    </div>

                    <StatusBadge status={record.status} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Directives Notice */}
          <Card title="Operational Directives">
            <div className="text-xs text-text-muted space-y-2.5 leading-relaxed">
              <p>
                • <strong>Safety protocol:</strong> Certified PPE, hard hats, and steel-toe footwear are mandatory across all active interior execution sites.
              </p>
              <p>
                • <strong>Daily logging:</strong> Supervisors and artisans must submit Daily Site Reports (DSR) and material inspection photos before 06:00 PM.
              </p>
              <p>
                • <strong>Material handoff:</strong> Verify consignment transit notes against supplier invoices prior to accepting site delivery.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;

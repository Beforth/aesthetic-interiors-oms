import { cn } from '../lib/utils';
import { TrashIcon, EyeIcon } from '../components/ui/icons';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { userService } from '../services/userService';
import { agencyService } from '../services/agencyService';
import { taskService } from '../services/taskService';
import { isDebug } from '../config/env';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePermission } from '../hooks/usePermission';
import { ROLES, ROLE_LABELS } from '../config/roles';
import { formatCurrency, formatDate } from '../utils/formatters';
import { calculateProgress, isStageLate, TODAY_STR } from '../utils/progress';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Tabs from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import StatusBadge from '../components/ui/StatusBadge';
import ProgressBar from '../components/ui/ProgressBar';
import DetailList from '../components/ui/DetailList';
import { Avatar } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Kanban } from '../components/ui/kanban';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import Icon from '../components/ui/Icon';
import TaskAllocationModal from '../components/common/TaskAllocationModal';
import StageTimeline from '../components/domain/StageTimeline';
import StageStatusControl from '../components/domain/StageStatusControl';
import AssigneePicker from '../components/domain/AssigneePicker';
import AgencySelect from '../components/domain/AgencySelect';
import PermissionGate from '../components/ui/PermissionGate';
import ConfirmDialog from '../components/ui/ConfirmDialog';


const DETAIL_TASK_KANBAN_COLUMNS = [
  { id: 'todo', title: 'To Do', tone: 'default' },
  { id: 'in progress', title: 'In Progress', tone: 'info' },
  { id: 'done', title: 'Completed', tone: 'success' },
];
export function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, role } = useAuth();
  const toast = useToast();

  // Permissions
  const canAssignPeople = usePermission('projects.assignPeople');
  const canEditDates = usePermission('stages.editDates');
  const canUpdateStatus = usePermission('stages.updateStatus');
  const canEditProjectStages = usePermission('stages.editProjectStages');
  const canManageTasks = usePermission('tasks.create');

  const [project, setProject] = useState(null);
  const [projectTasks, setProjectTasks] = useState([]);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stagePendingDelete, setStagePendingDelete] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Stage Edit Modal State
  const [editingStage, setEditingStage] = useState(null);
  const [stageFormData, setStageFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    agencyId: '',
    status: 'not started',
  });

  // Assign Team Modal State
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [teamForm, setTeamForm] = useState({
    supervisors: [],
    workers: [],
  });

  // Add Custom Stage Modal State
  const [isAddStageOpen, setIsAddStageOpen] = useState(false);
  const [newStageForm, setNewStageForm] = useState({
    name: '',
    startDate: '2026-10-20',
    endDate: '2026-10-30',
    agencyId: '',
  });

  // BefUI Kanban Board Data for Project Trade Tasks (Hook called unconditionally)
  const taskKanbanBoard = React.useMemo(() => {
    const board = {
      todo: [],
      'in progress': [],
      done: [],
    };
    (projectTasks || []).forEach((t) => {
      const s = (t.status || 'todo').toLowerCase();
      if (s === 'todo' || s === 'pending' || s === 'to do') {
        board.todo.push(t);
      } else if (s === 'done' || s === 'completed') {
        board.done.push(t);
      } else {
        board['in progress'].push(t);
      }
    });
    return board;
  }, [projectTasks]);

  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksLoaded, setTasksLoaded] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [proj, allUsers, allAgencies] = await Promise.all([
        projectService.getProjectById(id, currentUser),
        userService.getAllUsers(),
        agencyService.getAllAgencies(),
      ]);

      if (!proj) {
        toast.error('Project not found or access restricted');
        navigate('/projects');
        return;
      }

      setProject(proj);
      setUsers(allUsers);
      setAgencies(allAgencies);
      setTeamForm({
        supervisors: proj.supervisors || [],
        workers: proj.workers || [],
      });
    } catch (err) {
      toast.error('Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectTasks = async () => {
    if (!project) return;
    setTasksLoading(true);
    try {
      const allTasks = await taskService.getAllTasks().catch(() => []);
      const matched = (allTasks || []).filter(
        (t) => String(t.projectId) === String(id) || t.projectName === project.name
      );
      // the sample tasks are only for the standalone mock mode: with a backend, no tasks means none yet
      if (matched.length > 0 || !isDebug()) {
        setProjectTasks(matched);
      } else {
        const stagesList = project.stages || [];
        setProjectTasks([
          {
            id: `tsk-${id}-01`,
            projectId: id,
            projectName: project.name,
            stageName: stagesList[0]?.name || 'Site Prep',
            title: `${stagesList[0]?.name || 'Site Prep'} inspection & layout verification`,
            assignedToName: project.supervisors?.[0]?.name || users[0]?.name || 'Supervisor',
            status: 'done',
            priority: 'high',
            dueDate: '2026-10-18',
          },
          {
            id: `tsk-${id}-02`,
            projectId: id,
            projectName: project.name,
            stageName: stagesList[1]?.name || 'False Ceiling',
            title: `${stagesList[1]?.name || 'False Ceiling'} materials dispatch and frame alignment`,
            assignedToName: project.workers?.[0]?.name || users[1]?.name || 'Artisan',
            status: 'in progress',
            priority: 'high',
            dueDate: '2026-10-25',
          },
          {
            id: `tsk-${id}-03`,
            projectId: id,
            projectName: project.name,
            stageName: stagesList[2]?.name || 'Electrical & Wiring',
            title: `${stagesList[2]?.name || 'Electrical'} conduit checking and circuit load testing`,
            assignedToName: project.workers?.[1]?.name || users[2]?.name || 'Electrician',
            status: 'todo',
            priority: 'medium',
            dueDate: '2026-10-28',
          },
        ]);
      }
      setTasksLoaded(true);
    } catch (err) {
      console.warn('Failed to load project tasks:', err);
    } finally {
      setTasksLoading(false);
    }
  };

  // Secondary sub-tab data: load project tasks ONLY when the 'tasks' tab is opened
  useEffect(() => {
    if (activeTab === 'tasks' && !tasksLoaded && project) {
      fetchProjectTasks();
    }
  }, [activeTab, tasksLoaded, project]);

  useEffect(() => {
    fetchData();
  }, [id, currentUser]);

  if (loading || !project) {
    return (
      <div className="p-12 text-center text-xs text-text-muted">
        Loading project information...
      </div>
    );
  }

  const stages = project.stages || [];
  const progress = calculateProgress(stages);

  // Tabs config
  const projectTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'timeline', label: 'Stages & Timeline', count: stages.length },
    { id: 'dsr', label: 'Daily Reports' },
    { id: 'payments', label: 'Payments' },
  ];

  // Resolve team objects
  const assignedSupervisors = users.filter((u) =>
    (project.supervisors || []).includes(u.id)
  );
  const assignedWorkers = users.filter((u) =>
    (project.workers || []).includes(u.id)
  );



  const handleTaskBoardChange = async (nextBoard) => {
    if (!canManageTasks) {
      toast.error('Only authorized personnel (Admin, Manager, Supervisor) can update task progress');
      return;
    }
    for (const [targetColId, list] of Object.entries(nextBoard)) {
      for (const task of list) {
        const raw = (task.status || 'todo').toLowerCase();
        let prevCol = 'in progress';
        if (raw === 'todo' || raw === 'pending' || raw === 'to do') prevCol = 'todo';
        else if (raw === 'done' || raw === 'completed') prevCol = 'done';

        if (prevCol !== targetColId) {
          await handleTaskStatusChange(task.id, targetColId);
          return;
        }
      }
    }
  };
  // Handle task status progression for Kanban board
  const handleTaskStatusChange = async (taskId, newStatus) => {
    if (!canManageTasks) {
      toast.error('Only authorized personnel (Admin, Manager, Supervisor) can update task progress');
      return;
    }
    try {
      await taskService.updateTaskStatus(taskId, newStatus);
      setProjectTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
      toast.success(`Task progress updated to "${newStatus}"`);
    } catch (err) {
      toast.error('Failed to update task status');
    }
  };

  // Handle stage status click for Supervisor / Worker
  const handleQuickStatusChange = async (stage, newStatus) => {
    // Optimistically update local project state immediately so the color reflects instantly!
    setProject((prev) => {
      if (!prev) return prev;
      const nextStages = (prev.stages || []).map((s) =>
        String(s.id) === String(stage.id) ? { ...s, status: newStatus } : s
      );
      return { ...prev, stages: nextStages };
    });

    try {
      const updated = await projectService.updateStageStatus(
        project.id,
        stage.id,
        newStatus
      );
      if (updated) {
        setProject({ ...updated });
      }
      toast.success(`${stage.name} status updated to "${newStatus === 'done' ? 'Complete' : newStatus === 'late' ? 'Late / Due' : newStatus === 'in progress' ? 'In Progress' : 'Not Started'}"`);
    } catch (err) {
      toast.error('Failed to update stage status');
    }
  };

  // Open Stage Modal
  const handleOpenEditStage = (stage) => {
    setEditingStage(stage);
    setStageFormData({
      name: stage.name,
      startDate: stage.startDate,
      endDate: stage.endDate,
      agencyId: stage.agencyId || 'internal',
      status: stage.status || 'not started',
    });
  };

  // Save Stage Modal
  const handleSaveStage = async (e) => {
    e.preventDefault();
    if (!editingStage) return;

    try {
      const selectedAgency = agencies.find((a) => a.id === stageFormData.agencyId);
      const agencyName =
        stageFormData.agencyId === 'internal'
          ? 'Internal Site Crew'
          : selectedAgency?.name || 'Unallocated Agency';

      const updated = await projectService.updateStageDetails(
        project.id,
        editingStage.id,
        {
          ...stageFormData,
          agencyName,
          agencyId: stageFormData.agencyId === 'internal' ? null : stageFormData.agencyId,
        }
      );
      setProject({ ...updated });
      setEditingStage(null);
      toast.success(`Stage ${stageFormData.name} updated successfully`);
    } catch (err) {
      toast.error('Failed to update stage');
    }
  };

  // Save Team Assignees
  const handleSaveTeam = async (e) => {
    e.preventDefault();
    try {
      const updated = await projectService.updateProject(project.id, {
        supervisors: teamForm.supervisors,
        workers: teamForm.workers,
      });
      setProject({ ...updated });
      setIsTeamModalOpen(false);
      toast.success('Project team assignments updated');
    } catch (err) {
      toast.error('Failed to update project team');
    }
  };

  // Add Stage for this project only
  const handleAddProjectStage = async (e) => {
    e.preventDefault();
    if (!newStageForm.name.trim()) return;

    const selectedAgency = agencies.find((a) => a.id === newStageForm.agencyId);
    const agencyName =
      newStageForm.agencyId === 'internal'
        ? 'Internal Site Crew'
        : selectedAgency?.name || 'Unallocated';

    const newStage = {
      id: `stg_${Date.now()}`,
      order: stages.length + 1,
      name: newStageForm.name.trim(),
      startDate: newStageForm.startDate,
      endDate: newStageForm.endDate,
      status: 'not started',
      agencyId: newStageForm.agencyId === 'internal' ? null : newStageForm.agencyId,
      agencyName,
    };

    const newStagesList = [...stages, newStage];
    const saved = await projectService.updateProjectStages(project.id, newStagesList);
    setProject((prev) => ({ ...prev, stages: saved?.stages || newStagesList }));
    setIsAddStageOpen(false);
    toast.success(`Added stage "${newStage.name}" to project!`);
  };

  // Delete Stage for this project only
  const handleDeleteStage = async () => {
    if (!stagePendingDelete) return;
    const { id: stageId, name: stageName } = stagePendingDelete;
    setStagePendingDelete(null);
    const filtered = stages.filter((s) => s.id !== stageId);
    const saved = await projectService.updateProjectStages(project.id, filtered);
    setProject((prev) => ({ ...prev, stages: saved?.stages || filtered }));
    toast.success(`Removed stage "${stageName}"`);
  };

  // Reorder Stages (move up/down)
  const handleMoveStage = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const reordered = [...stages];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    // Recalculate order index
    const updated = reordered.map((s, idx) => ({ ...s, order: idx + 1 }));
    const saved = await projectService.updateProjectStages(project.id, updated);
    setProject((prev) => ({ ...prev, stages: saved?.stages || updated }));
  };

  const overviewItems = [
    { label: 'Client Name', value: project.clientName, icon: 'user' },
    { label: 'Site Address', value: project.siteAddress, icon: 'mapPin' },
    { label: 'Commencement Date', value: formatDate(project.startDate), icon: 'calendar' },
    { label: 'Target Handover', value: formatDate(project.targetDate), icon: 'clock' },
    {
      label: 'Estimated Cost (INR)',
      value: formatCurrency(project.totalCost),
      icon: 'payments',
    },
    {
      label: 'Execution Status',
      value: <StatusBadge status={project.status || 'in progress'} size="sm" />,
      icon: 'check-circle',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title={project.name}
        breadcrumbs={[
          { label: 'Projects', path: '/projects' },
          { label: project.name },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            leadingIcon="arrow-left"
            onClick={() => navigate('/projects')}
          >
            All Projects
          </Button>
        }
      />

      {/* Navigation Tabs */}
      <Tabs
        tabs={projectTabs}
        activeTab={activeTab}
        onChange={(tabId) => {
          if (tabId === 'dsr') {
            navigate(`/daily-reports?search=${encodeURIComponent(project?.name || '')}`);
            return;
          }
          if (tabId === 'payments') {
            navigate(`/payments/received?project=${project?.id || 'P1'}`);
            return;
          }
          setActiveTab(tabId);
        }}
        className="bg-surface rounded-t border px-2"
      />

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Progress Card */}
          <Card title="Project Overall Progress">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  Averaged Across 12 Stages: <strong className="text-primary font-bold">{progress}%</strong>
                </span>
              </div>
              <ProgressBar
                value={progress}
                showLabel={false}
                size="lg"
                color={progress > 70 ? 'success' : 'primary'}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted pt-2 border-t border-border">
                <span>
                  Total Stages: <strong className="text-text-main">{stages.length}</strong>
                </span>
                <span>
                  Complete:{' '}
                  <strong className="text-success">
                    {stages.filter((s) => s.status === 'done' || s.status === 'completed' || s.status === 'complete').length}
                  </strong>
                </span>
                <span>
                  In Progress:{' '}
                  <strong className="text-primary">
                    {stages.filter((s) => s.status === 'in progress').length}
                  </strong>
                </span>
                <span>
                  Late / Attention Needed:{' '}
                  <strong className="text-danger">
                    {stages.filter((s) => isStageLate(s)).length}
                  </strong>
                </span>
              </div>
            </div>
          </Card>

          {/* Details List */}
          <Card title="Site Contract & Specification Details">
            <DetailList items={overviewItems} columns={3} />
          </Card>

          {/* Assigned Team & Subcontractors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card
              title="Project Team Members"
              headerAction={
                canAssignPeople && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsTeamModalOpen(true)}
                  >
                    Edit
                  </Button>
                )
              }
            >
              <div className="space-y-4">
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                    Supervisors ({assignedSupervisors.length})
                  </h5>
                  {assignedSupervisors.length === 0 ? (
                    <p className="text-xs text-text-muted italic">No supervisor assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {assignedSupervisors.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-3 p-2 rounded bg-secondary border border-border"
                        >
                          <Avatar name={s.name} size="sm" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-foreground truncate">
                              {s.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {s.phone} • {s.title}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-border">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Workers & Artisans ({assignedWorkers.length})
                  </h5>
                  {assignedWorkers.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No workers assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {assignedWorkers.map((w) => (
                        <div
                          key={w.id}
                          className="flex items-center gap-3 p-2 rounded bg-secondary border border-border"
                        >
                          <Avatar name={w.name} size="sm" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-foreground truncate">
                              {w.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {w.phone} • {w.title}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <Card title="Allocated Trade Subcontractors">
              <div className="space-y-2">
                {stages
                  .filter((s) => s.agencyName && s.agencyName !== 'Unallocated Agency')
                  .slice(0, 5)
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2 rounded bg-card border border-border text-xs"
                    >
                      <div>
                        <span className="font-semibold text-foreground">{s.name}</span>
                        <div className="text-[11px] text-primary">{s.agencyName}</div>
                      </div>
                      <StatusBadge status={s.status} size="sm" />
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: STAGES & TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="pt-4 sm:pt-6 space-y-6 sm:space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
            <div>
              <h3 className="text-lg font-bold text-foreground">
                Stages Execution & Schedule
              </h3>
              
            </div>

            <div className="flex items-center gap-2">
              {canEditProjectStages && (
                <Button
                  variant="primary"
                  size="sm"
                  leadingIcon="plus"
                  onClick={() => setIsAddStageOpen(true)}
                >
                  Add Custom Stage
                </Button>
              )}
            </div>
          </div>

          {/* 1. Stage Timeline Gantt View */}
          <StageTimeline
            stages={stages}
            today={TODAY_STR}
            onStageClick={(stg) => {
              if (canEditDates || canEditProjectStages) {
                handleOpenEditStage(stg);
              }
            }}
          />

          {/* 2. Detailed Stages Table View */}
          <Card
            title="Stage Execution Management Table"
            subtitle="Track progress, scheduled dates, and assigned trade subcontractors"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <colgroup>
                  <col className="w-12 sm:w-14" />       {/* # */}
                  <col className="w-[28%]" />            {/* Stage Name */}
                  <col className="w-[22%]" />            {/* Allocated Agency */}
                  <col className="w-[14%]" />            {/* Start Date */}
                  <col className="w-[14%]" />            {/* Target End Date */}
                  <col className="w-[16%]" />            {/* Status */}
                  <col className="w-20" />               {/* Actions */}
                </colgroup>
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 pl-4 pr-2 text-center">#</th>
                    <th className="py-3 px-3">Stage Name</th>
                    <th className="py-3 px-3">Allocated Agency</th>
                    <th className="py-3 px-3">Start Date</th>
                    <th className="py-3 px-3">Target End Date</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 pl-2 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stages.map((stage, idx) => {
                    const rawStatus = (stage.status || 'not started').toLowerCase().trim();
                    const isDone = rawStatus === 'done' || rawStatus === 'completed' || rawStatus === 'complete';
                    const isExplicitLate = rawStatus === 'late' || rawStatus === 'due' || rawStatus === 'overdue' || rawStatus === 'late / due';
                    const isOverdue = !isDone && isStageLate(stage, TODAY_STR);
                    const isLate = isExplicitLate || isOverdue;
                    const isInProgress = (rawStatus === 'in progress' || rawStatus === 'in-progress') && !isExplicitLate;

                    const normalizedStatus = isDone
                      ? 'done'
                      : isExplicitLate
                      ? 'late'
                      : isInProgress
                      ? 'in progress'
                      : isOverdue
                      ? 'late'
                      : 'not started';

                    return (
                      <tr key={stage.id || idx} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 pl-4 pr-2 text-center">
                          <span className="font-mono text-[11px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                            #{stage.order || idx + 1}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground text-xs">{stage.name}</span>
                            {isLate && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
                                Late
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="text-xs text-muted-foreground font-medium">
                            {stage.agencyName || 'Unallocated'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-xs text-foreground whitespace-nowrap">
                          {formatDate(stage.startDate)}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-xs whitespace-nowrap">
                          <span className={isLate ? 'text-destructive font-bold' : 'text-foreground'}>
                            {formatDate(stage.endDate)}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {canUpdateStatus ? (
                            <select
                              value={normalizedStatus}
                              onChange={(e) => handleQuickStatusChange(stage, e.target.value)}
                              className={cn(
                                'text-xs font-semibold rounded-lg px-2.5 py-1.5 border transition-all cursor-pointer outline-none focus:ring-2 focus:ring-primary/20 shadow-2xs',
                                normalizedStatus === 'done'
                                  ? 'bg-success/15 text-success border-success/40 font-bold'
                                  : normalizedStatus === 'late'
                                  ? 'bg-destructive/15 text-destructive border-destructive/40 font-bold'
                                  : normalizedStatus === 'in progress'
                                  ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                                  : 'bg-muted/70 text-muted-foreground border-border'
                              )}
                            >
                              <option value="not started" className="bg-card text-foreground">Not Started</option>
                              <option value="in progress" className="bg-card text-foreground">In Progress</option>
                              <option value="late" className="bg-card text-destructive font-semibold">Late / Due</option>
                              <option value="done" className="bg-card text-foreground">Complete</option>
                            </select>
                          ) : (
                            <Badge
                              variant={
                                normalizedStatus === 'done'
                                  ? 'success'
                                  : normalizedStatus === 'late'
                                  ? 'danger'
                                  : normalizedStatus === 'in progress'
                                  ? 'primary'
                                  : 'neutral'
                              }
                              size="sm"
                              dot
                            >
                              {normalizedStatus === 'done'
                                ? 'COMPLETE'
                                : normalizedStatus === 'late'
                                ? 'LATE'
                                : normalizedStatus === 'in progress'
                                ? 'IN PROGRESS'
                                : 'NOT STARTED'}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3.5 pl-2 pr-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {(canEditDates || canEditProjectStages) && (
                              <button
                                type="button"
                                title="View & Edit Stage Details"
                                aria-label="View Stage"
                                onClick={() => handleOpenEditStage(stage)}
                                className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-muted transition-colors cursor-pointer"
                              >
                                <EyeIcon className="size-4" />
                              </button>
                            )}
                            {canEditProjectStages && stages.length > 1 && (
                              <button
                                type="button"
                                title="Delete Stage"
                                aria-label={`Remove ${stage.name}`}
                                className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                onClick={() => setStagePendingDelete({ id: stage.id, name: stage.name })}
                              >
                                <TrashIcon className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: DAILY REPORTS (Linked to Daily Reports in Side Navigation) */}
      {activeTab === 'dsr' && (
        <Card className="p-8 text-center space-y-4">
          <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Icon name="daily-reports" size={24} />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-foreground">
              Daily Reports for {project.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              View daily site work logs, supervisor updates, craftsperson attendance, and photo galleries for this project.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/daily-reports?search=${encodeURIComponent(project.name)}`)}
              className="flex items-center gap-1.5"
            >
              <span>Open Daily Reports</span>
              <Icon name="arrow-right" size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/reports')}
            >
              <span>View Reports Section</span>
            </Button>
          </div>
        </Card>
      )}

      {/* TAB 5: PAYMENTS (Linked to Payments Received in Side Navigation) */}
      {activeTab === 'payments' && (
        <Card className="p-8 text-center space-y-4">
          <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Icon name="payments" size={24} />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-foreground">
              Payments & Billing for {project.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              Manage client advances, installments, payment records, and payment proof attachments in Payments Received.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/payments/received?project=${project.id}`)}
              className="flex items-center gap-1.5"
            >
              <span>Go to Payments (Received)</span>
              <Icon name="arrow-right" size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/payments/pay')}
            >
              <span>View Labour & Agency Payouts</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Edit Stage Modal */}
      <Modal
        isOpen={!!editingStage}
        onClose={() => setEditingStage(null)}
        title={`Edit Stage: ${editingStage?.name}`}
        subtitle="Manage start and end dates and allocate subcontractor agencies (affects this project only)"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditingStage(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveStage}>
              Save Stage Details
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveStage} className="space-y-4">
          <Input
            label="Stage Title"
            required
            value={stageFormData.name}
            onChange={(e) =>
              setStageFormData({ ...stageFormData, name: e.target.value })
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              required
              value={stageFormData.startDate}
              onChange={(e) =>
                setStageFormData({ ...stageFormData, startDate: e.target.value })
              }
            />
            <Input
              label="Target Completion Date"
              type="date"
              required
              value={stageFormData.endDate}
              onChange={(e) =>
                setStageFormData({ ...stageFormData, endDate: e.target.value })
              }
            />
          </div>

          <AgencySelect
            label="Subcontractor Agency"
            agencies={agencies}
            value={stageFormData.agencyId}
            onChange={(agencyId) =>
              setStageFormData({ ...stageFormData, agencyId })
            }
            includeInternal
          />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-text-main">
              Execution Status
            </label>
            <select
              value={
                stageFormData.status === 'done' || stageFormData.status === 'completed'
                  ? 'done'
                  : stageFormData.status === 'in progress' || stageFormData.status === 'in-progress'
                  ? 'in progress'
                  : 'not started'
              }
              onChange={(e) => setStageFormData({ ...stageFormData, status: e.target.value })}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-2xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="not started">Not Started</option>
              <option value="in progress">In Progress</option>
              <option value="late">Late / Due</option>
              <option value="done">Complete</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* Assign Team Modal */}
      <Modal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        title="Assign Project Team"
        subtitle="Allocate site supervisors and craftsmen to this project site"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsTeamModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveTeam}>
              Save Assignments
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveTeam} className="space-y-4">
          <AssigneePicker
            label="Site Supervisors"
            roleFilter={ROLES.SUPERVISOR}
            users={users}
            value={teamForm.supervisors}
            onChange={(selected) =>
              setTeamForm({ ...teamForm, supervisors: selected })
            }
          />

          <AssigneePicker
            label="Site Workers & Lead Artisans"
            roleFilter={ROLES.WORKER}
            users={users}
            value={teamForm.workers}
            onChange={(selected) =>
              setTeamForm({ ...teamForm, workers: selected })
            }
          />
        </form>
      </Modal>

      {/* Add Custom Stage Modal */}
      <Modal
        isOpen={isAddStageOpen}
        onClose={() => setIsAddStageOpen(false)}
        title="Add Custom Project Stage"
        subtitle="Appends an extra stage for THIS project only"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsAddStageOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddProjectStage}>
              Add Stage to Project
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddProjectStage} className="space-y-4">
          <Input
            label="Stage Name"
            required
            placeholder="e.g. Bespoke Italian Granite Inlay"
            value={newStageForm.name}
            onChange={(e) =>
              setNewStageForm({ ...newStageForm, name: e.target.value })
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              required
              value={newStageForm.startDate}
              onChange={(e) =>
                setNewStageForm({ ...newStageForm, startDate: e.target.value })
              }
            />
            <Input
              label="End Date"
              type="date"
              required
              value={newStageForm.endDate}
              onChange={(e) =>
                setNewStageForm({ ...newStageForm, endDate: e.target.value })
              }
            />
          </div>

          <AgencySelect
            label="Allocate Agency"
            agencies={agencies}
            value={newStageForm.agencyId}
            onChange={(agencyId) =>
              setNewStageForm({ ...newStageForm, agencyId })
            }
            includeInternal
          />
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!stagePendingDelete}
        title="Remove stage?"
        message={`Remove "${stagePendingDelete?.name}" from this project timeline?`}
        confirmText="Remove"
        onConfirm={handleDeleteStage}
        onCancel={() => setStagePendingDelete(null)}
      />

      
    </div>
  );
}

export default ProjectDetailPage;

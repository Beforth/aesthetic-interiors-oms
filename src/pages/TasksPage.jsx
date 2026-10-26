import React, { useState, useEffect, useMemo } from 'react';
import { taskService } from '../services/taskService';
import { projectService } from '../services/projectService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLES } from '../config/roles';
import { formatDate } from '../utils/formatters';
import { validateRequired } from '../utils/validators';
import { cn } from '../lib/utils';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import SearchInput from '../components/ui/SearchInput';
import Select from '../components/ui/Select';
import StatusBadge from '../components/ui/StatusBadge';
import { Avatar } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Kanban } from '../components/ui/kanban';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import {
  KanbanIcon,
  ListIcon,
  PlusIcon,
  CameraIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '../components/ui/icons';

const TASK_KANBAN_COLUMNS = [
  { id: 'todo', title: 'To Do', tone: 'default' },
  { id: 'in progress', title: 'In Progress', tone: 'info' },
  { id: 'done', title: 'Completed', tone: 'success' },
];

export function TasksPage() {
  const toast = useToast();
  const { currentUser, hasPermission } = useAuth();
  const canCreate =
    hasPermission('tasks.create') ||
    currentUser?.role === ROLES.ADMIN ||
    currentUser?.role === ROLES.MANAGER ||
    currentUser?.role === ROLES.SUPERVISOR;

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // View & Density controls (Small cards default for high daily task volume)
  const [viewMode, setViewMode] = useState('board'); // 'board' or 'list'
  const [cardDensity, setCardDensity] = useState('compact'); // 'compact' (small) | 'comfortable'
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'site' or 'office'

  // Create Task Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectId: 'P1',
    stageName: 'Carpenter',
    assignedToId: '',
    type: 'site',
    priority: 'medium',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
  });

  // Photo Attachment Modal state
  const [photoTargetTask, setPhotoTargetTask] = useState(null);
  const [photoInputUrl, setPhotoInputUrl] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [allTasks, allProjects, allUsers] = await Promise.all([
        taskService.getAllTasks(),
        projectService.getAllProjects().catch(() => []),
        userService.getAllUsers().catch(() => []),
      ]);
      setTasks(allTasks);
      setProjects(allProjects);
      setUsers(allUsers);
      if (allUsers.length > 0 && !formData.assignedToId) {
        setFormData((prev) => ({ ...prev, assignedToId: allUsers[0].id }));
      }
    } catch (e) {
      toast.error('Failed to load tasks and assignees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        searchTerm === '' ||
        t.title?.toLowerCase().includes(q) ||
        t.projectName?.toLowerCase().includes(q) ||
        t.assignedToName?.toLowerCase().includes(q) ||
        t.stageName?.toLowerCase().includes(q);

      const matchesProject = projectFilter === 'ALL' || t.projectId === projectFilter;
      const matchesAssignee = assigneeFilter === 'ALL' || String(t.assignedToId) === String(assigneeFilter);
      const matchesType = typeFilter === 'ALL' || t.type === typeFilter;

      return matchesSearch && matchesProject && matchesAssignee && matchesType;
    });
  }, [tasks, searchTerm, projectFilter, assigneeFilter, typeFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = tasks.length;
    const siteCount = tasks.filter((t) => t.type === 'site').length;
    const officeCount = tasks.filter((t) => t.type === 'office').length;
    const overdueCount = tasks.filter((t) => t.isOverdue && t.status !== 'done').length;
    const completedCount = tasks.filter((t) => t.status === 'done').length;
    return { total, siteCount, officeCount, overdueCount, completedCount };
  }, [tasks]);

  // Create Task Submit
  const handleCreateTask = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const titleErr = validateRequired(formData.title, 'Task Title', 3);
    const projErr = validateRequired(formData.projectId, 'Assigned Project');
    const userErr = validateRequired(formData.assignedToId, 'Assigned Person');
    const dateErr = validateRequired(formData.dueDate, 'Due Date');

    if (titleErr || projErr || userErr || dateErr) {
      setFormErrors({
        title: titleErr,
        projectId: projErr,
        assignedToId: userErr,
        dueDate: dateErr,
      });
      toast.error(titleErr || projErr || userErr || dateErr);
      return;
    }
    setFormErrors({});

    try {
      const targetProj = projects.find((p) => p.id === formData.projectId);
      const targetUser = users.find((u) => String(u.id) === String(formData.assignedToId));

      await taskService.createTask({
        ...formData,
        projectName: targetProj?.name || 'Interior Site Fit-Out',
        assignedToName: targetUser?.name || 'Assigned Craftsman',
      });

      toast.success(`Task "${formData.title}" assigned successfully`);
      setIsModalOpen(false);
      setFormData({
        title: '',
        description: '',
        projectId: projects[0]?.id || 'P1',
        stageName: 'Carpenter',
        assignedToId: users[0]?.id || '',
        type: 'site',
        priority: 'medium',
        dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      });
      loadData();
    } catch (err) {
      toast.error('Failed to create task');
    }
  };

  // BefUI Kanban Board Data & Handlers
  const kanbanBoard = useMemo(() => {
    const board = {
      todo: [],
      'in progress': [],
      done: [],
    };
    filteredTasks.forEach((t) => {
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
  }, [filteredTasks]);

  const handleBoardChange = async (nextBoard) => {
    for (const [targetColId, list] of Object.entries(nextBoard)) {
      for (const task of list) {
        const raw = (task.status || 'todo').toLowerCase();
        let prevCol = 'in progress';
        if (raw === 'todo' || raw === 'pending' || raw === 'to do') prevCol = 'todo';
        else if (raw === 'done' || raw === 'completed') prevCol = 'done';

        if (prevCol !== targetColId) {
          await handleDropTask(task.id, targetColId);
          return;
        }
      }
    }
  };

  // Status advance handler
  const handleAdvanceStatus = async (task) => {
    const nextStatus =
      task.status === 'todo' ? 'in progress' : task.status === 'in progress' ? 'done' : 'todo';
    try {
      await taskService.updateTaskStatus(task.id, nextStatus);
      toast.success(`Task status moved to "${nextStatus}"`);
      loadData();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  // Drag and drop task status changer
  const handleDropTask = async (taskId, targetStatus) => {
    try {
      await taskService.updateTaskStatus(taskId, targetStatus);
      toast.success(`Task moved to "${targetStatus}"`);
      loadData();
    } catch (err) {
      toast.error('Failed to update task status');
    }
  };

  // Add Photo Attachment handler
  const handleAttachPhoto = async () => {
    if (!photoInputUrl.trim()) return;
    try {
      await taskService.attachPhoto(photoTargetTask.id, photoInputUrl.trim());
      toast.success('Inspection photo attached to task');
      setPhotoTargetTask(null);
      setPhotoInputUrl('');
      loadData();
    } catch (err) {
      toast.error('Failed to attach photo');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tasks & Site Checklist"
        subtitle="SRS Section 3.7 - Assign and track site trades and office deliverables with photo proofs"
        actions={
          <div className="flex items-center gap-2">
            {/* View Mode: Board vs List */}
            <div className="flex items-center border border-border rounded-lg bg-card p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('board')}
                className={cn(
                  'p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors',
                  viewMode === 'board'
                    ? 'bg-secondary text-foreground font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Kanban Board View"
              >
                <KanbanIcon className="size-3.5" />
                <span className="hidden sm:inline">Board</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors',
                  viewMode === 'list'
                    ? 'bg-secondary text-foreground font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Table List View"
              >
                <ListIcon className="size-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>

            {/* Density Selector for Board View */}
            {viewMode === 'board' && (
              <div className="flex items-center border border-border rounded-lg bg-card p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setCardDensity('compact')}
                  className={cn(
                    'px-2 py-1 rounded text-xs font-medium transition-colors',
                    cardDensity === 'compact'
                      ? 'bg-secondary text-foreground font-semibold shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Small compact cards (efficient for high volume of daily tasks)"
                >
                  Small
                </button>
                <button
                  type="button"
                  onClick={() => setCardDensity('comfortable')}
                  className={cn(
                    'px-2 py-1 rounded text-xs font-medium transition-colors',
                    cardDensity === 'comfortable'
                      ? 'bg-secondary text-foreground font-semibold shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Standard comfortable cards with photo previews"
                >
                  Comfortable
                </button>
              </div>
            )}

            {canCreate && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsModalOpen(true)}
              >
                <PlusIcon className="size-3.5 mr-1" />
                Create Task
              </Button>
            )}
          </div>
        }
      />

      {/* Filter Toolbar */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-1">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tasks, sites, assignees..."
            />
          </div>

          <div>
            <Select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Projects (All)' },
                ...projects.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </div>

          <div>
            <Select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Assignees' },
                ...users.map((u) => ({ value: String(u.id), label: `${u.name} (${u.role})` })),
              ]}
            />
          </div>

          <div>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Types (Site + Office)' },
                { value: 'site', label: 'Site Trade Tasks (FR-TSK-02)' },
                { value: 'office', label: 'Office & Design Tasks (FR-TSK-02)' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* VIEW 1: BefUI Kanban Board View */}
      {viewMode === 'board' ? (
        <Kanban
          columns={TASK_KANBAN_COLUMNS}
          value={kanbanBoard}
          onChange={handleBoardChange}
          density={cardDensity}
          onAdd={canCreate ? () => setIsModalOpen(true) : undefined}
          renderCard={(t) => {
            if (cardDensity === 'compact') {
              /* SMALL COMPACT CARD (< 68px tall) */
              return (
                <div className="space-y-1.5">
                  {/* Top micro line: Priority indicator + Stage chip + Overdue/Photos */}
                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {/* Priority indicator dot */}
                      <span
                        className={cn(
                          'size-2 rounded-full shrink-0',
                          t.priority === 'high'
                            ? 'bg-destructive ring-2 ring-destructive/20'
                            : t.priority === 'medium'
                            ? 'bg-warning ring-2 ring-warning/20'
                            : 'bg-muted-foreground/40'
                        )}
                        title={`Priority: ${t.priority || 'medium'}`}
                      />
                      <span className="font-medium text-secondary-foreground bg-secondary px-1.5 py-0.5 rounded text-[10px] truncate max-w-[100px]">
                        {t.stageName || t.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {t.photos && t.photos.length > 0 && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded"
                          title={`${t.photos.length} site proof photo(s)`}
                        >
                          <CameraIcon className="size-2.5" />
                          {t.photos.length}
                        </span>
                      )}
                      {t.isOverdue && (
                        <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1 py-0.5 rounded">
                          Overdue
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Task Title (Compact 1-2 lines) */}
                  <p className="font-semibold text-xs text-foreground leading-snug line-clamp-2">
                    {t.title}
                  </p>

                  {/* Project Name micro-text */}
                  {t.projectName && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {t.projectName}
                    </p>
                  )}

                  {/* Bottom micro-bar: Assignee + Fast Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/70 text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Avatar name={t.assignedToName || 'Artisan'} size="xs" className="size-5 text-[9px]" />
                      <span className="text-[10px] text-muted-foreground truncate max-w-[90px]">
                        {t.assignedToName?.split(' ')[0] || 'Artisan'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        title="Attach Photo Proof (FR-TSK-04)"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhotoTargetTask(t);
                          setPhotoInputUrl('https://images.unsplash.com/photo-1541123437800-1bb1317badc2?w=300');
                        }}
                      >
                        <CameraIcon className="size-3" />
                      </button>
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                        title="Advance status"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAdvanceStatus(t);
                        }}
                      >
                        {t.status === 'done' ? 'Reopen' : 'Next ›'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            /* COMFORTABLE (Expanded) CARD LAYOUT */
            return (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant={t.priority === 'high' ? 'danger' : 'default'} size="sm">
                    {t.stageName || t.type}
                  </Badge>
                  {t.isOverdue && (
                    <Badge variant="danger" size="sm">
                      Overdue
                    </Badge>
                  )}
                </div>

                <p className="font-semibold text-xs text-foreground leading-snug">
                  {t.title}
                </p>

                {t.projectName && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {t.projectName}
                  </p>
                )}

                {/* Photo Attachments preview (FR-TSK-04) */}
                {t.photos && t.photos.length > 0 && (
                  <div className="flex items-center gap-1.5 pt-1">
                    {t.photos.map((ph, idx) => (
                      <img
                        key={idx}
                        src={ph}
                        alt="Site proof"
                        className="w-8 h-8 rounded object-cover border border-border"
                      />
                    ))}
                    <span className="text-[10px] text-muted-foreground">
                      {t.photos.length} photo{t.photos.length > 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1.5 border-t border-border/70 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Avatar name={t.assignedToName || 'Artisan'} size="xs" />
                    <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">
                      {t.assignedToName || 'Artisan'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      title="Attach Photo Proof (FR-TSK-04)"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotoTargetTask(t);
                        setPhotoInputUrl('https://images.unsplash.com/photo-1541123437800-1bb1317badc2?w=300');
                      }}
                    >
                      <CameraIcon className="size-3" />
                    </button>
                    <button
                      type="button"
                      className="px-2 py-0.5 rounded text-[11px] font-medium bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                      title="Advance stage"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAdvanceStatus(t);
                      }}
                    >
                      {t.status === 'done' ? 'Reopen' : 'Next ›'}
                    </button>
                  </div>
                </div>
              </div>
            );
          }}
        />
      ) : (
        /* VIEW 2: Table List View */
        <Card>
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 text-muted-foreground uppercase font-semibold border-b border-border">
                <tr>
                  <th className="py-2.5 px-3">Task Details</th>
                  <th className="py-2.5 px-3">Project & Stage</th>
                  <th className="py-2.5 px-3">Assignee</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-2 px-3 font-semibold text-foreground max-w-sm">
                      <div className="truncate">{t.title}</div>
                      <div className="text-[11px] text-muted-foreground font-normal uppercase flex items-center gap-1.5 mt-0.5">
                        <span
                          className={cn(
                            'size-1.5 rounded-full inline-block',
                            t.priority === 'high'
                              ? 'bg-destructive'
                              : t.priority === 'medium'
                              ? 'bg-warning'
                              : 'bg-muted-foreground/40'
                          )}
                        />
                        {t.type} • Priority: {t.priority}
                        {t.photos && t.photos.length > 0 && (
                          <span className="text-muted-foreground font-mono inline-flex items-center gap-0.5">
                            • <CameraIcon className="size-2.5" /> {t.photos.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="text-foreground">{t.projectName}</div>
                      <div className="text-[11px] text-primary">{t.stageName || '-'}</div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={t.assignedToName} size="xs" />
                        <span className="text-foreground">{t.assignedToName}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 font-mono">
                      <span className={t.isOverdue ? 'text-destructive font-bold' : 'text-muted-foreground'}>
                        {t.dueDate || '-'}
                      </span>
                      {t.isOverdue && <span className="block text-[10px] text-destructive">Overdue</span>}
                    </td>
                    <td className="py-2 px-3">
                      <StatusBadge status={t.status} size="sm" />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          title="Attach photo proof"
                          onClick={() => {
                            setPhotoTargetTask(t);
                            setPhotoInputUrl('https://images.unsplash.com/photo-1541123437800-1bb1317badc2?w=300');
                          }}
                        >
                          <CameraIcon className="size-3.5" />
                        </button>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleAdvanceStatus(t)}
                        >
                          {t.status === 'done' ? 'Reopen' : 'Next ›'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Task Modal (FR-TSK-01 & FR-TSK-02) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Operational Task"
        subtitle="SRS Section 3.7: Assign deliverables to site craftsmen or office design team"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateTask}>
              Assign Task
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
          <Input
            label="Task Title / Snag Description"
            required
            error={formErrors.title}
            value={formData.title}
            onChange={(e) => {
              setFormData({ ...formData, title: e.target.value });
              if (formErrors.title) setFormErrors((prev) => ({ ...prev, title: null }));
            }}
            placeholder="e.g. Master bedroom veneer grain continuity inspection"
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Assigned Project"
              required
              error={formErrors.projectId}
              value={formData.projectId}
              onChange={(e) => {
                setFormData({ ...formData, projectId: e.target.value });
                if (formErrors.projectId) setFormErrors((prev) => ({ ...prev, projectId: null }));
              }}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
            />

            <Select
              label="Assignment Type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              options={[
                { value: 'site', label: 'Site Trade Task (On-Site)' },
                { value: 'office', label: 'Office Deliverable (Studio)' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Assigned Person (FR-TSK-01)"
              required
              error={formErrors.assignedToId}
              value={formData.assignedToId}
              onChange={(e) => {
                setFormData({ ...formData, assignedToId: e.target.value });
                if (formErrors.assignedToId) setFormErrors((prev) => ({ ...prev, assignedToId: null }));
              }}
              options={users.map((u) => ({
                value: String(u.id),
                label: `${u.name} (${u.role})`,
              }))}
            />

            <Input
              label="Stage / Trade"
              value={formData.stageName}
              onChange={(e) => setFormData({ ...formData, stageName: e.target.value })}
              placeholder="e.g. Carpenter, Ceiling, Plumbing"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Due Date (FR-TSK-07)"
              type="date"
              required
              error={formErrors.dueDate}
              value={formData.dueDate}
              onChange={(e) => {
                setFormData({ ...formData, dueDate: e.target.value });
                if (formErrors.dueDate) setFormErrors((prev) => ({ ...prev, dueDate: null }));
              }}
            />

            <Select
              label="Priority Level"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              options={[
                { value: 'low', label: 'Low Priority' },
                { value: 'medium', label: 'Medium Priority' },
                { value: 'high', label: 'High Priority (Urgent Snag)' },
              ]}
            />
          </div>
        </form>
      </Modal>

      {/* Attach Photo Modal (FR-TSK-04) */}
      <Modal
        isOpen={!!photoTargetTask}
        onClose={() => setPhotoTargetTask(null)}
        title="Attach Inspection Photo"
        subtitle={`Task: ${photoTargetTask?.title}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setPhotoTargetTask(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleAttachPhoto}>
              Upload Photo Proof
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <Input
            label="Photo URL or Cloudflare R2 Upload Path"
            required
            value={photoInputUrl}
            onChange={(e) => setPhotoInputUrl(e.target.value)}
            placeholder="https://... or photo data"
            helperText="SRS FR-TSK-04: Captures real-time workmanship proofs on mobile or desktop"
          />
          {photoInputUrl && (
            <div className="border border-border rounded-lg p-2 bg-muted/30 flex items-center justify-center">
              <img
                src={photoInputUrl}
                alt="Preview"
                className="max-h-40 rounded object-cover shadow-2xs"
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default TasksPage;

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import Select from '../components/ui/Select';
import StatusBadge from '../components/ui/StatusBadge';
import { Avatar } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Kanban } from '../components/ui/kanban';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Icon from '../components/ui/Icon';
import {
  KanbanIcon,
  ListIcon,
  PlusIcon,
  CameraIcon,
  SearchIcon,
  XIcon,
  CheckIcon,
  ChevronDownIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  ArrowLeftIcon,
} from '../components/ui/icons';

/**
 * BefUI Multi-Assignee Selector
 * Allows selecting multiple team members for a single task with search and visual chips.
 */
function FormMultiAssigneeSelect({ users = [], selectedIds = [], onChange, error }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getUserLabel = (u) => {
    if (!u) return '';
    const roleLower = String(u.role || '').toLowerCase();
    const isOwner = roleLower === 'owner' || roleLower === 'admin' || (u.name && u.name.toLowerCase().includes('rohit'));
    return isOwner ? `${u.name} (Admin)` : u.name;
  };

  const toggleUser = (userId) => {
    const strId = String(userId);
    if (selectedIds.includes(strId)) {
      onChange(selectedIds.filter((id) => id !== strId));
    } else {
      onChange([...selectedIds, strId]);
    }
  };

  const selectedUsers = users.filter((u) => selectedIds.includes(String(u.id)));

  const filteredUsers = users.filter((u) => {
    const text = getUserLabel(u).toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <div ref={ref} className="relative space-y-1.5">
      <label className="block text-xs font-medium text-foreground">
        Assignees (Multiple Allowed)
      </label>

      {/* Trigger Box */}
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'w-full min-h-[38px] rounded-lg border bg-background px-3 py-1.5 text-xs flex items-center justify-between text-left transition-colors cursor-pointer',
          error
            ? 'border-destructive ring-1 ring-destructive'
            : 'border-border hover:border-muted-foreground/40 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20'
        )}
      >
        <div className="flex items-center gap-1.5 flex-wrap flex-1 mr-2">
          {selectedUsers.length === 0 ? (
            <span className="text-muted-foreground">Select one or more assignees...</span>
          ) : (
            selectedUsers.map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium border border-border"
              >
                <Avatar name={u.name} size="xs" />
                <span>{getUserLabel(u)}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleUser(u.id);
                  }}
                  className="text-muted-foreground hover:text-foreground ml-0.5 cursor-pointer"
                  title="Remove"
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDownIcon
          className={cn('size-3.5 text-muted-foreground transition-transform shrink-0', isOpen && 'rotate-180')}
        />
      </div>

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-border bg-card text-card-foreground shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-1.5 border-b border-border bg-muted/30">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-background rounded-md border border-border">
              <SearchIcon className="size-3 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff to assign..."
                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-[190px] overflow-y-auto scrollbar-thin p-1 space-y-0.5">
            {filteredUsers.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground italic text-center">
                No matching personnel
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = selectedIds.includes(String(u.id));
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUser(u.id)}
                    className={cn(
                      'w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors',
                      isSelected ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar name={u.name} size="xs" />
                      <span>{getUserLabel(u)}</span>
                    </div>
                    <div
                      className={cn(
                        'size-4 rounded border flex items-center justify-center transition-colors',
                        isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                      )}
                    >
                      {isSelected && <CheckIcon className="size-3 stroke-[2.5]" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="p-2 border-t border-border bg-muted/20 flex items-center justify-between text-xs">
              <span className="text-[11px] text-muted-foreground font-medium">
                {selectedIds.length} person(s) assigned
              </span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[11px] text-destructive hover:underline font-semibold cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TASK_KANBAN_COLUMNS = [
  { id: 'todo', title: 'To Do', tone: 'default' },
  { id: 'in progress', title: 'In Progress', tone: 'info' },
  { id: 'done', title: 'Completed', tone: 'success' },
];

const STAGE_ORDER = {
  todo: 0,
  pending: 0,
  'to do': 0,
  'in progress': 1,
  'in-progress': 1,
  done: 2,
  completed: 2,
};

export function TasksPage() {
  const navigate = useNavigate();
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

  // View mode
  const [viewMode, setViewMode] = useState('board'); // 'board' or 'list'
  const cardDensity = 'comfortable';

  // Interconnected Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'on-site', 'office', 'meeting'

  // Create Task Form State (Stage / Trade removed, Multiple Assignees supported)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectId: 'P1',
    assignedToIds: [],
    type: 'on-site',
    priority: 'medium',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
  });

  // Photo Attachment Modal & Photo Viewer state
  const [photoTargetTask, setPhotoTargetTask] = useState(null);
  const [photoInputUrl, setPhotoInputUrl] = useState('');
  const [viewingPhotoTask, setViewingPhotoTask] = useState(null);

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
      if (allProjects.length > 0) {
        setFormData((prev) => ({
          ...prev,
          projectId: prev.projectId || allProjects[0]?.id || 'P1',
        }));
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

  // -------------------------------------------------------------
  // Interdependent Filter Options Computation
  // -------------------------------------------------------------

  // 1. Available Projects: narrowed by selected Assignee and/or Location
  const availableProjects = useMemo(() => {
    let filtered = projects;

    if (assigneeFilter !== 'ALL') {
      const userTaskProjIds = new Set(
        tasks
          .filter((t) => {
            const isSingle = String(t.assignedToId) === String(assigneeFilter);
            const isMulti = Array.isArray(t.assignedToIds) && t.assignedToIds.some((id) => String(id) === String(assigneeFilter));
            return isSingle || isMulti;
          })
          .map((t) => String(t.projectId))
      );

      filtered = projects.filter((p) => {
        const isSupervisor = Array.isArray(p.supervisors) && p.supervisors.some((id) => String(id) === String(assigneeFilter));
        const isWorker = Array.isArray(p.workers) && p.workers.some((id) => String(id) === String(assigneeFilter));
        const hasAssignedTask = userTaskProjIds.has(String(p.id));
        return isSupervisor || isWorker || hasAssignedTask;
      });
    }

    if (typeFilter !== 'ALL') {
      const projIdsWithType = new Set(
        tasks
          .filter((t) => {
            const norm = t.type === 'site' ? 'on-site' : t.type;
            const filterNorm = typeFilter === 'site' ? 'on-site' : typeFilter;
            return norm === filterNorm;
          })
          .map((t) => String(t.projectId))
      );
      if (projIdsWithType.size > 0) {
        filtered = filtered.filter((p) => projIdsWithType.has(String(p.id)));
      }
    }

    return filtered;
  }, [projects, tasks, assigneeFilter, typeFilter]);

  // 2. Available Assignees: narrowed by selected Project and/or Location
  const availableAssignees = useMemo(() => {
    let filtered = users;

    if (projectFilter !== 'ALL') {
      const targetProj = projects.find((p) => String(p.id) === String(projectFilter));
      const projSupervisors = targetProj?.supervisors || [];
      const projWorkers = targetProj?.workers || [];
      const taskUserIds = tasks
        .filter((t) => String(t.projectId) === String(projectFilter))
        .flatMap((t) => (Array.isArray(t.assignedToIds) && t.assignedToIds.length > 0 ? t.assignedToIds : [t.assignedToId]))
        .filter(Boolean);

      const validUserIds = new Set([
        ...projSupervisors.map(String),
        ...projWorkers.map(String),
        ...taskUserIds.map(String),
      ]);

      if (validUserIds.size > 0) {
        filtered = users.filter((u) => validUserIds.has(String(u.id)));
      }
    }

    if (typeFilter !== 'ALL') {
      const userIdsWithType = new Set(
        tasks
          .filter((t) => {
            const norm = t.type === 'site' ? 'on-site' : t.type;
            const filterNorm = typeFilter === 'site' ? 'on-site' : typeFilter;
            return norm === filterNorm;
          })
          .flatMap((t) => (Array.isArray(t.assignedToIds) && t.assignedToIds.length > 0 ? t.assignedToIds : [t.assignedToId]))
          .filter(Boolean)
          .map(String)
      );
      if (userIdsWithType.size > 0) {
        filtered = filtered.filter((u) => userIdsWithType.has(String(u.id)));
      }
    }

    return filtered;
  }, [users, projects, tasks, projectFilter, typeFilter]);

  // 3. Bidirectional Handlers for Cascading Filters
  const handleProjectChange = (newProjId) => {
    setProjectFilter(newProjId);
    if (newProjId !== 'ALL' && assigneeFilter !== 'ALL') {
      // If currently selected assignee is not in this project, reset assignee to ALL
      const targetProj = projects.find((p) => String(p.id) === String(newProjId));
      const projSupervisors = targetProj?.supervisors || [];
      const projWorkers = targetProj?.workers || [];
      const taskUserIds = tasks
        .filter((t) => String(t.projectId) === String(newProjId))
        .flatMap((t) => (Array.isArray(t.assignedToIds) ? t.assignedToIds : [t.assignedToId]))
        .filter(Boolean);
      const validSet = new Set([...projSupervisors.map(String), ...projWorkers.map(String), ...taskUserIds.map(String)]);
      if (!validSet.has(String(assigneeFilter))) {
        setAssigneeFilter('ALL');
      }
    }
  };

  const handleAssigneeChange = (newAssigneeId) => {
    setAssigneeFilter(newAssigneeId);
    if (newAssigneeId !== 'ALL' && projectFilter !== 'ALL') {
      // If currently selected project is not associated with this assignee, reset project to ALL
      const isAssociated = availableProjects.some((p) => String(p.id) === String(projectFilter));
      if (!isAssociated) {
        setProjectFilter('ALL');
      }
    }
  };

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setProjectFilter('ALL');
    setAssigneeFilter('ALL');
    setTypeFilter('ALL');
  };

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    projectFilter !== 'ALL' ||
    assigneeFilter !== 'ALL' ||
    typeFilter !== 'ALL'
  );

  // 4. Filtered Tasks Output
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // 1. Project match
      if (projectFilter !== 'ALL') {
        if (String(t.projectId) !== String(projectFilter)) return false;
      }

      // 2. Assignee match (matches single or any of multiple assignees)
      if (assigneeFilter !== 'ALL') {
        const isSingle = String(t.assignedToId) === String(assigneeFilter);
        const isMulti = Array.isArray(t.assignedToIds) && t.assignedToIds.some((id) => String(id) === String(assigneeFilter));
        if (!isSingle && !isMulti) return false;
      }

      // 3. Location match
      if (typeFilter !== 'ALL') {
        const norm = t.type === 'site' ? 'on-site' : t.type;
        const filterNorm = typeFilter === 'site' ? 'on-site' : typeFilter;
        if (norm !== filterNorm) return false;
      }

      // 4. Live Search match across task title, description, project name, or assignee names
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchTitle = t.title?.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchProj = t.projectName?.toLowerCase().includes(q);
        const matchSingle = t.assignedToName?.toLowerCase().includes(q);
        const matchMulti = Array.isArray(t.assignedToNames) && t.assignedToNames.some((n) => n.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchProj && !matchSingle && !matchMulti) return false;
      }

      return true;
    });
  }, [tasks, projectFilter, assigneeFilter, typeFilter, searchQuery]);

  // Create Task Submit (Stage/Trade removed, Multiple Assignees supported)
  const handleCreateTask = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const titleErr = validateRequired(formData.title, 'Task Title', 2);
    const projErr = validateRequired(formData.projectId, 'Assigned Project');
    const dateErr = validateRequired(formData.dueDate, 'Due Date');

    if (titleErr || projErr || dateErr) {
      setFormErrors({
        title: titleErr,
        projectId: projErr,
        dueDate: dateErr,
      });
      toast.error(titleErr || projErr || dateErr);
      return;
    }
    setFormErrors({});
    setCreatingTask(true);

    try {
      const targetProj = projects.find((p) => String(p.id) === String(formData.projectId));
      const selectedUsers = users.filter((u) => formData.assignedToIds.includes(String(u.id)));
      const assignedToNames = selectedUsers.map((u) => {
        const roleLower = String(u.role || '').toLowerCase();
        const isOwner = roleLower === 'owner' || roleLower === 'admin' || (u.name && u.name.toLowerCase().includes('rohit'));
        return isOwner ? `${u.name} (Admin)` : u.name;
      });
      const primaryName = assignedToNames.join(', ') || 'Unassigned';

      await taskService.createTask({
        title: formData.title.trim(),
        description: formData.description.trim(),
        projectId: formData.projectId,
        projectName: targetProj?.name || 'Interior Site Fit-Out',
        type: formData.type,
        priority: formData.priority,
        dueDate: formData.dueDate,
        assignedToIds: formData.assignedToIds,
        assignedToNames,
        assignedToId: formData.assignedToIds[0] || '',
        assignedToName: primaryName,
      });

      toast.success(`Task "${formData.title}" created successfully`);
      setIsModalOpen(false);
      setFormData({
        title: '',
        description: '',
        projectId: projects[0]?.id || 'P1',
        assignedToIds: [],
        type: 'on-site',
        priority: 'medium',
        dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      });
      loadData();
    } catch (err) {
      toast.error('Failed to create task');
    } finally {
      setCreatingTask(false);
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

  // Kanban Forward-Only Progression Handlers (No Backward Movement)
  const handleBoardChange = async (nextBoard) => {
    for (const [targetColId, list] of Object.entries(nextBoard)) {
      for (const task of list) {
        const raw = (task.status || 'todo').toLowerCase();
        let prevCol = 'in progress';
        if (raw === 'todo' || raw === 'pending' || raw === 'to do') prevCol = 'todo';
        else if (raw === 'done' || raw === 'completed') prevCol = 'done';

        if (prevCol !== targetColId) {
          const prevRank = STAGE_ORDER[prevCol] ?? 0;
          const targetRank = STAGE_ORDER[targetColId] ?? 0;

          // Enforce forward-only rule: cannot move backward
          if (targetRank < prevRank) {
            toast.error(
              'Tasks cannot be moved backward in the pipeline. Workflow only advances forward. Please create a new task if you need to restart.'
            );
            loadData(); // Revert board to previous state
            return;
          }

          await handleDropTask(task.id, targetColId);
          return;
        }
      }
    }
  };

  const handleDropTask = async (taskId, targetStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      const raw = (task.status || 'todo').toLowerCase();
      let prevCol = 'in progress';
      if (raw === 'todo' || raw === 'pending' || raw === 'to do') prevCol = 'todo';
      else if (raw === 'done' || raw === 'completed') prevCol = 'done';

      const prevRank = STAGE_ORDER[prevCol] ?? 0;
      const targetRank = STAGE_ORDER[targetStatus] ?? 0;

      if (targetRank < prevRank) {
        toast.error('Tasks cannot be moved backward. Workflow only advances forward.');
        loadData();
        return;
      }
    }

    try {
      await taskService.updateTaskStatus(taskId, targetStatus);
      toast.success(`Task moved forward to "${targetStatus}"`);
      loadData();
    } catch (err) {
      toast.error('Failed to update task status');
    }
  };

  // Status advance button handler (Forward-Only)
  const handleAdvanceStatus = async (task) => {
    const s = (task.status || 'todo').toLowerCase();
    let nextStatus = 'in progress';
    if (s === 'todo' || s === 'pending' || s === 'to do') {
      nextStatus = 'in progress';
    } else if (s === 'in progress') {
      nextStatus = 'done';
    } else {
      toast.info('Completed tasks cannot be moved backward.');
      return;
    }

    try {
      await taskService.updateTaskStatus(task.id, nextStatus);
      toast.success(`Task advanced forward to "${nextStatus}"`);
      loadData();
    } catch (err) {
      toast.error('Failed to update status');
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

  // In-Page Create Task View
  if (isModalOpen) {
    return (
      <div className="space-y-6 animate-fadeIn pb-12">
        {/* Top Breadcrumb & Heading */}
        <div>
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-2 transition-colors group cursor-pointer"
          >
            <ArrowLeftIcon className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Tasks</span>
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Create Task
          </h1>
        </div>

        <form onSubmit={handleCreateTask} noValidate className="space-y-6">
          <Card title={<span className="text-sm font-semibold text-foreground">Task Allocation</span>}>
            <div className="space-y-5">
              {/* Row 1: Task Title & Description side-by-side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Task Title <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    required
                    rows={1}
                    value={formData.title}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, title: e.target.value }));
                      if (formErrors.title) setFormErrors((prev) => ({ ...prev, title: '' }));
                    }}
                    placeholder="e.g. Master bedroom veneer grain continuity inspection"
                    className={cn(
                      'w-full min-h-[42px] h-[42px] rounded-lg border bg-background px-3 py-2 text-xs text-foreground resize-y transition-colors focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs',
                      formErrors.title ? 'border-destructive ring-1 ring-destructive' : 'border-border'
                    )}
                  />
                  {formErrors.title && (
                    <p className="mt-1 text-[11px] text-destructive">{formErrors.title}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={1}
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Add specific execution details, material references, or notes..."
                    className="w-full min-h-[42px] h-[42px] rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground resize-y transition-colors focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs"
                  />
                </div>
              </div>

              {/* Row 2: Assigned Project & Location (Both BefUI Standard Selects) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Assigned Project"
                  required
                  error={formErrors.projectId}
                  value={formData.projectId}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, projectId: e.target.value }));
                    if (formErrors.projectId) setFormErrors((prev) => ({ ...prev, projectId: '' }));
                  }}
                  options={projects.map((p) => ({
                    value: String(p.id),
                    label: p.name,
                  }))}
                />

                <Select
                  label="Location"
                  value={formData.type}
                  onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
                  options={[
                    { value: 'on-site', label: 'On-Site' },
                    { value: 'office', label: 'Office' },
                    { value: 'meeting', label: 'Meeting' },
                  ]}
                />
              </div>

              {/* Row 3: Multiple Assignees Selector (Stage / Trade Removed per leader instructions) */}
              <div>
                <FormMultiAssigneeSelect
                  users={users}
                  selectedIds={formData.assignedToIds}
                  onChange={(ids) => setFormData((prev) => ({ ...prev, assignedToIds: ids }))}
                />
              </div>

              {/* Row 4: Due Date & Priority Level */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Due Date"
                  type="date"
                  required
                  error={formErrors.dueDate}
                  value={formData.dueDate}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, dueDate: e.target.value }));
                    if (formErrors.dueDate) setFormErrors((prev) => ({ ...prev, dueDate: '' }));
                  }}
                />

                <Select
                  label="Priority Level"
                  value={formData.priority}
                  onChange={(e) => setFormData((prev) => ({ ...prev, priority: e.target.value }))}
                  options={[
                    { value: 'low', label: 'Low Priority' },
                    { value: 'medium', label: 'Medium Priority' },
                    { value: 'high', label: 'High Priority' },
                  ]}
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="mt-6 pt-4 border-t border-border flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={creatingTask}
                leadingIcon="plus"
              >
                Create Task
              </Button>
            </div>
          </Card>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tasks"
        subtitle="Assign and track site trades and tasks"
        actions={
          <div className="flex items-center gap-2">
            {/* View Mode: Board vs List */}
            <div className="flex items-center border border-border rounded-lg bg-card p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('board')}
                className={cn(
                  'p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer',
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
                  'p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer',
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

            {canCreate && (
              <Button
                variant="primary"
                size="sm"
                leadingIcon="plus"
                onClick={() => setIsModalOpen(true)}
              >
                Create Task
              </Button>
            )}
          </div>
        }
      />

      {/* Interconnected Filter Toolbar (All BefUI standard Select dropdowns with live search) */}
      <Card className="overflow-visible relative z-30" bodyClassName="p-3 sm:p-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* 1. Live Search Input */}
          <div className="relative flex items-center">
            <SearchIcon className="size-3.5 text-muted-foreground absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, assignees..."
              className="w-full h-9 rounded-lg border border-border bg-background pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary hover:border-muted-foreground/40 transition-colors shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                title="Clear search"
              >
                <XIcon className="size-3" />
              </button>
            )}
          </div>

          {/* 2. Project Filter Dropdown (Cascaded to Assignees and Location) */}
          <div>
            <Select
              value={projectFilter}
              onChange={(e) => handleProjectChange(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Projects' },
                ...availableProjects.map((p) => ({
                  value: String(p.id),
                  label: p.name,
                })),
              ]}
              className="h-9 text-xs"
            />
          </div>

          {/* 3. Assignees Filter Dropdown (Cascaded to Projects and Location) */}
          <div>
            <Select
              value={assigneeFilter}
              onChange={(e) => handleAssigneeChange(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Assignees' },
                ...availableAssignees.map((u) => {
                  const roleLower = String(u.role || '').toLowerCase();
                  const isAdmin = roleLower === 'admin' || roleLower === 'owner';
                  return {
                    value: String(u.id),
                    label: isAdmin ? `${u.name} (Admin)` : u.name,
                  };
                }),
              ]}
              className="h-9 text-xs"
            />
          </div>

          {/* 4. Location Filter Dropdown */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Locations' },
                  { value: 'on-site', label: 'On-Site' },
                  { value: 'office', label: 'Office' },
                  { value: 'meeting', label: 'Meeting' },
                ]}
                className="h-9 text-xs"
              />
            </div>

            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAllFilters}
                className="h-9 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground shrink-0"
                title="Clear all filters"
              >
                <XIcon className="size-3.5 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Dynamic Context Summary Banner when cascaded filters are active */}
        {hasActiveFilters && (
          <div className="mt-2.5 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-foreground">Showing:</span>
              <span>{filteredTasks.length} task(s)</span>
              {projectFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-[11px] text-foreground font-medium">
                  Project: {projects.find((p) => String(p.id) === String(projectFilter))?.name}
                  <button type="button" onClick={() => setProjectFilter('ALL')} className="hover:text-destructive">
                    <XIcon className="size-3" />
                  </button>
                </span>
              )}
              {assigneeFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-[11px] text-foreground font-medium">
                  Assignee: {users.find((u) => String(u.id) === String(assigneeFilter))?.name}
                  <button type="button" onClick={() => setAssigneeFilter('ALL')} className="hover:text-destructive">
                    <XIcon className="size-3" />
                  </button>
                </span>
              )}
              {typeFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-[11px] text-foreground font-medium capitalize">
                  Location: {typeFilter}
                  <button type="button" onClick={() => setTypeFilter('ALL')} className="hover:text-destructive">
                    <XIcon className="size-3" />
                  </button>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-xs text-primary hover:underline font-semibold cursor-pointer"
            >
              Reset all
            </button>
          </div>
        )}
      </Card>

      {/* VIEW 1: BefUI Kanban Board View */}
      {viewMode === 'board' ? (
        <div className="flex justify-start overflow-x-auto pb-2">
          <Kanban
            columns={TASK_KANBAN_COLUMNS}
            value={kanbanBoard}
            onChange={handleBoardChange}
            density={cardDensity}
            columnClassName="w-80 sm:w-96 md:flex-1 shrink-0"
            onAdd={canCreate ? () => setIsModalOpen(true) : undefined}
            renderCard={(t) => {
              const assigneesList = Array.isArray(t.assignedToNames) && t.assignedToNames.length > 0
                ? t.assignedToNames
                : [t.assignedToName || 'Unassigned'];

              return (
                <div className="space-y-2 p-1">
                  {/* Top line: Priority indicator + Location chip + Overdue */}
                  <div className="flex items-center justify-between gap-1.5 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
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
                      <span className="font-semibold text-secondary-foreground bg-secondary px-2 py-0.5 rounded text-xs truncate max-w-[140px]">
                        {t.type === 'site' || t.type === 'on-site' ? 'On-Site' : t.type === 'office' ? 'Office' : 'Meeting'}
                      </span>
                    </div>

                    {t.isOverdue && (
                      <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded shrink-0">
                        Overdue
                      </span>
                    )}
                  </div>

                  {/* Task Title */}
                  <p className="font-semibold text-sm text-foreground leading-snug line-clamp-2">
                    {t.title}
                  </p>

                  {/* Task Description snippet */}
                  {t.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {t.description}
                    </p>
                  )}

                  {/* Project Name & Due Date */}
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-0.5">
                    <span className="truncate font-medium text-foreground/80">{t.projectName || 'General Project'}</span>
                    {t.dueDate && <span className="font-mono text-[11px] shrink-0">Due: {t.dueDate}</span>}
                  </div>

                  {/* Bottom bar: Multiple Assignees + Forward-Only Action */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/70 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                        {assigneesList.slice(0, 3).map((name, i) => (
                          <Avatar key={i} name={name} size="xs" className="ring-1 ring-background" />
                        ))}
                      </div>
                      <span
                        className="text-xs text-foreground font-medium truncate max-w-[130px]"
                        title={assigneesList.join(', ')}
                      >
                        {assigneesList.length > 1
                          ? `${assigneesList[0]} +${assigneesList.length - 1}`
                          : assigneesList[0]}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                        title="Attach Photo Proof"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhotoTargetTask(t);
                          setPhotoInputUrl('https://images.unsplash.com/photo-1541123437800-1bb1317badc2?w=300');
                        }}
                      >
                        <CameraIcon className="size-3.5" />
                      </button>
                      {t.photos && t.photos.length > 0 && (
                        <button
                          type="button"
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                          title="View photo proof"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingPhotoTask(t);
                          }}
                        >
                          <EyeIcon className="size-3.5" />
                        </button>
                      )}

                      {/* Forward-Only Action Button (Cannot move backward) */}
                      {t.status !== 'done' && (
                        <button
                          type="button"
                          className="px-2.5 py-1 rounded-md text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer shadow-2xs"
                          title={t.status === 'todo' ? 'Advance to In Progress' : 'Advance to Completed'}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdvanceStatus(t);
                          }}
                        >
                          {t.status === 'todo' ? 'Start ›' : 'Complete ✓'}
                        </button>
                      )}

                      {t.status === 'done' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-success/15 text-success border border-success/30 select-none">
                          <CheckIcon className="size-3 stroke-[2.5]" />
                          <span>Done</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            }}
          />
        </div>
      ) : (
        /* VIEW 2: Table List View */
        <Card>
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 text-muted-foreground uppercase font-semibold border-b border-border">
                <tr>
                  <th className="py-2.5 px-3">Task Details</th>
                  <th className="py-2.5 px-3">Project</th>
                  <th className="py-2.5 px-3">Assignees</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground italic">
                      No tasks found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((t) => {
                    const assigneesList = Array.isArray(t.assignedToNames) && t.assignedToNames.length > 0
                      ? t.assignedToNames
                      : [t.assignedToName || 'Unassigned'];

                    return (
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
                            {t.type === 'site' || t.type === 'on-site' ? 'On-Site' : t.type === 'office' ? 'Office' : 'Meeting'} • Priority: {t.priority}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="text-foreground font-medium">{t.projectName}</div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                              {assigneesList.slice(0, 3).map((name, i) => (
                                <Avatar key={i} name={name} size="xs" className="ring-1 ring-background" />
                              ))}
                            </div>
                            <span className="text-foreground truncate max-w-[140px]" title={assigneesList.join(', ')}>
                              {assigneesList.join(', ')}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3 font-mono">
                          <span className={t.isOverdue ? 'text-destructive font-bold' : 'text-muted-foreground'}>
                            {t.dueDate || '-'}
                          </span>
                          {t.isOverdue && <span className="block text-[10px] text-destructive font-semibold">Overdue</span>}
                        </td>
                        <td className="py-2 px-3">
                          <StatusBadge status={t.status} size="sm" />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                              title="Attach photo proof"
                              onClick={() => {
                                setPhotoTargetTask(t);
                                setPhotoInputUrl('https://images.unsplash.com/photo-1541123437800-1bb1317badc2?w=300');
                              }}
                            >
                              <CameraIcon className="size-3.5" />
                            </button>
                            {t.photos && t.photos.length > 0 && (
                              <button
                                type="button"
                                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                                title="View photo proof"
                                onClick={() => setViewingPhotoTask(t)}
                              >
                                <EyeIcon className="size-3.5" />
                              </button>
                            )}

                            {/* Forward-only button (Cannot move backward) */}
                            {t.status !== 'done' ? (
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => handleAdvanceStatus(t)}
                              >
                                {t.status === 'todo' ? 'Start ›' : 'Complete ✓'}
                              </Button>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-success/15 text-success border border-success/30 select-none">
                                <CheckIcon className="size-3 stroke-[2.5]" />
                                <span>Done</span>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Attach Photo Modal */}
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
          {photoTargetTask?.photos && photoTargetTask.photos.length > 0 && (
            <div className="space-y-1.5 pb-2 border-b border-border">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">
                  Attached Photos ({photoTargetTask.photos.length}):
                </label>
                <button
                  type="button"
                  onClick={() => setViewingPhotoTask(photoTargetTask)}
                  className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <EyeIcon className="size-3.5" /> View Gallery
                </button>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {photoTargetTask.photos.map((pUrl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setViewingPhotoTask(photoTargetTask)}
                    className="relative group rounded-md overflow-hidden border border-border shrink-0 cursor-pointer"
                  >
                    <img src={pUrl} alt={`Proof ${i + 1}`} className="w-16 h-16 object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block font-medium text-foreground">Photo URL or CDN Resource</label>
            <Input
              value={photoInputUrl}
              onChange={(e) => setPhotoInputUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>
      </Modal>

      {/* View Photos Gallery Modal */}
      <Modal
        isOpen={!!viewingPhotoTask}
        onClose={() => setViewingPhotoTask(null)}
        title="Inspection Photo Gallery"
        subtitle={`Task: ${viewingPhotoTask?.title}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {viewingPhotoTask?.photos?.map((url, idx) => (
              <div key={idx} className="rounded-lg overflow-hidden border border-border bg-card shadow-xs group">
                <img
                  src={url}
                  alt={`Inspection photo ${idx + 1}`}
                  className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="p-2 text-[11px] text-muted-foreground flex justify-between items-center">
                  <span>Photo #{idx + 1}</span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    Open Full
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default TasksPage;

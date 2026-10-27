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
import Textarea from '../components/ui/Textarea';
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
} from '../components/ui/icons';

/**
 * Searchable project combobox:
 * - Default display/placeholder is "All Projects" (without '(All)').
 * - When typing, triggers live search across projects and tasks.
 * - Shows dropdown of projects filtered by the query.
 * - Enter or click selects project; Clear button (X) resets to "All Projects".
 */
function ProjectSearchSelect({
  projects,
  value,
  onChange,
  searchQuery,
  onSearchChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedProject = projects.find((p) => p.id === value);
  const displayLabel = value === 'ALL' ? '' : (selectedProject?.name || '');

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  const handleSelect = (projId, projName) => {
    onChange(projId);
    onSearchChange(projId === 'ALL' ? '' : projName);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full z-20">
      <div
        className={cn(
          'relative flex items-center w-full rounded-md border bg-background text-sm shadow-[0_1px_1px_rgb(0_0_0/0.02)] transition-colors h-9 px-2.5 gap-2 cursor-pointer',
          isOpen ? 'border-ring ring-2 ring-ring/20' : 'border-border hover:border-muted-foreground/40'
        )}
        onClick={() => {
          if (!isOpen) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        <SearchIcon className="size-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchQuery : (displayLabel || searchQuery)}
          onChange={(e) => {
            onSearchChange(e.target.value);
            if (value !== 'ALL') onChange('ALL');
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (filteredProjects.length > 0) {
                handleSelect(filteredProjects[0].id, filteredProjects[0].name);
              } else if (searchQuery.trim()) {
                setIsOpen(false);
              }
            } else if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
          placeholder="Projects"
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />

        {(value !== 'ALL' || searchQuery) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSelect('ALL', '');
            }}
            className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
            title="Clear project filter"
          >
            <XIcon className="size-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
            if (!isOpen) inputRef.current?.focus();
          }}
          className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5 shrink-0"
          tabIndex={-1}
        >
          <ChevronDownIcon
            className={cn('size-3.5 transition-transform duration-150', isOpen && 'rotate-180')}
          />
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-60 overflow-y-auto rounded-lg border border-border bg-card text-card-foreground shadow-xl p-1">
          <button
            type="button"
            onClick={() => handleSelect('ALL', '')}
            className={cn(
              'w-full text-left px-2.5 py-1.5 rounded text-xs font-medium flex items-center justify-between hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors',
              value === 'ALL' && !searchQuery
                ? 'bg-accent/80 font-semibold text-primary'
                : 'text-foreground'
            )}
          >
            <span>Projects</span>
            {value === 'ALL' && !searchQuery && (
              <CheckIcon className="size-3.5 text-primary shrink-0" />
            )}
          </button>

          {filteredProjects.length === 0 ? (
            <div className="px-2.5 py-3 text-center text-xs text-muted-foreground italic">
              No matching projects
            </div>
          ) : (
            filteredProjects.map((p) => {
              const isSelected = value === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p.id, p.name)}
                  className={cn(
                    'w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors',
                    isSelected ? 'bg-accent/80 font-semibold text-primary' : 'text-foreground'
                  )}
                >
                  <span className="truncate">{p.name}</span>
                  {isSelected && <CheckIcon className="size-3.5 text-primary shrink-0" />}
                </button>
              );
            })
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
  const cardDensity = 'compact'; // Permanently compact per user request
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'site' or 'office'

  // Create Task Full Screen Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectId: 'P1',
    stageName: 'Site Prep',
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
      if (allUsers.length > 0) {
        setFormData((prev) => ({
          ...prev,
          assignedToId: prev.assignedToId || String(allUsers[0].id),
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

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // 1. Project match: either specific project selected, or match query typed in All Projects
      let matchesProject = true;
      if (projectFilter !== 'ALL') {
        matchesProject = String(t.projectId) === String(projectFilter);
      } else if (projectSearchQuery.trim()) {
        const q = projectSearchQuery.trim().toLowerCase();
        matchesProject =
          t.projectName?.toLowerCase().includes(q) ||
          t.projectId?.toLowerCase().includes(q) ||
          t.title?.toLowerCase().includes(q) ||
          t.stageName?.toLowerCase().includes(q);
      }

      // 2. Assignee match
      const matchesAssignee =
        assigneeFilter === 'ALL' || String(t.assignedToId) === String(assigneeFilter);

      // 3. Location match: 'site' or 'office'
      const matchesType = typeFilter === 'ALL' || t.type === typeFilter;

      return matchesProject && matchesAssignee && matchesType;
    });
  }, [tasks, projectFilter, projectSearchQuery, assigneeFilter, typeFilter]);

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
    setCreatingTask(true);

    try {
      const targetProj = projects.find((p) => String(p.id) === String(formData.projectId));
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
        stageName: 'Site Prep',
        assignedToId: users[0]?.id ? String(users[0].id) : '',
        type: 'site',
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

      {/* Filter Toolbar (3 Columns: Projects Searchable, Assignees, Location) */}
      <Card className="overflow-visible relative z-30">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <ProjectSearchSelect
              projects={projects}
              value={projectFilter}
              onChange={setProjectFilter}
              searchQuery={projectSearchQuery}
              onSearchChange={setProjectSearchQuery}
            />
          </div>

          <div>
            <Select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'Assignees' },
                ...users.map((u) => {
                  const roleLower = String(u.role || '').toLowerCase();
                  const isAdmin = roleLower === 'admin' || roleLower === 'owner';
                  return {
                    value: String(u.id),
                    label: isAdmin ? `${u.name} (Admin)` : u.name,
                  };
                }),
              ]}
            />
          </div>

          <div>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'Location' },
                { value: 'site', label: 'Site' },
                { value: 'office', label: 'Office' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* VIEW 1: BefUI Kanban Board View */}
      {viewMode === 'board' ? (
        <div className="flex justify-start overflow-x-auto pb-2">
          <Kanban
            columns={TASK_KANBAN_COLUMNS}
            value={kanbanBoard}
            onChange={handleBoardChange}
            density={cardDensity}
            columnClassName="w-64 sm:w-72 md:w-[280px] md:flex-initial shrink-0"
            onAdd={canCreate ? () => setIsModalOpen(true) : undefined}
            renderCard={(t) => (
              <div className="space-y-1">
                {/* Top micro line: Priority indicator + Stage chip + Overdue/Photos */}
                <div className="flex items-center justify-between gap-1 text-[9.5px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        'size-1.5 rounded-full shrink-0',
                        t.priority === 'high'
                          ? 'bg-destructive ring-1 ring-destructive/30'
                          : t.priority === 'medium'
                          ? 'bg-warning ring-1 ring-warning/30'
                          : 'bg-muted-foreground/40'
                      )}
                      title={`Priority: ${t.priority || 'medium'}`}
                    />
                    <span className="font-medium text-secondary-foreground bg-secondary px-1 py-0.2 rounded text-[9.5px] truncate max-w-[110px]">
                      {t.stageName || t.type}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {t.photos && t.photos.length > 0 && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground font-mono bg-muted px-1 py-0.2 rounded"
                        title={`${t.photos.length} site proof photo(s)`}
                      >
                        <CameraIcon className="size-2.5" />
                        {t.photos.length}
                      </span>
                    )}
                    {t.isOverdue && (
                      <span className="text-[9px] font-bold text-destructive bg-destructive/10 px-1 py-0.2 rounded">
                        Overdue
                      </span>
                    )}
                  </div>
                </div>

                {/* Task Title (Compact single line or 2-line clamp) */}
                <p className="font-semibold text-[11.5px] text-foreground leading-snug line-clamp-1">
                  {t.title}
                </p>

                {/* Project Name micro-text */}
                {t.projectName && (
                  <p className="text-[9.5px] text-muted-foreground truncate leading-none">
                    {t.projectName}
                  </p>
                )}

                {/* Bottom micro-bar: Assignee + Fast Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-border/60 text-[10px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Avatar name={t.assignedToName || 'Artisan'} size="xs" />
                    <span className="text-[10px] text-muted-foreground truncate max-w-[85px] font-medium">
                      {t.assignedToName?.split(' ')[0] || 'Artisan'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
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
                      className="px-1.5 py-0.5 rounded text-[9.5px] font-medium bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
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
            )}
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

      {/* Full-Screen Create Task Popup Screen (matching Attendance screen layout, buttons & padding) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto flex flex-col animate-in fade-in duration-200">
          {/* Top Sticky Header */}
          <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="inline-flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Back to tasks"
              >
                <Icon name="arrow-left" size={18} />
              </button>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-text-main tracking-tight leading-none">
                  Create Operational Task
                </h2>
                <p className="text-xs text-text-muted mt-1">
                  Assign deliverables to site craftsmen or office design team
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleCreateTask}
                loading={creatingTask}
                leadingIcon="plus"
              >
                Create Task
              </Button>
            </div>
          </div>

          {/* Full Screen Body with Container & Padding Matching Attendance Screen */}
          <div className="flex-1 px-3 sm:px-5 lg:px-6 py-4 sm:py-6 w-full max-w-7xl mx-auto space-y-6">
            <form onSubmit={handleCreateTask} className="space-y-6" noValidate>
              <Card
                title="Task Specification & Allocation"
                subtitle="Enter the task scope, assign responsible personnel, and establish due dates"
              >
                <div className="space-y-5">
                  {/* Task Title */}
                  <div>
                    <Input
                      label="Task Title / Snag Description"
                      required
                      error={formErrors.title}
                      value={formData.title}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, title: e.target.value }));
                        if (formErrors.title) setFormErrors((prev) => ({ ...prev, title: '' }));
                      }}
                      placeholder="e.g. Master bedroom veneer grain continuity inspection"
                    />
                  </div>

                  {/* Project & Assignment Type */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select
                      label="Assigned Project"
                      required
                      error={formErrors.projectId}
                      value={formData.projectId}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, projectId: e.target.value }));
                        if (formErrors.projectId) setFormErrors((prev) => ({ ...prev, projectId: '' }));
                      }}
                      options={projects.map((p) => ({ value: p.id, label: p.name }))}
                    />

                    <Select
                      label="Assignment Type"
                      value={formData.type}
                      onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
                      options={[
                        { value: 'site', label: 'Site Trade Task (On-Site)' },
                        { value: 'office', label: 'Office Deliverable (Studio)' },
                      ]}
                    />
                  </div>

                  {/* Assigned Person & Stage */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select
                      label="Assigned Person"
                      required
                      error={formErrors.assignedToId}
                      value={formData.assignedToId}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, assignedToId: e.target.value }));
                        if (formErrors.assignedToId) setFormErrors((prev) => ({ ...prev, assignedToId: '' }));
                      }}
                      options={users.map((u) => ({
                        value: String(u.id),
                        label: `${u.name} (${u.role})`,
                      }))}
                    />

                    <Input
                      label="Stage / Trade"
                      value={formData.stageName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, stageName: e.target.value }))}
                      placeholder="e.g. Carpenter, False Ceiling, Electrical"
                    />
                  </div>

                  {/* Due Date & Priority */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        { value: 'high', label: 'High Priority (Urgent Snag)' },
                      ]}
                    />
                  </div>

                  {/* Description / Additional Notes */}
                  <div>
                    <Textarea
                      label="Detailed Instructions / Notes (Optional)"
                      rows={4}
                      value={formData.description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Add any specific execution details, material references, or inspection criteria..."
                    />
                  </div>
                </div>

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
                    Create & Assign Task
                  </Button>
                </div>
              </Card>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TasksPage;

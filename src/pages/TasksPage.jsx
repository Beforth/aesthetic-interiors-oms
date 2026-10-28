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
  EyeIcon,
  ArrowLeftIcon,
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
          'relative flex items-center w-full rounded-lg border bg-background text-sm shadow-[0_1px_1px_rgb(0_0_0/0.02)] transition-colors h-9 px-2.5 gap-2 cursor-pointer',
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
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-[185px] overflow-y-auto scrollbar-thin rounded-lg border border-border bg-card text-card-foreground shadow-xl p-1">
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

/**
 * Custom 5-item scrollable select for Assigned Project in Task Creation form
 */
function FormProjectSelect({ label = 'Assigned Project', required, error, value, onChange, projects = [] }) {
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

  const selectedProj = projects.find((p) => String(p.id) === String(value));
  const filtered = projects.filter((p) =>
    (p.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative space-y-1.5">
      <label className="block text-xs font-medium text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'w-full h-9 rounded-lg border bg-background px-3 text-xs flex items-center justify-between text-left transition-colors cursor-pointer',
          error
            ? 'border-destructive ring-1 ring-destructive'
            : 'border-border hover:border-muted-foreground/40 focus:border-ring focus:ring-2 focus:ring-ring/20'
        )}
      >
        <span className={cn('truncate', !selectedProj && 'text-muted-foreground')}>
          {selectedProj?.name || 'Select a project'}
        </span>
        <ChevronDownIcon
          className={cn('size-3.5 text-muted-foreground transition-transform shrink-0 ml-2', isOpen && 'rotate-180')}
        />
      </button>

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-border bg-card text-card-foreground shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {projects.length > 5 && (
            <div className="p-1.5 border-b border-border bg-muted/30">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-background rounded-md border border-border">
                <SearchIcon className="size-3 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search project..."
                  className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                  autoFocus
                />
              </div>
            </div>
          )}
          <div className="max-h-[185px] overflow-y-auto scrollbar-thin p-1 space-y-0.5">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground italic text-center">
                No matching projects
              </div>
            ) : (
              filtered.map((p) => {
                const isSelected = String(p.id) === String(value);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onChange(p.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      'w-full text-left px-2.5 py-2 rounded-md text-xs flex items-center justify-between hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors',
                      isSelected ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'
                    )}
                  >
                    <span className="truncate">{p.name}</span>
                    {isSelected && <CheckIcon className="size-3.5 text-primary shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Custom 5-item scrollable & searchable select for Assigned Person
 * Owner is identified as 'Rohit Kumar (Me)', others show only name, and includes 'Not Assigned'
 */
function FormAssigneeSelect({ label = 'Assigned Person', required, error, value, onChange, users = [] }) {
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
    if (!u) return 'Not Assigned';
    const roleLower = String(u.role || '').toLowerCase();
    const isOwner = roleLower === 'owner' || roleLower === 'admin' || (u.name && u.name.toLowerCase().includes('rohit'));
    return isOwner ? `${u.name} (Me)` : u.name;
  };

  const selectedUser = users.find((u) => String(u.id) === String(value));
  const displayLabel = value === '' || !value ? 'Not Assigned' : (selectedUser ? getUserLabel(selectedUser) : 'Not Assigned');

  const filteredUsers = users.filter((u) => {
    const text = getUserLabel(u).toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <div ref={ref} className="relative space-y-1.5">
      <label className="block text-xs font-medium text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'w-full h-9 rounded-lg border bg-background px-3 text-xs flex items-center justify-between text-left transition-colors cursor-pointer',
          error
            ? 'border-destructive ring-1 ring-destructive'
            : 'border-border hover:border-muted-foreground/40 focus:border-ring focus:ring-2 focus:ring-ring/20'
        )}
      >
        <span className={cn('truncate', (!value || value === '') && 'text-muted-foreground')}>
          {displayLabel}
        </span>
        <ChevronDownIcon
          className={cn('size-3.5 text-muted-foreground transition-transform shrink-0 ml-2', isOpen && 'rotate-180')}
        />
      </button>

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-border bg-card text-card-foreground shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-1.5 border-b border-border bg-muted/30">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-background rounded-md border border-border">
              <SearchIcon className="size-3 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search person..."
                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-[185px] overflow-y-auto scrollbar-thin p-1 space-y-0.5">
            {/* Not Assigned Option */}
            {(!search || 'not assigned'.includes(search.toLowerCase())) && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                  setSearch('');
                }}
                className={cn(
                  'w-full text-left px-2.5 py-2 rounded-md text-xs flex items-center justify-between hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors',
                  value === '' ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground'
                )}
              >
                <span>Not Assigned</span>
                {value === '' && <CheckIcon className="size-3.5 text-primary shrink-0 ml-2" />}
              </button>
            )}

            {filteredUsers.length === 0 && search && !'not assigned'.includes(search.toLowerCase()) ? (
              <div className="px-3 py-2 text-xs text-muted-foreground italic text-center">
                No matching personnel
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = String(u.id) === String(value);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onChange(String(u.id));
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      'w-full text-left px-2.5 py-2 rounded-md text-xs flex items-center justify-between hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors',
                      isSelected ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'
                    )}
                  >
                    <span className="truncate">{getUserLabel(u)}</span>
                    {isSelected && <CheckIcon className="size-3.5 text-primary shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
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
  const cardDensity = 'comfortable'; // Comfortable density with increased card size per user request
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'on-site', 'office', 'meeting'

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

      // 3. Location match: 'on-site' (or legacy 'site'), 'office', 'meeting'
      const matchesType =
        typeFilter === 'ALL' ||
        t.type === typeFilter ||
        (typeFilter === 'on-site' && (t.type === 'site' || t.type === 'on-site')) ||
        (typeFilter === 'site' && (t.type === 'site' || t.type === 'on-site'));

      return matchesProject && matchesAssignee && matchesType;
    });
  }, [tasks, projectFilter, projectSearchQuery, assigneeFilter, typeFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = tasks.length;
    const siteCount = tasks.filter((t) => t.type === 'site' || t.type === 'on-site').length;
    const officeCount = tasks.filter((t) => t.type === 'office').length;
    const overdueCount = tasks.filter((t) => t.isOverdue && t.status !== 'done').length;
    const completedCount = tasks.filter((t) => t.status === 'done').length;
    return { total, siteCount, officeCount, overdueCount, completedCount };
  }, [tasks]);

  // Create Task Submit
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
      const targetUser = users.find((u) => String(u.id) === String(formData.assignedToId));
      let assignedToName = 'Unassigned';
      if (targetUser) {
        const roleLower = String(targetUser.role || '').toLowerCase();
        const isOwner = roleLower === 'owner' || roleLower === 'admin' || (targetUser.name && targetUser.name.toLowerCase().includes('rohit'));
        assignedToName = isOwner ? `${targetUser.name} (Me)` : targetUser.name;
      }

      await taskService.createTask({
        ...formData,
        projectName: targetProj?.name || 'Interior Site Fit-Out',
        assignedToName,
      });

      toast.success(`Task "${formData.title}" created successfully`);
      setIsModalOpen(false);
      setFormData({
        title: '',
        description: '',
        projectId: projects[0]?.id || 'P1',
        stageName: 'Site Prep',
        assignedToId: '',
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

  // In-Page Create Task View matching NewProjectPage layout, page margins, and padding
  if (isModalOpen) {
    return (
      <div className="space-y-6 animate-fadeIn pb-12">
        {/* Top Breadcrumb & Heading matching NewProjectPage */}
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
              {/* Row 1: Task Title & Description side-by-side with resizable vertical expander */}
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

              {/* Row 2: Assigned Project (Custom 5-item scrollable) & Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormProjectSelect
                  label="Assigned Project"
                  required
                  error={formErrors.projectId}
                  value={formData.projectId}
                  onChange={(val) => {
                    setFormData((prev) => ({ ...prev, projectId: val }));
                    if (formErrors.projectId) setFormErrors((prev) => ({ ...prev, projectId: '' }));
                  }}
                  projects={projects}
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

              {/* Row 3: Assigned Person & Stage / Trade */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormAssigneeSelect
                  label="Assigned Person"
                  value={formData.assignedToId}
                  onChange={(val) => {
                    setFormData((prev) => ({ ...prev, assignedToId: val }));
                    if (formErrors.assignedToId) setFormErrors((prev) => ({ ...prev, assignedToId: '' }));
                  }}
                  users={users}
                />

                <Input
                  label="Stage / Trade"
                  value={formData.stageName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, stageName: e.target.value }))}
                  placeholder="e.g. Carpenter, False Ceiling, Electrical"
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
      <Card className="overflow-visible relative z-30" bodyClassName="p-3 sm:p-3.5">
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
                { value: 'on-site', label: 'On-Site' },
                { value: 'office', label: 'Office' },
                { value: 'meeting', label: 'Meeting' },
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
            columnClassName="w-80 sm:w-96 md:flex-1 shrink-0"
            onAdd={canCreate ? () => setIsModalOpen(true) : undefined}
            renderCard={(t) => (
              <div className="space-y-2 p-1">
                {/* Top line: Priority indicator + Stage chip + Overdue/Photos */}
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
                      {t.stageName || (t.type === 'site' || t.type === 'on-site' ? 'On-Site' : t.type === 'office' ? 'Office' : 'Meeting')}
                    </span>
                  </div>

                  {t.isOverdue && (
                    <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded shrink-0">
                      Overdue
                    </span>
                  )}
                </div>

                {/* Task Title (Prominent, clear font) */}
                <p className="font-semibold text-sm text-foreground leading-snug line-clamp-2">
                  {t.title}
                </p>

                {/* Task Description snippet if available */}
                {t.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {t.description}
                  </p>
                )}

                {/* Project Name & Due Date */}
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-0.5">
                  <span className="truncate font-medium text-foreground/80">{t.projectName || 'General'}</span>
                  {t.dueDate && <span className="font-mono text-[11px] shrink-0">Due: {t.dueDate}</span>}
                </div>

                {/* Bottom bar: Assignee + Fast Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border/70 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar name={t.assignedToName || 'Artisan'} size="sm" />
                    <span className="text-xs text-foreground font-medium truncate max-w-[120px]">
                      {t.assignedToName || 'Unassigned'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                      title="Attach Photo Proof (FR-TSK-04)"
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
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-md text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer shadow-2xs"
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
                        {t.type === 'site' || t.type === 'on-site' ? 'On-Site' : t.type === 'office' ? 'Office' : 'Meeting'} • Priority: {t.priority}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="text-foreground">{t.projectName}</div>
                      <div className="text-[11px] text-primary">{t.stageName || '-'}</div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={t.assignedToName || 'Artisan'} size="xs" />
                        <span className="text-foreground">{t.assignedToName || 'Unassigned'}</span>
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
          {/* Currently Attached Photos preview */}
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
                    title="Click to view photo"
                  >
                    <img src={pUrl} alt={`Photo ${i + 1}`} className="size-14 object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                      <EyeIcon className="size-4" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

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

      {/* View Task Photos Lightbox Modal */}
      <Modal
        isOpen={!!viewingPhotoTask}
        onClose={() => setViewingPhotoTask(null)}
        title={`Task Photos: ${viewingPhotoTask?.title || 'Inspection Proofs'}`}
        subtitle={`${viewingPhotoTask?.photos?.length || 0} photo(s) attached • ${viewingPhotoTask?.projectName || ''}`}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-muted-foreground">
              Stage: <strong className="text-foreground">{viewingPhotoTask?.stageName || 'Site Trade'}</strong>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewingPhotoTask(null)}
            >
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          {viewingPhotoTask?.photos && viewingPhotoTask.photos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {viewingPhotoTask.photos.map((url, idx) => (
                <div
                  key={idx}
                  className="group relative rounded-xl border border-border overflow-hidden bg-muted/20 shadow-2xs"
                >
                  <img
                    src={url}
                    alt={`Proof ${idx + 1}`}
                    className="w-full h-52 object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                    <span className="text-xs text-white font-medium">Photo #{idx + 1}</span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-white underline underline-offset-2 hover:text-primary-foreground font-semibold"
                    >
                      Open Full Size ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No photos attached to this task.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default TasksPage;

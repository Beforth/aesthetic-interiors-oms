import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { clientService } from '../services/clientService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePermission } from '../hooks/usePermission';
import { ROLES } from '../config/roles';
import { cn } from '../lib/utils';
import { formatDate, parseDateSafe, formatCurrency } from '../utils/formatters';

import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import PermissionGate from '../components/ui/PermissionGate';
import { Avatar } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import Table from '../components/ui/Table';
import {
  SearchIcon,
  FilterIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  AlertIcon,
  BuildingIcon,
  UserIcon,
  MapPinIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  EyeIcon,
  XIcon,
  ChevronDownIcon,
  ArrowRightIcon,
} from '../components/ui/icons';

/**
 * Checks if a specific stage has passed its due date
 */
function isStageOverdue(stage) {
  if (!stage || !stage.endDate) return false;
  const status = (stage.status || '').toLowerCase();
  if (status === 'done' || status === 'completed' || status === 'handed over') {
    return false;
  }
  const end = parseDateSafe(stage.endDate);
  if (!end) return false;
  end.setHours(23, 59, 59, 999);
  const today = new Date();
  return end < today;
}

/**
 * Calculates how many days a stage is overdue
 */
function getOverdueDays(stage) {
  if (!stage || !stage.endDate) return 0;
  const end = parseDateSafe(stage.endDate);
  if (!end) return 0;
  end.setHours(23, 59, 59, 999);
  const today = new Date();
  const diffTime = today - end;
  return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

/**
 * Checks if a project is overdue overall (by project due date or any active stage)
 */
function isProjectOverdue(project) {
  const status = (project.status || '').toLowerCase();
  if (status === 'completed' || status === 'done' || status === 'handed over') {
    return false;
  }
  // Check explicit project due date
  const dueDateStr = project.endDate || project.dueDate;
  if (dueDateStr) {
    const end = parseDateSafe(dueDateStr);
    if (end) {
      end.setHours(23, 59, 59, 999);
      if (end < new Date()) return true;
    }
  }
  // Or if any of its active/uncompleted stages is overdue
  return (project.stages || []).some(isStageOverdue);
}

/**
 * Resolves a human-readable client display name, ensuring phone numbers/digits are never displayed as names
 */
function getClientDisplayName(project, clients = []) {
  if (project?.clientId) {
    const clientObj = clients.find((c) => String(c.id) === String(project.clientId));
    if (clientObj?.name && !/^\+?[\d\s-]{7,}$/.test(clientObj.name.trim())) {
      return clientObj.name.trim();
    }
  }
  const rawName = String(project?.clientName || '').trim();
  if (rawName && !/^\+?[\d\s-]{7,}$/.test(rawName)) {
    return rawName;
  }
  const digits = rawName.replace(/\D/g, '');
  if (digits.length >= 7) {
    const matchedClient = clients.find((c) => {
      const cDigits = String(c.phone || '').replace(/\D/g, '');
      return cDigits && (cDigits.endsWith(digits) || digits.endsWith(cDigits));
    });
    if (matchedClient?.name && !/^\+?[\d\s-]{7,}$/.test(matchedClient.name.trim())) {
      return matchedClient.name.trim();
    }
  }
  return 'Private Client';
}

/**
 * Edit Stage Dates Modal
 */
function ScheduleStageModal({ isOpen, onClose, data, onSave }) {
  const [selectedStageId, setSelectedStageId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('not started');

  const stagesList = data?.project?.stages || (data?.stage ? [data.stage] : []);

  useEffect(() => {
    if (data?.stage) {
      setSelectedStageId(data.stage.id || '');
      setStartDate(data.stage.startDate || '');
      setEndDate(data.stage.endDate || '');
      setStatus(data.stage.status || 'not started');
    } else if (stagesList.length > 0) {
      const first = stagesList.find((s) => s.status === 'in progress') || stagesList[0];
      setSelectedStageId(first.id || '');
      setStartDate(first.startDate || '');
      setEndDate(first.endDate || '');
      setStatus(first.status || 'not started');
    }
  }, [data]);

  const handleStageSelect = (stageId) => {
    setSelectedStageId(stageId);
    const target = stagesList.find((s) => String(s.id) === String(stageId));
    if (target) {
      setStartDate(target.startDate || '');
      setEndDate(target.endDate || '');
      setStatus(target.status || 'not started');
    }
  };

  if (!isOpen || !data) return null;

  const currentStage = stagesList.find((s) => String(s.id) === String(selectedStageId)) || data.stage;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!currentStage) return;
    onSave({
      projectId: data.projectId,
      stageId: currentStage.id,
      stageName: currentStage.name,
      startDate,
      endDate,
      status,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Schedule"
      subtitle={`${data.projectName} • ${currentStage?.name || 'Stage'}`}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit}>
            Save Schedule
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-1">
        {stagesList.length > 1 && (
          <div>
            <label className="text-xs font-bold text-foreground block mb-1.5">
              Select Stage to Schedule
            </label>
            <select
              value={selectedStageId}
              onChange={(e) => handleStageSelect(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-2xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              {stagesList.map((st, idx) => (
                <option key={st.id || idx} value={st.id}>
                  {st.order ? `${st.order}. ` : ''}{st.name} ({st.status || 'pending'})
                </option>
              ))}
            </select>
          </div>
        )}

        <Input
          label="Start Date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />

        <Input
          label="End Date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          required
        />

        <div>
          <label className="text-xs font-bold text-foreground flex items-center gap-1 mb-1.5">
            Stage Status
          </label>
          <select
            value={
              status === 'not started' || status === 'planning' || status === 'pending' || status === 'draft'
                ? 'planning'
                : status === 'done' || status === 'completed'
                ? 'completed'
                : 'in progress'
            }
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-2xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="planning">Planning</option>
            <option value="in progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Quick Edit Project Modal
 */
function QuickEditProjectModal({ isOpen, onClose, project, onSave }) {
  const [name, setName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [status, setStatus] = useState('in progress');

  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setSiteAddress(project.siteAddress || '');
      setStartDate(project.startDate || '');
      setEndDate(project.endDate || project.dueDate || '');
      setTotalCost(project.totalCost !== undefined ? String(project.totalCost) : '');
      setStatus(project.status || 'in progress');
    }
  }, [project]);

  if (!isOpen || !project) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(project.id, {
      name,
      siteAddress,
      startDate,
      endDate,
      dueDate: endDate,
      totalCost: parseFloat(totalCost.replace(/,/g, '')) || 0,
      status,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Project Details"
      subtitle={`Project #${project.id} • ${project.clientName}`}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit}>
            Save Changes
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-1">
        <Input
          label="Project Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Input
          label="Site Address"
          value={siteAddress}
          onChange={(e) => setSiteAddress(e.target.value)}
          placeholder="e.g. Indiranagar 100ft Road, Bengaluru"
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="Due Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Total Cost Estimate (INR)"
            type="number"
            value={totalCost}
            onChange={(e) => setTotalCost(e.target.value)}
            placeholder="e.g. 4500000"
          />

          <div>
            <label className="text-xs font-bold text-foreground block mb-1.5">
              Project Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-2xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="planning">Planning / Not Started</option>
              <option value="in progress">In Progress</option>
              <option value="completed">Completed & Handed Over</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Delete Project Confirmation Dialog
 */
function ConfirmDeleteProjectModal({ isOpen, onClose, data, onConfirm }) {
  if (!isOpen || !data) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Project Contract?"
      subtitle={`Are you sure you want to permanently delete "${data.name}"?`}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            Delete Project
          </Button>
        </div>
      }
    >
      <div className="space-y-3 py-1 text-xs text-muted-foreground">
        <p>
          This action will permanently delete <strong className="text-foreground">{data.name}</strong>,
          all its scheduled stages, progress updates, and site team associations.
        </p>
        <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive font-semibold">
          Warning: This action cannot be reversed.
        </div>
      </div>
    </Modal>
  );
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, role, hasPermission } = useAuth();
  const toast = useToast();

  const isManagerOrAdmin =
    role === ROLES.MANAGER ||
    role === ROLES.ADMIN ||
    role === ROLES.OWNER ||
    role === 'manager' ||
    role === 'owner' ||
    role === 'admin' ||
    hasPermission('stages.editProjectStages') ||
    hasPermission('projects.create');

  const canCreateProject = usePermission('projects.create');

  // Core Data States
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // View Mode: 'grid' (Default - cards matching reference) or 'list' (clean table)
  const [viewMode, setViewMode] = useState('grid');

  // Filter States
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedClientId, setSelectedClientId] = useState('ALL');
  const [sortBy, setSortBy] = useState('due_asc');

  // Hover Popover State (matching the user's reference screenshot)
  const [hoveredCardId, setHoveredCardId] = useState(null);
  const hoverTimeoutRef = useRef(null);

  // Modal States
  const [editingStageData, setEditingStageData] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [projList, clientList, userList] = await Promise.all([
        projectService.getAllProjects(currentUser),
        clientService.getAllClients(currentUser),
        userService.getAllUsers(),
      ]);
      setProjects(projList || []);
      setClients(clientList || []);
      setUsers(userList || []);
    } catch (err) {
      console.error('Failed to load projects:', err);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const handleRefresh = () => fetchAll();
    window.addEventListener('osm_projects_changed', handleRefresh);
    window.addEventListener('osm_project_created', handleRefresh);
    window.addEventListener('osm_project_updated', handleRefresh);
    window.addEventListener('osm_project_deleted', handleRefresh);
    return () => {
      window.removeEventListener('osm_projects_changed', handleRefresh);
      window.removeEventListener('osm_project_created', handleRefresh);
      window.removeEventListener('osm_project_updated', handleRefresh);
      window.removeEventListener('osm_project_deleted', handleRefresh);
    };
  }, [currentUser]);

  // Read view mode from search params if present
  useEffect(() => {
    const v = searchParams.get('view');
    if (v === 'list' || v === 'table') {
      setViewMode('list');
    } else {
      setViewMode('grid');
    }
  }, [searchParams]);

  // Executive Metric Counts
  const workingProjects = useMemo(() => {
    return projects.filter((p) => {
      const s = (p.status || '').toLowerCase();
      return s === 'in progress' || s === 'running' || s === 'active';
    });
  }, [projects]);

  const planningProjects = useMemo(() => {
    return projects.filter((p) => {
      const s = (p.status || '').toLowerCase();
      return s === 'planning' || s === 'not started' || s === 'draft';
    });
  }, [projects]);

  const completedProjects = useMemo(() => {
    return projects.filter((p) => {
      const s = (p.status || '').toLowerCase();
      return s === 'completed' || s === 'done' || s === 'handed over';
    });
  }, [projects]);

  // Filtered & Sorted Projects
  const filteredProjects = useMemo(() => {
    let list = projects.filter((p) => {
      // 1. Text Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = (p.name || '').toLowerCase().includes(q);
        const matchesClient = (p.clientName || '').toLowerCase().includes(q);
        const matchesAddress = (p.siteAddress || '').toLowerCase().includes(q);
        const matchesId = String(p.id || '').toLowerCase().includes(q);
        if (!matchesName && !matchesClient && !matchesAddress && !matchesId) return false;
      }

      // 2. Client Filter
      if (selectedClientId !== 'ALL') {
        if (String(p.clientId) !== String(selectedClientId)) return false;
      }

      // 3. Status Filter
      if (statusFilter !== 'ALL') {
        const s = (p.status || '').toLowerCase();
        if (statusFilter === 'in progress' && s !== 'in progress' && s !== 'running' && s !== 'active') return false;
        if (statusFilter === 'planning' && s !== 'planning' && s !== 'not started' && s !== 'draft') return false;
        if (statusFilter === 'completed' && s !== 'completed' && s !== 'done' && s !== 'handed over') return false;
        if (statusFilter === 'on_hold' && s !== 'on_hold' && s !== 'on hold') return false;
      }

      return true;
    });

    // 4. Sorting
    list.sort((a, b) => {
      if (sortBy === 'due_asc') {
        const dateA = parseDateSafe(a.endDate || a.dueDate) || new Date(9999, 11, 31);
        const dateB = parseDateSafe(b.endDate || b.dueDate) || new Date(9999, 11, 31);
        return dateA - dateB;
      }
      if (sortBy === 'due_desc') {
        const dateA = parseDateSafe(a.endDate || a.dueDate) || new Date(0);
        const dateB = parseDateSafe(b.endDate || b.dueDate) || new Date(0);
        return dateB - dateA;
      }
      if (sortBy === 'progress_desc') {
        const getPct = (proj) => {
          const tot = proj.stages?.length || 0;
          if (tot === 0) return proj.status === 'completed' ? 100 : 0;
          const done = proj.stages.filter((st) => st.status === 'done' || st.status === 'completed').length;
          return Math.round((done / tot) * 100);
        };
        return getPct(b) - getPct(a);
      }
      if (sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'cost_desc') {
        return (Number(b.totalCost) || 0) - (Number(a.totalCost) || 0);
      }
      return 0;
    });

    return list;
  }, [projects, search, selectedClientId, statusFilter, sortBy]);

  // Filter clients to legitimate named clients (omit raw phone numbers or empty entries)
  const displayClients = useMemo(() => {
    return (clients || []).filter((c) => {
      const name = String(c?.name || '').trim();
      if (!name) return false;
      // Filter out entries that are purely phone numbers (e.g. 10 digits or symbols)
      const isPhoneOnly = /^\+?[\d\s-]{7,}$/.test(name);
      return !isPhoneOnly;
    });
  }, [clients]);

  // Check if any filter is active
  const hasActiveFilters = Boolean(
    search.trim() ||
    selectedClientId !== 'ALL' ||
    statusFilter !== 'ALL' ||
    sortBy !== 'due_asc'
  );

  const handleClearFilters = () => {
    setSearch('');
    setSelectedClientId('ALL');
    setStatusFilter('ALL');
    setSortBy('due_asc');
  };

  // Card Mouse Hover Handlers (Fluid 180ms debounce matching the screenshot)
  const handleMouseEnterCard = (id) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredCardId(id);
    }, 180);
  };

  const handleMouseLeaveCard = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredCardId(null);
    }, 220);
  };

  // Actions
  const handleOpenScheduleModal = (project, stage) => {
    if (!isManagerOrAdmin) {
      toast.error('Only Managers and Admins have authority to edit stage schedules');
      return;
    }
    const targetStage = stage || (project.stages || []).find((s) => s.status === 'in progress') || (project.stages || [])[0];
    setEditingStageData({
      projectId: project.id,
      projectName: project.name,
      project,
      stage: targetStage,
    });
  };

  const handleSaveStageSchedule = async ({ projectId, stageId, stageName, startDate, endDate, status }) => {
    try {
      const updated = await projectService.updateStageDetails(projectId, stageId, {
        stageName,
        startDate,
        endDate,
        status,
      });
      if (updated) {
        setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
        toast.success(`Schedule saved for ${stageName || 'stage'}`);
        setEditingStageData(null);
      }
    } catch {
      toast.error('Failed to update stage schedule');
    }
  };

  const handleOpenQuickEdit = (project) => {
    if (!isManagerOrAdmin) {
      toast.error('Only Managers and Admins can edit project information');
      return;
    }
    setEditingProject(project);
  };

  const handleSaveProjectDetails = async (id, updates) => {
    try {
      const updated = await projectService.updateProject(id, updates);
      if (updated) {
        setProjects((prev) => prev.map((p) => (String(p.id) === String(id) ? { ...p, ...updates } : p)));
        toast.success(`Project "${updates.name || 'details'}" updated successfully`);
        setEditingProject(null);
      }
    } catch {
      toast.error('Failed to save project updates');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteProjectConfirm) return;
    const { id, name } = deleteProjectConfirm;
    try {
      await projectService.deleteProject(id);
      setProjects((prev) => prev.filter((p) => String(p.id) !== String(id)));
      toast.success(`Project "${name}" deleted`);
    } catch {
      toast.error('Failed to delete project');
    } finally {
      setDeleteProjectConfirm(null);
    }
  };

  const selectedClient = clients.find((c) => String(c.id) === String(selectedClientId));

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* 1. Header with Title & Primary Actions */}
      <PageHeader
        title="Projects"
        subtitle="Active site stages and execution progress"
        actions={
          <div className="flex items-center gap-2">
            {/* View Switcher: Grid vs List (Zero Horizontal Scrollbar) */}
            <div className="flex items-center bg-muted p-1 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
                  viewMode === 'grid'
                    ? 'bg-card text-foreground shadow-2xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Grid of Cards View"
              >
                <span>Cards Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
                  viewMode === 'list'
                    ? 'bg-card text-foreground shadow-2xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Table List View"
              >
                <span>List View</span>
              </button>
            </div>

            <PermissionGate permission="projects.create">
              <Button
                variant="primary"
                size="sm"
                leadingIcon="plus"
                onClick={() => navigate('/projects/new')}
              >
                New Project
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {/* 2. Executive Metric Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border border-border bg-card shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Projects</p>
          <p className="text-2xl font-extrabold font-mono text-foreground mt-0.5">{projects.length}</p>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">In Progress</p>
          <p className="text-2xl font-extrabold font-mono text-primary mt-0.5">{workingProjects.length}</p>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Planning</p>
          <p className="text-2xl font-extrabold font-mono text-amber-600 dark:text-amber-400 mt-0.5">{planningProjects.length}</p>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Completed</p>
          <p className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">{completedProjects.length}</p>
        </div>
      </div>

      {/* 3. Toolbar: Search, Client Filter, Status Filter & Sorter */}
      <div className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 flex-wrap">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <SearchIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects by name, client, site location, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <XIcon className="size-3.5" />
              </button>
            )}
          </div>

          {/* Filters & Dropdowns */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Filter by Client Dropdown */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground font-medium hidden sm:inline">Client:</span>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-2xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer min-w-[150px]"
              >
                <option value="ALL">All Clients</option>
                {displayClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Status Dropdown */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground font-medium hidden sm:inline">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-2xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="in progress">In Progress</option>
                <option value="planning">Planning</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground font-medium hidden sm:inline">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-2xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="due_asc">Due Date</option>
                <option value="name_asc">Project Name (A-Z)</option>
                <option value="cost_desc">Budget (High to Low)</option>
              </select>
            </div>

            {/* Clear Button (shown only when any filters are applied) */}
            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="h-8.5 px-3 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 shrink-0 gap-1.5 font-semibold transition-all"
                title="Clear all active filters"
              >
                <XIcon className="size-3.5" />
                <span>Clear</span>
              </Button>
            )}
          </div>
        </div>

        {/* Active Client Filter Pill */}
        {selectedClientId !== 'ALL' && selectedClient && (
          <div className="flex items-center gap-2 pt-1 border-t border-border/60 text-xs">
            <span className="text-muted-foreground">Filtered for client:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20">
              <UserIcon className="size-3" />
              <span>{selectedClient.name}</span>
              <button
                type="button"
                onClick={() => setSelectedClientId('ALL')}
                className="hover:opacity-75 cursor-pointer ml-0.5"
                title="Clear client filter"
              >
                <XIcon className="size-3" />
              </button>
            </span>
            <span className="text-muted-foreground text-[11px]">
              ({filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'} found)
            </span>
          </div>
        )}
      </div>

      {/* 4. Projects Display Section */}
      {loading ? (
        <div className="p-16 text-center text-xs font-semibold text-muted-foreground animate-pulse">
          Loading site projects and fit-out stages...
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon="projects"
          title={search || statusFilter !== 'ALL' || selectedClientId !== 'ALL' ? 'No Matching Projects' : 'No Projects Available'}
          description={
            projects.length === 0
              ? 'No fit-out projects have been initiated yet. Click below to create your first project.'
              : 'No projects match your active search and filter criteria. Try clearing filters or searching for another term.'
          }
          action={
            canCreateProject && (
              <Button size="sm" onClick={() => navigate('/projects/new')}>
                Create First Project
              </Button>
            )
          }
        />
      ) : viewMode === 'grid' ? (
        /* ========================================================
           GRID VIEW (Cards matching the reference image, NO horizontal scroll)
           ======================================================== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {filteredProjects.map((project, cardIndex) => {
            const stages = project.stages || [];
            const totalStages = stages.length;
            const completedCount = stages.filter(
              (s) => (s.status || '').toLowerCase() === 'done' || (s.status || '').toLowerCase() === 'completed'
            ).length;
            const progressPercent = totalStages > 0 ? Math.round((completedCount / totalStages) * 100) : (project.status === 'completed' ? 100 : 0);
            const overdue = isProjectOverdue(project);

            const isHovered = hoveredCardId === project.id;

            return (
              <div
                key={project.id}
                className="relative"
                onMouseEnter={() => handleMouseEnterCard(project.id)}
                onMouseLeave={handleMouseLeaveCard}
              >
                {/* 
                  MAIN PROJECT BOX:
                  Shows ONLY:
                  1. complete/inprogress (Status Badge & ID)
                  2. project name
                  3. client name
                  4. due date
                  5. total cost of this project
                  Darker border (border-slate-300 dark:border-slate-700) to clearly differentiate boxes.
                */}
                <div
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className={cn(
                    'group rounded-xl border border-slate-300 dark:border-slate-700 bg-card p-5 transition-all duration-200 cursor-pointer shadow-xs hover:border-primary hover:shadow-md flex flex-col justify-between space-y-3.5 select-none min-h-[190px]',
                    isHovered && 'border-primary shadow-lg ring-1 ring-primary/20'
                  )}
                >
                  {/* 1. Status Badge & Project ID */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant={
                          project.status === 'completed'
                            ? 'success'
                            : project.status === 'planning'
                            ? 'neutral'
                            : project.status === 'on_hold'
                            ? 'warning'
                            : 'primary'
                        }
                        size="sm"
                        dot
                      >
                        {(project.status || 'in progress').toUpperCase()}
                      </Badge>
                      {overdue && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30 shrink-0">
                          <AlertIcon className="size-2.5" />
                          <span>Overdue</span>
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                      #{cardIndex + 1}
                    </span>
                  </div>

                  {/* 2. Project Name */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                      {project.name}
                    </h3>

                    {/* 3. Client Name */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                      <UserIcon className="size-3.5 text-primary shrink-0" />
                      <span className="truncate">
                        Client: <strong className="text-foreground">{getClientDisplayName(project, clients)}</strong>
                      </span>
                    </div>

                    {/* 4. Due Date */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarIcon className="size-3.5 text-primary shrink-0" />
                      <span>
                        Due Date:{' '}
                        <strong className={cn('font-mono', overdue ? 'text-destructive font-bold' : 'text-foreground')}>
                          {project.endDate || project.dueDate ? formatDate(project.endDate || project.dueDate) : 'Not specified'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* 5. Total Cost of this Project */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs mt-auto">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Total Cost
                    </span>
                    <span className="font-mono font-bold text-base text-foreground">
                      {project.totalCost ? formatCurrency(project.totalCost) : '₹0'}
                    </span>
                  </div>
                </div>

                {/* ========================================================
                    HOVER DETAIL POPOVER:
                    - Inset-0 fits the exact box boundaries (zero cropping!)
                    - Top: Project Status & Small Stages Progress Heading
                    - Middle: Project Name (where 12/12 Done message was)
                    - Only: View and Schedules buttons
                    ======================================================== */}
                {isHovered && (
                  <div
                    className="absolute inset-0 z-40 p-5 rounded-xl bg-card border-2 border-primary shadow-2xl flex flex-col justify-between animate-in fade-in zoom-in-95 duration-150 select-none"
                    onMouseEnter={() => handleMouseEnterCard(project.id)}
                    onMouseLeave={handleMouseLeaveCard}
                  >
                    {/* Top: Project Status & Small Stages Progress Heading */}
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">12 Project Stages</span>
                        <span>•</span>
                        <span className="font-mono font-bold text-primary">{completedCount}/{totalStages || 12} Done</span>
                      </div>
                      <Badge
                        variant={
                          project.status === 'completed'
                            ? 'success'
                            : project.status === 'planning'
                            ? 'neutral'
                            : project.status === 'on_hold'
                            ? 'warning'
                            : 'primary'
                        }
                        size="sm"
                        dot
                      >
                        {(project.status || 'in progress').toUpperCase()}
                      </Badge>
                    </div>

                    {/* Middle: Project Name (where 12/12 Done message was) & Sequential # */}
                    <div className="py-2.5 my-auto space-y-1.5">
                      <div className="flex items-start gap-2">
                        <span className="font-mono text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 shrink-0 mt-0.5">
                          #{cardIndex + 1}
                        </span>
                        <h3 className="font-bold text-base text-foreground line-clamp-2 leading-snug">
                          {project.name}
                        </h3>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                        <span className="truncate">
                          Client: <strong className="text-foreground">{getClientDisplayName(project, clients)}</strong>
                        </span>
                        <span className="font-semibold text-primary shrink-0">
                          {progressPercent}% Completed
                        </span>
                      </div>
                    </div>

                    {/* Buttons: View and Schedules Only */}
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects/${project.id}`);
                        }}
                      >
                        <EyeIcon className="size-3.5" />
                        <span>View</span>
                      </Button>
                      {isManagerOrAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenScheduleModal(project);
                          }}
                        >
                          <CalendarIcon className="size-3.5" />
                          <span>Schedules</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ========================================================
           LIST / TABLE VIEW (Clean tabular view, NO horizontal scroll)
           ======================================================== */
        <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-card overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <colgroup>
                <col className="w-[30%] sm:w-[28%]" /> {/* Project & ID */}
                <col className="w-[18%] sm:w-[17%]" /> {/* Client */}
                <col className="w-[12%] sm:w-[12%]" /> {/* Due Date */}
                <col className="w-[11%] sm:w-[11%]" /> {/* Stage Progress */}
                <col className="w-[12%] sm:w-[12%]" /> {/* Status */}
                <col className="w-[13%] sm:w-[14%]" /> {/* Budget */}
                <col className="w-16" />               {/* Actions */}
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  <th className="py-2.5 pl-4 pr-2">Project & ID</th>
                  <th className="py-2.5 px-2">Client</th>
                  <th className="py-2.5 px-2">Due Date</th>
                  <th className="py-2.5 px-2">Stage Progress</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 px-2">Budget</th>
                  <th className="py-2.5 pl-2 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {filteredProjects.map((project, idx) => {
                  const stages = project.stages || [];
                  const totalStages = stages.length;
                  const completedCount = stages.filter(
                    (s) => (s.status || '').toLowerCase() === 'done' || (s.status || '').toLowerCase() === 'completed'
                  ).length;
                  const progressPercent = totalStages > 0 ? Math.round((completedCount / totalStages) * 100) : (project.status === 'completed' ? 100 : 0);
                  const overdue = isProjectOverdue(project);
                  const clientDisplayName = getClientDisplayName(project, clients);

                  return (
                    <tr
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 pl-4 pr-2 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-foreground hover:text-primary transition-colors line-clamp-1">
                            {project.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-muted-foreground">
                        <span className="font-medium text-foreground truncate block max-w-[170px]" title={clientDisplayName}>
                          {clientDisplayName}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 font-mono whitespace-nowrap">
                        <span className={cn(overdue ? 'text-destructive font-bold' : 'text-foreground')}>
                          {project.endDate || project.dueDate ? formatDate(project.endDate || project.dueDate) : '-'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 font-mono font-bold text-xs text-foreground whitespace-nowrap">
                        {progressPercent}%
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <Badge
                          variant={
                            project.status === 'completed'
                              ? 'success'
                              : project.status === 'planning'
                              ? 'neutral'
                              : 'primary'
                          }
                          size="sm"
                          dot
                        >
                          {(project.status || 'in progress').toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 font-mono font-semibold text-foreground whitespace-nowrap">
                        {project.totalCost ? formatCurrency(project.totalCost) : '-'}
                      </td>
                      <td className="py-2.5 pl-2 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            title="View"
                            aria-label="View"
                            onClick={() => navigate(`/projects/${project.id}`)}
                            className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-muted transition-colors cursor-pointer"
                          >
                            <EyeIcon className="size-3.5" />
                          </button>
                          {isManagerOrAdmin && (
                            <button
                              type="button"
                              title="Schedules"
                              aria-label="Schedules"
                              onClick={() => handleOpenScheduleModal(project)}
                              className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-muted transition-colors cursor-pointer"
                            >
                              <CalendarIcon className="size-3.5" />
                            </button>
                          )}
                          {isManagerOrAdmin && (
                            <button
                              type="button"
                              title="Delete"
                              aria-label="Delete"
                              onClick={() => setDeleteProjectConfirm(project)}
                              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
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
        </div>
      )}

      {/* Manager Assign / Edit Stage Dates Modal */}
      <ScheduleStageModal
        isOpen={Boolean(editingStageData)}
        onClose={() => setEditingStageData(null)}
        data={editingStageData}
        onSave={handleSaveStageSchedule}
      />

      {/* Quick Edit Project Modal */}
      <QuickEditProjectModal
        isOpen={Boolean(editingProject)}
        onClose={() => setEditingProject(null)}
        project={editingProject}
        onSave={handleSaveProjectDetails}
      />

      {/* Confirm Delete Project Modal */}
      <ConfirmDeleteProjectModal
        isOpen={Boolean(deleteProjectConfirm)}
        onClose={() => setDeleteProjectConfirm(null)}
        data={deleteProjectConfirm}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

export default ProjectsPage;

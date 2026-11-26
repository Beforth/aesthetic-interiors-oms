import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { projectService } from '../services/projectService';
import { clientService } from '../services/clientService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePermission } from '../hooks/usePermission';
import { cn } from '../lib/utils';
import { parseDateSafe, formatCurrency } from '../utils/formatters';

import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Select from '../components/ui/Select';
import EmptyState from '../components/ui/EmptyState';
import PermissionGate from '../components/ui/PermissionGate';
import DataToolbar from '../components/ui/DataToolbar';
import ProgressBar from '../components/ui/ProgressBar';
import { CalendarIcon } from '../components/ui/icons';

const STATUS_VALUES = {
  active: ['in progress', 'running', 'active'],
  planning: ['planning', 'not started', 'draft'],
  completed: ['completed', 'done', 'handed over'],
  hold: ['on hold', 'on_hold', 'hold'],
};

const STATUS_DOT = {
  active: 'bg-primary',
  planning: 'bg-warning',
  completed: 'bg-success',
  hold: 'bg-muted-foreground',
};

const STATUS_CHIPS = [
  { id: 'ALL', label: 'All' },
  { id: 'planning', label: 'To do' },
  { id: 'active', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'hold', label: 'On hold' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Recently Added' },
  { value: 'due_asc', label: 'Due Soonest' },
  { value: 'progress_desc', label: 'Most Progress' },
  { value: 'cost_desc', label: 'Highest Budget' },
  { value: 'name_asc', label: 'Name (A–Z)' },
];

function getStatusGroup(project) {
  const raw = String(project?.status || '').trim().toLowerCase();
  return Object.keys(STATUS_VALUES).find((group) => STATUS_VALUES[group].includes(raw)) || 'active';
}

function getStatusLabel(project) {
  return {
    active: 'In progress',
    planning: 'To do',
    completed: 'Completed',
    hold: 'On hold',
  }[getStatusGroup(project)] || 'In progress';
}

function getDueDate(project) {
  return project?.endDate || project?.dueDate || project?.targetDate || null;
}

function isStageDone(stage) {
  const status = String(stage?.status || '').trim().toLowerCase();
  return status === 'done' || status === 'completed';
}

function isStageOverdue(stage) {
  if (isStageDone(stage) || !stage?.endDate) return false;
  const end = parseDateSafe(stage.endDate);
  if (!end) return false;
  end.setHours(23, 59, 59, 999);
  return end < new Date();
}

function getProjectProgress(project) {
  const stages = Array.isArray(project?.stages) ? project.stages : [];
  const done = stages.filter(isStageDone).length;
  return {
    percent: stages.length ? Math.round((done / stages.length) * 100) : (getStatusGroup(project) === 'completed' ? 100 : 0),
  };
}

function isProjectOverdue(project) {
  if (getStatusGroup(project) === 'completed') return false;
  const dueDate = getDueDate(project);
  if (dueDate) {
    const end = parseDateSafe(dueDate);
    if (end) {
      end.setHours(23, 59, 59, 999);
      if (end < new Date()) return true;
    }
  }
  return (project?.stages || []).some(isStageOverdue);
}

function getDeadline(project) {
  if (getStatusGroup(project) === 'completed') return { label: 'Delivered', className: 'text-success' };
  const dueDate = getDueDate(project);
  if (!dueDate) return { label: 'No deadline', className: 'text-muted-foreground' };
  const end = parseDateSafe(dueDate);
  if (!end) return { label: 'No deadline', className: 'text-muted-foreground' };
  end.setHours(23, 59, 59, 999);
  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, className: 'text-destructive' };
  if (days === 0) return { label: 'Due today', className: 'text-warning' };
  if (days === 1) return { label: 'Tomorrow', className: 'text-warning' };
  return { label: `${days} days left`, className: days <= 7 ? 'text-warning' : 'text-foreground' };
}

function getClientDisplayName(project, clients = []) {
  if (project?.clientId) {
    const client = clients.find((c) => String(c.id) === String(project.clientId));
    if (client?.name && !/^\+?[\d\s-]{7,}$/.test(client.name.trim())) return client.name.trim();
  }
  const raw = String(project?.clientName || '').trim();
  if (raw && !/^\+?[\d\s-]{7,}$/.test(raw)) return raw;
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 7) {
    const matched = clients.find((c) => {
      const phoneDigits = String(c.phone || '').replace(/\D/g, '');
      return phoneDigits && (phoneDigits.endsWith(digits) || digits.endsWith(phoneDigits));
    });
    if (matched?.name && !/^\+?[\d\s-]{7,}$/.test(matched.name.trim())) return matched.name.trim();
  }
  return 'Private Client';
}

function StatusPill({ project }) {
  const group = getStatusGroup(project);
  const styles = {
    active: 'bg-primary/10 text-primary',
    planning: 'bg-muted text-muted-foreground',
    completed: 'bg-success/10 text-success',
    hold: 'bg-warning/10 text-warning',
  }[group] || 'bg-muted text-muted-foreground';
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', styles)}>
      <span className={cn('size-1.5 rounded-full', STATUS_DOT[group] || STATUS_DOT.active)} />
      {getStatusLabel(project)}
    </span>
  );
}

function FilterPill({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
      )}
    >
      {label}
      {count !== undefined && (
        <span className={cn('font-mono text-[10px]', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{count}</span>
      )}
    </button>
  );
}

function ProjectCard({ project, clientName, onOpen }) {
  const progress = getProjectProgress(project);
  const overdue = isProjectOverdue(project);
  const deadline = getDeadline(project);

  const open = () => onOpen(project);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
      aria-label={`Open project ${project.name}`}
      data-no-tooltip
      className="block h-full cursor-pointer text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card
        bodyClassName="p-5"
        className="h-full rounded-xl border-border bg-card transition-colors hover:border-primary/50 hover:bg-muted/30"
      >
        <div className="flex items-center justify-between gap-2">
          <StatusPill project={project} />
          <span className="font-mono text-[10px] text-muted-foreground">{project.id}</span>
        </div>

        <h3 className="mt-4 truncate text-base font-semibold tracking-tight text-foreground">{project.name}</h3>
        <p className="mt-1 truncate text-xs text-muted-foreground">{clientName}</p>

        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-mono font-semibold text-foreground">{progress.percent}%</span>
          </div>
          <ProgressBar
            value={progress.percent}
            size="sm"
            color={overdue ? 'warning' : progress.percent === 100 ? 'success' : 'brand'}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className={cn('inline-flex items-center gap-1.5 truncate text-xs font-medium', deadline.className)}>
            <CalendarIcon className="size-3.5 shrink-0" />
            {deadline.label}
          </span>
          <span className="shrink-0 font-mono text-xs font-semibold text-foreground">{formatCurrency(project.totalCost)}</span>
        </div>
      </Card>
    </div>
  );
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAuth();
  const toast = useToast();
  const canCreateProject = usePermission('projects.create');
  // A client sees only their own projects.
  const isClientOnly = hasPermission('projects.viewOwn') && !hasPermission('projects.viewAll');

  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [projectRows, clientRows] = await Promise.all([
        projectService.getAllProjects(currentUser),
        clientService.getAllClients(currentUser),
      ]);
      setProjects(projectRows || []);
      setClients(clientRows || []);
      // A client with a single project goes straight to its progress and updates.
      if (isClientOnly && projectRows?.length === 1) {
        navigate(`/projects/${projectRows[0].id}`, { replace: true });
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [currentUser, toast, isClientOnly, navigate]);

  useEffect(() => {
    fetchAll();
    const reload = () => fetchAll();
    const events = ['osm_projects_changed', 'osm_project_created', 'osm_project_updated', 'osm_project_deleted'];
    events.forEach((event) => window.addEventListener(event, reload));
    return () => events.forEach((event) => window.removeEventListener(event, reload));
  }, [fetchAll]);

  const stats = useMemo(() => ({
    total: projects.length,
    planning: projects.filter((project) => getStatusGroup(project) === 'planning').length,
    active: projects.filter((project) => getStatusGroup(project) === 'active').length,
    completed: projects.filter((project) => getStatusGroup(project) === 'completed').length,
    hold: projects.filter((project) => getStatusGroup(project) === 'hold').length,
    overdue: projects.filter(isProjectOverdue).length,
  }), [projects]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = projects.filter((project) => {
      if (query) {
        const haystack = [project.name, getClientDisplayName(project, clients), project.siteAddress, project.id]
          .map((value) => String(value || '').toLowerCase()).join(' ');
        if (!haystack.includes(query)) return false;
      }
      if (statusFilter !== 'ALL' && getStatusGroup(project) !== statusFilter) return false;
      return true;
    });

    result.sort((a, b) => {
      if (sortBy === 'due_asc') {
        const dateA = parseDateSafe(getDueDate(a)) || new Date(8640000000000000);
        const dateB = parseDateSafe(getDueDate(b)) || new Date(8640000000000000);
        return dateA - dateB;
      }
      if (sortBy === 'progress_desc') return getProjectProgress(b).percent - getProjectProgress(a).percent;
      if (sortBy === 'cost_desc') return (Number(b.totalCost) || 0) - (Number(a.totalCost) || 0);
      if (sortBy === 'name_asc') return String(a.name || '').localeCompare(String(b.name || ''));
      return 0;
    });
    return result;
  }, [projects, clients, search, statusFilter, sortBy]);

  const hasActiveFilters = Boolean(search.trim() || statusFilter !== 'ALL' || sortBy !== 'newest');
  const clearFilters = () => { setSearch(''); setStatusFilter('ALL'); setSortBy('newest'); };

  const chipCounts = {
    ALL: stats.total,
    planning: stats.planning,
    active: stats.active,
    completed: stats.completed,
    hold: stats.hold,
  };

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Projects"
        subtitle="Every site at a glance. Open a project for full details."
        actions={
          <PermissionGate permission="projects.create">
            <Button variant="primary" size="sm" leadingIcon="plus" onClick={() => navigate('/projects/new')}>New Project</Button>
          </PermissionGate>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{stats.total} projects</span>
        <span className="text-border">•</span>
        <span>{stats.active} in progress</span>
        <span className="text-border">•</span>
        <span>{stats.completed} completed</span>
        <span className="text-border">•</span>
        <span className={stats.overdue > 0 ? 'font-semibold text-destructive' : ''}>{stats.overdue} need attention</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_CHIPS.map((chip) => (
          <FilterPill
            key={chip.id}
            label={chip.label}
            count={chipCounts[chip.id]}
            active={statusFilter === chip.id}
            onClick={() => setStatusFilter(chip.id)}
          />
        ))}
      </div>

      <DataToolbar
        variant="clean"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search projects..."
        totalCount={filteredProjects.length}
        filters={
          <div className="w-48">
            <Select value={sortBy} onChange={(event) => setSortBy(event.target.value)} options={SORT_OPTIONS} />
          </div>
        }
        actions={hasActiveFilters ? <Button variant="outline" size="sm" onClick={clearFilters}>Clear</Button> : undefined}
      />

      {loading ? (
        <Card bodyClassName="p-12 text-center text-xs font-semibold text-muted-foreground animate-pulse">Loading projects...</Card>
      ) : projects.length === 0 ? (
        <EmptyState
          icon="projects"
          title="No Projects Yet"
          description="Create a project to start tracking stages, teams and site partners."
          action={canCreateProject ? <Button size="sm" onClick={() => navigate('/projects/new')}>Create Project</Button> : undefined}
        />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon="projects"
          title="No Matching Projects"
          description="Try a different search or clear the filters."
          action={<Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              clientName={getClientDisplayName(project, clients)}
              onOpen={(item) => navigate(`/projects/${item.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectsPage;

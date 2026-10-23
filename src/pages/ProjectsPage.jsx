import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { clientService } from '../services/clientService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePermission } from '../hooks/usePermission';
import { ROLES, ROLE_LABELS } from '../config/roles';
import { validateRequired, validatePositiveNumber } from '../utils/validators';

import PageHeader from '../components/ui/PageHeader';
import DataToolbar from '../components/ui/DataToolbar';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import Icon from '../components/ui/Icon';
import ProjectCard from '../components/domain/ProjectCard';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import EmptyState from '../components/ui/EmptyState';
import AssigneePicker from '../components/domain/AssigneePicker';
import PermissionGate from '../components/ui/PermissionGate';

const STATUS_COLUMNS = [
  {
    key: 'not started',
    aliases: ['not started', 'pending', 'planning'],
    label: 'Planning & Kickoff',
    color: 'border-t-sky-500',
    countBadge: 'bg-sky-100 text-sky-800',
    dotColor: 'bg-sky-500',
  },
  {
    key: 'in progress',
    aliases: ['in progress', 'active', 'ongoing'],
    label: 'Fit-Out In Progress',
    color: 'border-t-brand-600',
    countBadge: 'bg-brand-100 text-brand-800',
    dotColor: 'bg-brand-600',
  },
  {
    key: 'completed',
    aliases: ['completed', 'done', 'handed over'],
    label: 'Completed & Handed Over',
    color: 'border-t-emerald-600',
    countBadge: 'bg-emerald-100 text-emerald-800',
    dotColor: 'bg-emerald-600',
  },
];

export function ProjectsPage() {
  const navigate = useNavigate();
  const { currentUser, role, hasPermission } = useAuth();
  // The widest permission wins: the Owner holds all three, so only "viewAll" decides for them.
  const canViewAll = hasPermission('projects.viewAll');
  const isClientView = hasPermission('projects.viewOwn') && !canViewAll;
  const isAssignedView = hasPermission('projects.viewAssigned') && !canViewAll;
  const toast = useToast();
  const canCreateProject = usePermission('projects.create');
  const canEditProjectStatus =
    hasPermission('stages.editProjectStages') ||
    hasPermission('projects.create') ||
    role !== 'client';

  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // View mode: 'board' (Kanban default) or 'grid' (cards)
  const [viewMode, setViewMode] = useState('board');
  const [dragOverCol, setDragOverCol] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Create Project Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    clientId: '',
    siteAddress: '',
    startDate: '2026-10-20',
    totalCost: '',
    supervisors: [],
    workers: [],
  });
  const [formErrors, setFormErrors] = useState({});

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [projList, clientList, userList] = await Promise.all([
        projectService.getAllProjects(currentUser),
        clientService.getAllClients(currentUser),
        userService.getAllUsers(),
      ]);
      setProjects(projList);
      setClients(clientList);
      setUsers(userList);
    } catch (err) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [currentUser]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        search === '' ||
        p.name.toLowerCase().includes(q) ||
        (p.clientName && p.clientName.toLowerCase().includes(q)) ||
        (p.siteAddress && p.siteAddress.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'ALL' ||
        (p.status || '').toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [projects, search, statusFilter]);

  // Drag and drop project status changer
  const handleDropProject = async (projectId, targetStatus) => {
    if (!canEditProjectStatus) {
      toast.error('Only authorized personnel (Admin / Manager) can update project status');
      return;
    }
    const targetProj = projects.find((p) => p.id === projectId);
    if (!targetProj) return;

    const currentStatus = (targetProj.status || 'in progress').toLowerCase();
    if (currentStatus === targetStatus.toLowerCase()) return;

    try {
      await projectService.updateProjectStatus(projectId, targetStatus);
      const label =
        targetStatus === 'in progress'
          ? 'In Progress'
          : targetStatus === 'completed'
          ? 'Completed'
          : 'Planning';
      toast.success(`Project "${targetProj.name}" moved to ${label}`);
      fetchAll();
    } catch (err) {
      toast.error('Failed to update project status');
    }
  };

  // Quick sequential advance handler
  const handleAdvanceProjectStatus = async (project) => {
    if (!canEditProjectStatus) {
      toast.error('Only authorized personnel (Admin / Manager) can update project status');
      return;
    }
    const current = (project.status || 'in progress').toLowerCase();
    const nextStatus =
      current === 'not started' || current === 'pending' || current === 'planning'
        ? 'in progress'
        : current === 'in progress'
        ? 'completed'
        : 'not started';

    try {
      await projectService.updateProjectStatus(project.id, nextStatus);
      toast.success(
        nextStatus === 'completed'
          ? `Project "${project.name}" marked as completed!`
          : `Project moved to "${nextStatus}"`
      );
      fetchAll();
    } catch (err) {
      toast.error('Failed to update project status');
    }
  };

  const handleOpenCreate = () => {
    setFormData({
      name: '',
      clientId: clients[0]?.id || '',
      siteAddress: '',
      startDate: '2026-10-20',
      totalCost: '',
      supervisors: [],
      workers: [],
    });
    setFormErrors({});
    setIsCreateOpen(true);
  };

  const handleClientSelect = (clientId) => {
    const selected = clients.find((c) => c.id === clientId);
    setFormData((prev) => ({
      ...prev,
      clientId,
      siteAddress: selected?.address || prev.siteAddress,
      name: prev.name || (selected ? `${selected.name} Residence` : ''),
    }));
  };

  const validate = () => {
    const errs = {};
    const nameErr = validateRequired(formData.name, 'Project title', 3);
    if (nameErr) errs.name = nameErr;

    if (!formData.clientId) errs.clientId = 'Please select a linked client';

    const costErr = validatePositiveNumber(formData.totalCost, 'Total contract cost', { min: 10000 });
    if (costErr) errs.totalCost = costErr;

    if (!formData.startDate) errs.startDate = 'Project kickoff date is required';

    const addrErr = validateRequired(formData.siteAddress, 'Site address', 5);
    if (addrErr) errs.siteAddress = addrErr;

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const client = clients.find((c) => c.id === formData.clientId);
      const created = await projectService.createProject({
        ...formData,
        clientName: client?.name || 'Client',
        clientEmail: client?.email || '',
      });
      toast.success(`Project ${created.name} initiated with 12 stages!`);
      setIsCreateOpen(false);
      fetchAll();
      navigate(`/projects/${created.id}`);
    } catch (err) {
      toast.error('Failed to create project');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={isClientView ? 'My Project Overview' : 'Fit-Out Projects'}
        subtitle={
          isClientView
            ? 'Execution milestones, stage progress, and site inspection status'
            : `All active fit-out sites (${projects.length} sites accessible to ${ROLE_LABELS[role] || role})`
        }
        breadcrumbs={[
          { label: 'Operations', path: '/dashboard' },
          { label: 'Projects' },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle: Kanban Board vs Cards Grid */}
            <div className="flex items-center border border-border rounded-lg bg-surface p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('board')}
                className={`px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'board'
                    ? 'bg-brand-50 text-brand-700 shadow-2xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
                title="Kanban Board View"
              >
                <Icon name="columns" size={14} />
                <span className="hidden sm:inline">Kanban Board</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-brand-50 text-brand-700 shadow-2xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
                title="Cards Grid View"
              >
                <Icon name="grid" size={14} />
                <span className="hidden sm:inline">Cards Grid</span>
              </button>
            </div>

            <PermissionGate permission="projects.create">
              <Button
                variant="primary"
                size="sm"
                leadingIcon="plus"
                onClick={handleOpenCreate}
              >
                Initiate New Project
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {/* Toolbar */}
      <DataToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search projects by site, client, or location..."
        totalCount={filteredProjects.length}
        filters={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors min-h-[44px] sm:min-h-0 cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-brand-600 text-surface'
                  : 'bg-surface text-text-muted hover:text-text-main border border-border'
              }`}
            >
              All Status
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('not started')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors min-h-[44px] sm:min-h-0 cursor-pointer ${
                statusFilter === 'not started'
                  ? 'bg-brand-600 text-surface'
                  : 'bg-surface text-text-muted hover:text-text-main border border-border'
              }`}
            >
              Planning
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('in progress')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors min-h-[44px] sm:min-h-0 cursor-pointer ${
                statusFilter === 'in progress'
                  ? 'bg-brand-600 text-surface'
                  : 'bg-surface text-text-muted hover:text-text-main border border-border'
              }`}
            >
              In Progress
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors min-h-[44px] sm:min-h-0 cursor-pointer ${
                statusFilter === 'completed'
                  ? 'bg-brand-600 text-surface'
                  : 'bg-surface text-text-muted hover:text-text-main border border-border'
              }`}
            >
              Completed
            </button>
          </div>
        }
      />

      {/* Projects Display */}
      {loading ? (
        <div className="p-12 text-center text-xs text-text-muted">
          Loading site projects...
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon="projects"
          title={search || statusFilter !== 'ALL' ? 'No Projects Found' : 'No data available yet'}
          description={
            projects.length === 0
              ? 'No fit-out projects have been initiated yet. Click below to create your first project.'
              : isAssignedView
              ? 'You are not assigned to any active site projects matching this filter.'
              : 'Try clearing the search query or initiate a new project contract.'
          }
          action={
            canCreateProject && (
              <Button size="sm" onClick={handleOpenCreate}>
                Create First Project
              </Button>
            )
          }
        />
      ) : viewMode === 'board' ? (
        /* KANBAN BOARD VIEW: grid grid-cols-1 md:grid-cols-3 gap-4 */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STATUS_COLUMNS.map((col) => {
            const colProjects = filteredProjects.filter((p) => {
              const pStatus = (p.status || 'in progress').toLowerCase();
              return col.aliases.includes(pStatus);
            });
            const isTarget = dragOverCol === col.key;

            return (
              <div
                key={col.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverCol !== col.key) setDragOverCol(col.key);
                }}
                onDragLeave={() => {
                  if (dragOverCol === col.key) setDragOverCol(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverCol(null);
                  const projectId = e.dataTransfer.getData('text/plain');
                  if (projectId) handleDropProject(projectId, col.key);
                }}
                className={`space-y-3 p-1 rounded-xl transition-all ${
                  isTarget ? 'bg-brand-50/80 ring-2 ring-brand-400' : ''
                }`}
              >
                {/* Column Header */}
                <div
                  className={`flex items-center justify-between p-3 rounded-xl border border-border bg-surface border-t-4 ${col.color} shadow-2xs`}
                >
                  <div className="font-bold text-xs uppercase tracking-wider text-text-main flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                    <span>{col.label}</span>
                    <span
                      className={`w-5 h-5 rounded-full ${col.countBadge} text-[11px] font-mono flex items-center justify-center font-bold`}
                    >
                      {colProjects.length}
                    </span>
                  </div>
                  {canCreateProject && col.key === 'not started' && (
                    <IconButton
                      icon="plus"
                      size="xs"
                      ariaLabel="Initiate Project"
                      onClick={handleOpenCreate}
                    />
                  )}
                </div>

                {/* Column Cards Drop Area */}
                <div className="space-y-3 min-h-[420px]">
                  {colProjects.length === 0 ? (
                    <div className="p-8 text-center text-xs text-text-muted border-2 border-dashed border-border/80 rounded-xl bg-surface/50">
                      No sites in {col.label.toLowerCase()}
                      {canEditProjectStatus && (
                        <p className="text-[11px] text-text-muted mt-1">
                          Drag a project card here to update status
                        </p>
                      )}
                    </div>
                  ) : (
                    colProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        teamUsers={users}
                        draggable={canEditProjectStatus}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', project.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        canAdvance={canEditProjectStatus}
                        onAdvance={handleAdvanceProjectStatus}
                        onClick={() => navigate(`/projects/${project.id}`)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* STANDARD CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              teamUsers={users}
              canAdvance={canEditProjectStatus}
              onAdvance={handleAdvanceProjectStatus}
              onClick={() => navigate(`/projects/${project.id}`)}
            />
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Initiate New Fit-out Project"
        subtitle="Generates 12 standard stages from template and assigns site personnel"
        size="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateSubmit}>
              Create & Generate 12 Stages
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Project Name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Koramangala 4BHK Duplex Fit-out"
            error={formErrors.name}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Select Client"
              required
              value={formData.clientId}
              onChange={(e) => handleClientSelect(e.target.value)}
              options={clients.map((c) => ({
                value: c.id,
                label: `${c.name} (${c.type === 'old' ? 'Existing' : 'New'})`,
              }))}
              error={formErrors.clientId}
            />

            <Input
              label="Total Cost Estimate (INR)"
              required
              type="number"
              value={formData.totalCost}
              onChange={(e) =>
                setFormData({ ...formData, totalCost: e.target.value })
              }
              placeholder="e.g. 4500000"
              error={formErrors.totalCost}
              helperText="Indian Rupee contract estimation"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Project Commencement Date"
              type="date"
              required
              value={formData.startDate}
              onChange={(e) =>
                setFormData({ ...formData, startDate: e.target.value })
              }
              error={formErrors.startDate}
            />
            <Input
              label="Site Address"
              required
              value={formData.siteAddress}
              onChange={(e) =>
                setFormData({ ...formData, siteAddress: e.target.value })
              }
              placeholder="Full site location & landmark"
              error={formErrors.siteAddress}
            />
          </div>

          {/* Supervisor Assignee Picker */}
          <AssigneePicker
            label="Assign Site Supervisors"
            roleFilter={ROLES.SUPERVISOR}
            users={users}
            value={formData.supervisors}
            onChange={(selected) =>
              setFormData({ ...formData, supervisors: selected })
            }
            placeholder="Select one or more supervisors (e.g. Vikram Jadhav)..."
          />

          {/* Worker Assignee Picker */}
          <AssigneePicker
            label="Assign Site Workers & Artisans"
            roleFilter={ROLES.WORKER}
            users={users}
            value={formData.workers}
            onChange={(selected) =>
              setFormData({ ...formData, workers: selected })
            }
            placeholder="Select craftsmen (e.g. Ramesh Shinde, Suresh Gaikwad)..."
          />
        </form>
      </Modal>
    </div>
  );
}

export default ProjectsPage;

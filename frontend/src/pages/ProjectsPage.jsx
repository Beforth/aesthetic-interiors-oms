import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { clientService } from '../services/clientService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePermission } from '../hooks/usePermission';
import { ROLES, ROLE_LABELS } from '../config/roles';

import PageHeader from '../components/ui/PageHeader';
import DataToolbar from '../components/ui/DataToolbar';
import Button from '../components/ui/Button';
import ProjectCard from '../components/domain/ProjectCard';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import EmptyState from '../components/ui/EmptyState';
import AssigneePicker from '../components/domain/AssigneePicker';
import PermissionGate from '../components/ui/PermissionGate';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { currentUser, role } = useAuth();
  const toast = useToast();
  const canCreateProject = usePermission('projects.create');

  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

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
        statusFilter === 'ALL' || p.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [projects, search, statusFilter]);

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
    if (!formData.name.trim()) errs.name = 'Project title is required';
    if (!formData.clientId) errs.clientId = 'Please link a client';
    if (!formData.totalCost || isNaN(Number(formData.totalCost))) {
      errs.totalCost = 'Please enter a valid total cost in INR';
    }
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
        title={role === ROLES.CLIENT ? 'My Project Overview' : 'Fit-Out Projects'}
        subtitle={
          role === ROLES.CLIENT
            ? 'Execution milestones, stage progress, and site inspection status'
            : `All active fit-out sites (${projects.length} sites accessible to ${ROLE_LABELS[role] || role})`
        }
        breadcrumbs={[
          { label: 'Operations', path: '/dashboard' },
          { label: 'Projects' },
        ]}
        actions={
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
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors min-h-[44px] sm:min-h-0 ${
                statusFilter === 'ALL'
                  ? 'bg-brand-600 text-surface'
                  : 'bg-surface text-text-muted hover:text-text-main border border-border'
              }`}
            >
              All Status
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('in progress')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors min-h-[44px] sm:min-h-0 ${
                statusFilter === 'in progress'
                  ? 'bg-brand-600 text-surface'
                  : 'bg-surface text-text-muted hover:text-text-main border border-border'
              }`}
            >
              In Progress
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('done')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors min-h-[44px] sm:min-h-0 ${
                statusFilter === 'done'
                  ? 'bg-brand-600 text-surface'
                  : 'bg-surface text-text-muted hover:text-text-main border border-border'
              }`}
            >
              Completed
            </button>
          </div>
        }
      />

      {/* Projects Grid */}
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
              : role === ROLES.SUPERVISOR || role === ROLES.WORKER
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              teamUsers={users}
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
            />
            <Input
              label="Site Address"
              value={formData.siteAddress}
              onChange={(e) =>
                setFormData({ ...formData, siteAddress: e.target.value })
              }
              placeholder="Full site location & landmark"
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

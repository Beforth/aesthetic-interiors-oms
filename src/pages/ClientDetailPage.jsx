import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clientService } from '../services/clientService';
import { projectService } from '../services/projectService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePermission } from '../hooks/usePermission';
import { formatDate, formatCurrency } from '../utils/formatters';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import DetailList from '../components/ui/DetailList';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import Select from '../components/ui/Select';
import EmptyState from '../components/ui/EmptyState';
import PermissionGate from '../components/ui/PermissionGate';
import { Badge } from '../components/ui/Badge';
import StatCard from '../components/ui/StatCard';
import {
  TrashIcon,
  FolderIcon,
  BuildingIcon,
  CheckCircleIcon,
  IndianRupeeIcon,
} from '../components/ui/icons';
import { Kanban } from '../components/ui/kanban';
import StatusBadge from '../components/ui/StatusBadge';
import { calculateProgress } from '../utils/progress';
import { cn } from '../lib/utils';

const CLIENT_PROJECT_KANBAN_COLUMNS = [
  {
    id: 'active',
    title: 'Current Working Projects',
    tone: 'success',
    emptyText: 'No active projects currently running',
  },
  {
    id: 'completed',
    title: 'Previous & Completed Projects',
    tone: 'info',
    emptyText: 'No completed projects on record',
  },
];

export function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const toast = useToast();
  const canManageClients = usePermission('clients.manage');

  const [client, setClient] = useState(null);
  const [clientProjects, setClientProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit Client Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    type: 'new',
  });

  // Link Existing Project Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedProjectIdToLink, setSelectedProjectIdToLink] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);

  // Delete Project State
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deleteProjectLoading, setDeleteProjectLoading] = useState(false);

  // Add New Project Modal State
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [newProjectData, setNewProjectData] = useState({
    name: '',
    siteAddress: '',
    totalCost: '3500000',
    startDate: new Date().toISOString().split('T')[0],
    targetDate: '',
  });
  const [addProjectLoading, setAddProjectLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [clientData, projectList, allUsers] = await Promise.all([
        clientService.getClientById(id, currentUser),
        projectService.getAllProjects(currentUser),
        userService.getAllUsers(),
      ]);

      if (!clientData) {
        toast.error('Client record not found or access restricted');
        navigate('/clients');
        return;
      }

      const clientType = clientData.type === 'old' || clientData.status === 'old' ? 'old' : 'new';
      setClient({
        ...clientData,
        type: clientType,
        status: clientType,
      });

      setFormData({
        name: clientData.name,
        phone: clientData.phone || '',
        email: clientData.email || '',
        address: clientData.address || '',
        notes: clientData.notes || '',
        type: clientType,
      });

      setAllProjects(projectList);

      // Filter projects belonging to this client across clientId, email, or clientName
      const matchingProjects = projectList.filter((p) => {
        if (!p) return false;
        const matchId = p.clientId && String(p.clientId) === String(clientData.id);
        const matchEmail =
          p.clientEmail &&
          clientData.email &&
          p.clientEmail.toLowerCase() === clientData.email.toLowerCase();
        const matchName =
          p.clientName &&
          clientData.name &&
          p.clientName.trim().toLowerCase() === clientData.name.trim().toLowerCase();
        return matchId || matchEmail || matchName;
      });

      setClientProjects(matchingProjects);
      setUsers(allUsers);
    } catch (err) {
      toast.error('Failed to load client details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, currentUser]);

  // Synchronize if client was updated externally
  useEffect(() => {
    const handleSync = (e) => {
      if (e.detail && e.detail.id === id) {
        const clientType = e.detail.type === 'old' || e.detail.status === 'old' ? 'old' : 'new';
        setClient({
          ...e.detail,
          type: clientType,
          status: clientType,
        });
      }
    };
    window.addEventListener('osm_client_updated', handleSync);
    return () => window.removeEventListener('osm_client_updated', handleSync);
  }, [id]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      const type = formData.type || 'new';
      const payload = {
        ...formData,
        type,
        status: type,
      };

      const updated = await clientService.updateClient(client.id, payload);
      setClient({
        ...updated,
        type,
        status: type,
      });
      setFormData(payload);
      setIsEditOpen(false);
      toast.success('Client updated successfully');
    } catch (err) {
      toast.error('Failed to update client');
    }
  };

  // Open Add Project Modal with pre-filled client details
  const handleOpenAddProject = () => {
    setNewProjectData({
      name: `${client.name}'s Fit-out`,
      siteAddress: client.address || 'Bengaluru, Karnataka',
      totalCost: '3500000',
      startDate: new Date().toISOString().split('T')[0],
      targetDate: '',
    });
    setIsAddProjectModalOpen(true);
  };

  // Submit Add Project
  const handleAddProjectSubmit = async (e) => {
    e.preventDefault();
    if (!newProjectData.name.trim()) {
      toast.error('Project name is required');
      return;
    }
    setAddProjectLoading(true);
    try {
      const created = await projectService.createProject({
        ...newProjectData,
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.email,
        siteAddress: newProjectData.siteAddress || client.address,
      });
      toast.success(`Project "${created.name}" created and linked to ${client.name}`);
      setIsAddProjectModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to create project');
    } finally {
      setAddProjectLoading(false);
    }
  };

  // Submit Link Project
  const handleLinkProjectSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProjectIdToLink) {
      toast.error('Please select an existing project to link');
      return;
    }
    setLinkLoading(true);
    try {
      await projectService.linkProjectToClient(selectedProjectIdToLink, client);
      toast.success('Project linked to client successfully');
      setSelectedProjectIdToLink('');
      setIsLinkModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to link project');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleConfirmDeleteProject = async () => {
    if (!projectToDelete) return;
    setDeleteProjectLoading(true);
    try {
      await projectService.deleteProject(projectToDelete.id);
      toast.success(`Project "${projectToDelete.name}" deleted successfully`);
      setProjectToDelete(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to delete project');
    } finally {
      setDeleteProjectLoading(false);
    }
  };

  // Partition client projects into active working and previous completed
  const activeWorkingProjects = useMemo(() => {
    return clientProjects.filter(
      (p) => p.status !== 'completed' && p.status !== 'done'
    );
  }, [clientProjects]);

  const previousCompletedProjects = useMemo(() => {
    return clientProjects.filter(
      (p) => p.status === 'completed' || p.status === 'done'
    );
  }, [clientProjects]);

  // Combined project investment
  const totalBudget = useMemo(() => {
    return clientProjects.reduce((acc, p) => acc + (Number(p.totalCost) || 0), 0);
  }, [clientProjects]);

  // Projects that can be linked to this client (excluding already mapped ones)
  const availableProjectsToLink = useMemo(() => {
    const linkedIds = new Set(clientProjects.map((p) => p.id));
    return allProjects.filter((p) => !linkedIds.has(p.id));
  }, [allProjects, clientProjects]);

  // BefUI Kanban Board Data for Active Working vs Previous Completed fit-out sites
  const kanbanBoardValue = useMemo(() => {
    return {
      active: activeWorkingProjects,
      completed: previousCompletedProjects,
    };
  }, [activeWorkingProjects, previousCompletedProjects]);

  // Handle stage/status progression when dragging across Kanban columns
  const handleKanbanChange = async (nextBoard) => {
    const nextActive = nextBoard.active || [];
    const nextCompleted = nextBoard.completed || [];

    // Detect if a project was moved into Completed column
    const movedToCompleted = nextCompleted.find((p) =>
      activeWorkingProjects.some((ap) => ap.id === p.id)
    );
    if (movedToCompleted) {
      try {
        await projectService.updateProject(movedToCompleted.id, {
          status: 'completed',
        });
        toast.success(`Project "${movedToCompleted.name}" marked as completed`);
        fetchData();
        return;
      } catch (err) {
        toast.error('Failed to update project status');
      }
    }

    // Detect if a project was moved back into Active column
    const movedToActive = nextActive.find((p) =>
      previousCompletedProjects.some((cp) => cp.id === p.id)
    );
    if (movedToActive) {
      try {
        await projectService.updateProject(movedToActive.id, {
          status: 'in progress',
        });
        toast.success(`Project "${movedToActive.name}" moved to active execution`);
        fetchData();
        return;
      } catch (err) {
        toast.error('Failed to update project status');
      }
    }

    // In-column reordering
    setClientProjects([...nextActive, ...nextCompleted]);
  };

  /**
   * Compact project card renderer for Client Overview Kanban.
   * Displays strictly:
   * 1. Project Name (with status badge)
   * 2. Progress (current stage & progress track)
   * 3. Total Cost
   */
  const renderCompactProjectCard = (project) => {
    const isCompleted = project.status === 'completed' || project.status === 'done';
    const progress = isCompleted
      ? 100
      : project.progress !== undefined && project.progress !== null
      ? Number(project.progress)
      : calculateProgress(project.stages || []);

    const stageName = isCompleted
      ? 'Delivered'
      : (project.stages || []).find((s) => s.status === 'in progress')?.name ||
        (project.stages || []).find((s) => s.status === 'not started')?.name ||
        project.stages?.[project.stages.length - 1]?.name ||
        'Execution';

    return (
      <div
        onClick={() => navigate(`/projects/${project.id}`)}
        className="flex w-full flex-col gap-2 select-none group cursor-pointer"
        title={`Open project: ${project.name}`}
      >
        {/* 1. Project Name, Status Badge & Delete Button */}
        <div className="flex items-start justify-between gap-2">
          <h5 className="min-w-0 flex-1 truncate text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {project.name}
          </h5>
          <div className="flex shrink-0 items-center gap-1.5">
            <StatusBadge status={project.status || 'in progress'} size="sm" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setProjectToDelete(project);
              }}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer"
              title={`Delete project "${project.name}"`}
            >
              <TrashIcon className="size-3.5" />
            </button>
          </div>
        </div>

        {/* 2. Progress */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="truncate">{stageName}</span>
            <span className="font-mono font-semibold text-foreground">{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                progress === 100 ? 'bg-success' : 'bg-primary'
              )}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>

        {/* 3. Total Cost */}
        <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Cost
          </span>
          <span className="font-mono font-semibold text-foreground">
            {formatCurrency(project.totalCost || project.budget || 0)}
          </span>
        </div>
      </div>
    );
  };

  if (loading || !client) {
    return (
      <div className="p-8 text-center text-xs text-text-muted">
        Loading client profile...
      </div>
    );
  }

  const isOld = client.type === 'old' || client.status === 'old';

  const detailItems = [
    { label: 'Phone Number', value: client.phone || 'None on record' },
    { label: 'Email Address', value: client.email || 'None on record' },
    { label: 'Registered On', value: formatDate(client.createdAt) },
    {
      label: 'Associated Projects',
      value: (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">
            {clientProjects.length} {clientProjects.length === 1 ? 'Site' : 'Sites'}
          </span>
          {clientProjects.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({activeWorkingProjects.length} active • {previousCompletedProjects.length} completed)
            </span>
          )}
        </div>
      ),
    },
    {
      label: 'Primary Site Address',
      value: client.address || 'Bengaluru, Karnataka',
      fullWidth: true,
    },
    {
      label: 'Architectural & Design Notes',
      value: (
        <span className="text-xs leading-relaxed text-foreground">
          {client.notes || 'No custom notes provided.'}
        </span>
      ),
      fullWidth: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Left Navigation: Back to Directory button */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          leadingIcon="arrow-left"
          onClick={() => navigate('/clients')}
          className="text-xs font-semibold hover:bg-muted"
        >
          Back to Directory
        </Button>
      </div>

      {/* Page Header with Client Name & Prominent Status Badge */}
      <PageHeader
        title={
          <div className="flex items-center gap-2 flex-wrap">
            <span>{client.name}</span>
            <Badge variant={isOld ? 'neutral' : 'success'} size="sm" dot>
              {isOld ? 'Existing Client' : 'New Client'}
            </Badge>
          </div>
        }
        subtitle={`Client ID: ${client.id}`}
        actions={
          canManageClients && (
            <Button
              variant="primary"
              size="sm"
              leadingIcon="edit"
              onClick={() => setIsEditOpen(true)}
            >
              Edit Client Info
            </Button>
          )
        }
      />

      {/* Client Overview Card */}
      <Card title="Client Information">
        <DetailList items={detailItems} columns={3} />
      </Card>

      {/* Associated Projects Section: Working & Previous Projects */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <span>Associated Projects</span>
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {clientProjects.length}
              </span>
            </h3>
          </div>

          <PermissionGate permission="projects.create">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="primary"
                size="sm"
                leadingIcon="plus"
                onClick={handleOpenAddProject}
                title="Add a new project for this client"
              >
                Add Project
              </Button>
            </div>
          </PermissionGate>
        </div>

        {/* Inline project summary — only when multiple projects exist */}
        {clientProjects.length > 1 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              variant="inline"
              label="Total Fit-outs"
              value={clientProjects.length}
              icon={<FolderIcon className="size-5" />}
              tone="primary"
            />
            <StatCard
              variant="inline"
              label="Active Sites"
              value={activeWorkingProjects.length}
              icon={<BuildingIcon className="size-5" />}
              tone="success"
            />
            <StatCard
              variant="inline"
              label="Delivered"
              value={previousCompletedProjects.length}
              icon={<CheckCircleIcon className="size-5" />}
              tone="primary"
            />
            <StatCard
              variant="inline"
              label="Combined Investment"
              value={formatCurrency(totalBudget)}
              icon={<IndianRupeeIcon className="size-5" />}
            />
          </div>
        )}

        {clientProjects.length === 0 ? (
          <EmptyState
            icon="projects"
            title="No Projects Linked Yet"
            description={`This client has no active or historical fit-out contracts mapped in Aesthetic Interiors OSM.`}
            action={
              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  leadingIcon="link"
                  onClick={() => setIsLinkModalOpen(true)}
                >
                  Link Existing Project
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leadingIcon="plus"
                  onClick={handleOpenAddProject}
                >
                  Add New Project
                </Button>
              </div>
            }
          />
        ) : (
          <div className="pt-1">
            <Kanban
              columns={CLIENT_PROJECT_KANBAN_COLUMNS}
              value={kanbanBoardValue}
              onChange={handleKanbanChange}
              onAdd={canManageClients ? () => handleOpenAddProject() : undefined}
              columnClassName="bg-secondary/40 border border-border/70"
              listClassName="min-h-[110px]"
              getCardClassName={() =>
                'flex min-h-[108px] flex-col p-3 hover:border-primary/50 hover:shadow-xs transition-all cursor-pointer'
              }
              density="compact"
              renderCard={renderCompactProjectCard}
            />
          </div>
        )}
      </div>

      {/* Edit Client Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Edit Client: ${client.name}`}
        subtitle="Update contact coordinates, client status, and account notes"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleUpdate}>
              Save Changes
            </Button>
          </>
        }
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <Input
            label="Client Full Name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Contact Phone"
              required
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <Select
            label="Client Status / Type"
            value={formData.type}
            onChange={(e) =>
              setFormData({ ...formData, type: e.target.value, status: e.target.value })
            }
            options={[
              { value: 'new', label: 'New Client' },
              { value: 'old', label: 'Existing (Old) Client' },
            ]}
          />

          <Textarea
            label="Site Address"
            rows={2}
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          <Textarea
            label="Internal Notes"
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </form>
      </Modal>

      {/* Link Existing Project Modal */}
      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title={`Link Existing Project to ${client.name}`}
        subtitle="Map an existing fit-out project from the OMS database to this client profile"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsLinkModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={linkLoading}
              disabled={!selectedProjectIdToLink}
              onClick={handleLinkProjectSubmit}
            >
              Link to Client
            </Button>
          </>
        }
      >
        <form onSubmit={handleLinkProjectSubmit} className="space-y-4">
          {availableProjectsToLink.length === 0 ? (
            <div className="p-4 bg-muted/50 rounded-xl text-xs text-muted-foreground text-center">
              All active projects in the system are already linked to this client. Click "Add Project" to create a new one.
            </div>
          ) : (
            <Select
              label="Select Project to Link"
              required
              value={selectedProjectIdToLink}
              onChange={(e) => setSelectedProjectIdToLink(e.target.value)}
              options={[
                { value: '', label: '-- Choose a project to link --' },
                ...availableProjectsToLink.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.id} • ${formatCurrency(p.totalCost)} • Status: ${p.status})`,
                })),
              ]}
            />
          )}
        </form>
      </Modal>

      {/* Add New Project Modal */}
      <Modal
        isOpen={isAddProjectModalOpen}
        onClose={() => setIsAddProjectModalOpen(false)}
        title={`Add New Project for ${client.name}`}
        subtitle="Initialize a new interior fit-out project linked directly to this client"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsAddProjectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={addProjectLoading}
              onClick={handleAddProjectSubmit}
            >
              Create Project
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddProjectSubmit} className="space-y-4">
          <Input
            label="Project Name"
            required
            value={newProjectData.name}
            onChange={(e) => setNewProjectData({ ...newProjectData, name: e.target.value })}
            placeholder="e.g. 4BHK Penthouse Fit-out"
          />

          <Input
            label="Site Address"
            value={newProjectData.siteAddress}
            onChange={(e) => setNewProjectData({ ...newProjectData, siteAddress: e.target.value })}
            placeholder="e.g. Plot 42, Indiranagar, Bengaluru"
          />

          <Input
            label="Total Quotation Cost (₹)"
            type="number"
            value={newProjectData.totalCost}
            onChange={(e) => setNewProjectData({ ...newProjectData, totalCost: e.target.value })}
            placeholder="3500000"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={newProjectData.startDate}
              onChange={(e) => setNewProjectData({ ...newProjectData, startDate: e.target.value })}
            />
            <Input
              label="Target Completion Date"
              type="date"
              value={newProjectData.targetDate}
              onChange={(e) => setNewProjectData({ ...newProjectData, targetDate: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Confirm Project Deletion Dialog */}
      <ConfirmDialog
        isOpen={Boolean(projectToDelete)}
        title="Delete Project"
        message={`Are you sure you want to delete "${projectToDelete?.name}"? This will permanently remove the project from the client profile and operations database.`}
        confirmText="Delete Project"
        confirmVariant="destructive"
        loading={deleteProjectLoading}
        onConfirm={handleConfirmDeleteProject}
        onCancel={() => setProjectToDelete(null)}
      />
    </div>
  );
}

export default ClientDetailPage;

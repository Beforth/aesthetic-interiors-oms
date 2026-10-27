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
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import Select from '../components/ui/Select';
import EmptyState from '../components/ui/EmptyState';
import ProjectCard from '../components/domain/ProjectCard';
import PermissionGate from '../components/ui/PermissionGate';
import Icon from '../components/ui/Icon';

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

  if (loading || !client) {
    return (
      <div className="p-8 text-center text-xs text-text-muted">
        Loading client profile...
      </div>
    );
  }

  const isOld = client.type === 'old' || client.status === 'old';

  const detailItems = [
    { label: 'Client Name', value: client.name, icon: 'user' },
    {
      label: 'Client Status',
      value: (
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
            isOld
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full mr-1.5 ${
              isOld ? 'bg-blue-600' : 'bg-emerald-600'
            }`}
          />
          {isOld ? 'Existing (Old) Client' : 'New Client'}
        </span>
      ),
      icon: 'sparkles',
    },
    { label: 'Phone Number', value: client.phone, icon: 'phone' },
    { label: 'Email Address', value: client.email || 'None on record', icon: 'mail' },
    {
      label: 'Onboarding Date',
      value: formatDate(client.createdAt),
      icon: 'calendar',
    },
    {
      label: 'Associated Projects',
      value: (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text-main">
            {clientProjects.length} total
          </span>
          <span className="text-xs text-text-muted">
            ({activeWorkingProjects.length} working • {previousCompletedProjects.length} completed)
          </span>
        </div>
      ),
      icon: 'projects',
    },
    {
      label: 'Primary Site Address',
      value: client.address || 'Bengaluru, Karnataka',
      icon: 'mapPin',
      fullWidth: true,
    },
    {
      label: 'Architectural & Design Notes',
      value: (
        <div className="p-3 rounded-lg bg-accent/40 border border-border text-xs text-foreground leading-relaxed">
          {client.notes || 'No custom notes provided.'}
        </div>
      ),
      fullWidth: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Left Navigation: Back to Directory button moved from right to left */}
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
          <div className="flex items-center gap-3 flex-wrap">
            <span>{client.name}</span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                isOld
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  isOld ? 'bg-blue-600' : 'bg-emerald-600'
                }`}
              />
              {isOld ? 'Existing (Old) Client' : 'New Client'}
            </span>
          </div>
        }
        subtitle={`Client ID: ${client.id} • Registered ${formatDate(client.createdAt)}`}
        breadcrumbs={[
          { label: 'Clients', path: '/clients' },
          { label: client.name },
        ]}
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
      <Card title="Client Information & Preferences">
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
            <p className="text-xs text-muted-foreground">
              Active working fit-out sites & past completed contracts for {client.name}
            </p>
          </div>

          <PermissionGate permission="projects.create">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                leadingIcon="link"
                onClick={() => setIsLinkModalOpen(true)}
                title="Link an existing project to this client"
              >
                Link Project
              </Button>
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

        {/* Executive Multi-Project Summary Bar when multiple projects exist */}
        {clientProjects.length > 1 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/60 p-3.5 rounded-xl border border-border">
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Total Fit-outs
              </div>
              <div className="text-base font-bold text-foreground mt-0.5">
                {clientProjects.length} Sites
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Active Working
              </div>
              <div className="text-base font-bold text-emerald-700 mt-0.5">
                {activeWorkingProjects.length} Live Sites
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider flex items-center gap-1">
                <Icon name="check" size={12} className="stroke-[2.5]" />
                Delivered
              </div>
              <div className="text-base font-bold text-blue-700 mt-0.5">
                {previousCompletedProjects.length} Completed
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Combined Investment
              </div>
              <div className="text-base font-bold text-foreground mt-0.5">
                {formatCurrency(totalBudget)}
              </div>
            </div>
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
          <div className="space-y-6">
            {/* 1. Current Working Projects */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h4 className="text-sm font-bold text-text-main">
                    Current Working Projects ({activeWorkingProjects.length})
                  </h4>
                </div>
                <span className="text-xs text-text-muted">
                  Live execution and in-progress milestones
                </span>
              </div>

              {activeWorkingProjects.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border bg-muted/30 text-xs text-muted-foreground text-center">
                  No active in-progress projects currently running for this client. Click "Add Project" to initialize one.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeWorkingProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      teamUsers={users}
                      onClick={() => navigate(`/projects/${project.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 2. Previous & Completed Projects */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <h4 className="text-sm font-bold text-foreground">
                    Previous & Completed Projects ({previousCompletedProjects.length})
                  </h4>
                </div>
                <span className="text-xs text-muted-foreground">
                  Successfully delivered fit-out contracts
                </span>
              </div>

              {previousCompletedProjects.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border bg-muted/30 text-xs text-muted-foreground text-center">
                  No previous completed contracts on record for this client.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {previousCompletedProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      teamUsers={users}
                      onClick={() => navigate(`/projects/${project.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
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
    </div>
  );
}

export default ClientDetailPage;

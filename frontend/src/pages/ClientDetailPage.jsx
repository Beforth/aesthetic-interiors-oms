import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clientService } from '../services/clientService';
import { projectService } from '../services/projectService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePermission } from '../hooks/usePermission';
import { formatDate } from '../utils/formatters';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import DetailList from '../components/ui/DetailList';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import Select from '../components/ui/Select';
import EmptyState from '../components/ui/EmptyState';
import ProjectCard from '../components/domain/ProjectCard';
import PermissionGate from '../components/ui/PermissionGate';

export function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const toast = useToast();
  const canManageClients = usePermission('clients.manage');

  const [client, setClient] = useState(null);
  const [clientProjects, setClientProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    type: 'new',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [clientData, allProjects, allUsers] = await Promise.all([
        clientService.getClientById(id, currentUser),
        projectService.getAllProjects(currentUser),
        userService.getAllUsers(),
      ]);

      if (!clientData) {
        toast.error('Client record not found or access restricted');
        navigate('/clients');
        return;
      }

      setClient(clientData);
      setFormData({
        name: clientData.name,
        phone: clientData.phone || '',
        email: clientData.email || '',
        address: clientData.address || '',
        notes: clientData.notes || '',
        type: clientData.type || 'new',
      });

      // Filter projects belonging to this client (works with multiple projects, e.g. c2 with P2 & P4)
      const matchingProjects = allProjects.filter(
        (p) =>
          p.clientId === clientData.id ||
          (p.clientEmail &&
            p.clientEmail.toLowerCase() === clientData.email.toLowerCase())
      );
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

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      const updated = await clientService.updateClient(client.id, formData);
      setClient(updated);
      setIsEditOpen(false);
      toast.success('Client updated successfully');
    } catch (err) {
      toast.error('Failed to update client');
    }
  };

  if (loading || !client) {
    return (
      <div className="p-8 text-center text-xs text-text-muted">
        Loading client profile...
      </div>
    );
  }

  const detailItems = [
    { label: 'Client Name', value: client.name, icon: 'user' },
    {
      label: 'Account Type',
      value: (
        <StatusBadge
          status={client.type === 'old' ? 'converted' : 'new'}
          label={client.type === 'old' ? 'Existing Client' : 'New Client'}
          size="sm"
        />
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
      label: 'Primary Site Address',
      value: client.address || 'Bengaluru, Karnataka',
      icon: 'mapPin',
      fullWidth: true,
    },
    {
      label: 'Architectural & Design Notes',
      value: (
        <div className="p-3 rounded bg-brand-50 border border-border text-xs text-text-main leading-relaxed">
          {client.notes || 'No custom notes provided.'}
        </div>
      ),
      fullWidth: true,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        subtitle={`Client ID: ${client.id} • ${client.type === 'old' ? 'Existing Client' : 'New Client'}`}
        breadcrumbs={[
          { label: 'Operations', path: '/dashboard' },
          { label: 'Clients', path: '/clients' },
          { label: client.name },
        ]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              leadingIcon="arrow-left"
              onClick={() => navigate('/clients')}
            >
              Back to Directory
            </Button>
            {canManageClients && (
              <Button
                variant="primary"
                size="sm"
                leadingIcon="edit"
                onClick={() => setIsEditOpen(true)}
              >
                Edit Client Info
              </Button>
            )}
          </>
        }
      />

      {/* Client Overview Card */}
      <Card title="Client Information & Preferences">
        <DetailList items={detailItems} columns={3} />
      </Card>

      {/* Associated Projects Section (Supports multiple projects) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-text-main">
              Associated Projects ({clientProjects.length})
            </h3>
            <p className="text-xs text-text-muted">
              Fit-out sites linked to {client.name}
            </p>
          </div>

          <PermissionGate permission="projects.create">
            <Button
              variant="outline"
              size="sm"
              leadingIcon="plus"
              onClick={() => navigate('/projects')}
            >
              Initiate Project
            </Button>
          </PermissionGate>
        </div>

        {clientProjects.length === 0 ? (
          <EmptyState
            icon="projects"
            title="No Projects Linked Yet"
            description="This client has no active or historical fit-out contracts assigned in Aesthetic Interiors OSM."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clientProjects.map((project) => (
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

      {/* Edit Client Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Edit Client: ${client.name}`}
        subtitle="Update contact coordinates and notes"
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
            label="Client Type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
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
    </div>
  );
}

export default ClientDetailPage;

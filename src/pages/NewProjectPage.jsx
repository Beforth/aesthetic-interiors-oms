import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { clientService } from '../services/clientService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLE_LABELS } from '../config/roles';
import { cn } from '../lib/utils';
import { validateRequired } from '../utils/validators';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/badge';
import Avatar from '../components/ui/avatar';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckIcon,
  RefreshIcon,
  TrashIcon,
  PlusIcon,
} from '../components/ui/icons';

// 12 SRS Interior Fit-Out Stages in strict sequential order
const INITIAL_SRS_PHASES = [
  { id: 'stg_1', name: '1. Cleaning', startDate: '', endDate: '', plannedHours: 24 },
  { id: 'stg_2', name: '2. Ceiling', startDate: '', endDate: '', plannedHours: 48 },
  { id: 'stg_3', name: '3. Carpenter', startDate: '', endDate: '', plannedHours: 72 },
  { id: 'stg_4', name: '4. Tiles', startDate: '', endDate: '', plannedHours: 48 },
  { id: 'stg_5', name: '5. Plumbing', startDate: '', endDate: '', plannedHours: 40 },
  { id: 'stg_6', name: '6. Electrical', startDate: '', endDate: '', plannedHours: 48 },
  { id: 'stg_7', name: '7. Glass Agencies', startDate: '', endDate: '', plannedHours: 32 },
  { id: 'stg_8', name: '8. Finishing (Wallpaper & Soft)', startDate: '', endDate: '', plannedHours: 40 },
  { id: 'stg_9', name: '9. Fabrication', startDate: '', endDate: '', plannedHours: 48 },
  { id: 'stg_10', name: '10. Civil Work', startDate: '', endDate: '', plannedHours: 60 },
  { id: 'stg_11', name: '11. Artistic Work', startDate: '', endDate: '', plannedHours: 36 },
  { id: 'stg_12', name: '12. Painter', startDate: '', endDate: '', plannedHours: 48 },
];

export default function NewProjectPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    clientId: '',
    siteAddress: '',
    totalCost: '',
    startDate: '',
    endDate: '',
    projectLead: '',
  });

  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [phases, setPhases] = useState(INITIAL_SRS_PHASES);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data Options
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [loadedClients, loadedUsers] = await Promise.all([
          clientService.getAllClients(user),
          userService.getAllUsers(user),
        ]);
        if (!isMounted) return;
        setClients(loadedClients || []);
        setUsers(loadedUsers || []);

        if (loadedClients && loadedClients.length > 0) {
          setFormData((prev) => ({
            ...prev,
            clientId: loadedClients[0].id,
            siteAddress: loadedClients[0].address || '',
          }));
        }
      } catch (err) {
        console.error('Failed to load initial data for new project', err);
        addToast({
          type: 'error',
          title: 'Error loading data',
          message: 'Could not load clients and team members.',
        });
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [user, addToast]);

  // Client Selection Change
  const handleClientChange = (e) => {
    const cid = e.target.value;
    const selected = clients.find((c) => String(c.id) === String(cid));
    setFormData((prev) => ({
      ...prev,
      clientId: cid,
      siteAddress: selected?.address || prev.siteAddress,
    }));
  };

  // Toggle Team Member selection
  const handleToggleMember = (uid) => {
    setSelectedMemberIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  // Update a single phase
  const handleUpdatePhase = (index, field, value) => {
    setPhases((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Add custom phase
  const handleAddPhase = () => {
    setPhases((prev) => [
      ...prev,
      {
        id: `stg_custom_${Date.now()}`,
        name: `Custom Phase ${prev.length + 1}`,
        startDate: '',
        endDate: '',
        plannedHours: 40,
      },
    ]);
  };

  // Remove a phase
  const handleRemovePhase = (index) => {
    setPhases((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Spread dates across project dates
  const handleSpreadDates = () => {
    if (!formData.startDate || !formData.endDate) {
      addToast({
        type: 'warning',
        title: 'Dates required',
        message: 'Please set both Start Date and End Date in the Duration section first.',
      });
      return;
    }

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      addToast({
        type: 'error',
        title: 'Invalid duration',
        message: 'Project End Date must be after Start Date to calculate phases.',
      });
      return;
    }

    if (phases.length === 0) return;

    const daysPerPhase = Math.max(1, Math.floor(diffDays / phases.length));
    let runningDate = new Date(start);

    const updated = phases.map((phase, idx) => {
      const pStart = new Date(runningDate);
      let pEnd;

      if (idx === phases.length - 1) {
        pEnd = new Date(end);
      } else {
        pEnd = new Date(pStart);
        pEnd.setDate(pEnd.getDate() + daysPerPhase);
      }

      // Next phase starts next day
      runningDate = new Date(pEnd);
      runningDate.setDate(runningDate.getDate() + 1);

      return {
        ...phase,
        startDate: pStart.toISOString().split('T')[0],
        endDate: pEnd.toISOString().split('T')[0],
      };
    });

    setPhases(updated);
    addToast({
      type: 'success',
      title: 'Phases scheduled',
      message: `Sequentially distributed ${phases.length} phases across project duration.`,
    });
  };

  const totalPlannedHours = useMemo(() => {
    return phases.reduce((acc, p) => acc + (Number(p.plannedHours) || 0), 0);
  }, [phases]);

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = {};

    const nameErr = validateRequired(formData.name, 'Project Name');
    if (nameErr) validationErrors.name = nameErr;

    const clientErr = validateRequired(formData.clientId, 'Client');
    if (clientErr) validationErrors.clientId = clientErr;

    const addressErr = validateRequired(formData.siteAddress, 'Site Address');
    if (addressErr) validationErrors.siteAddress = addressErr;

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      addToast({
        type: 'error',
        title: 'Missing required fields',
        message: 'Please check the required fields in the Basics section.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedClient = clients.find((c) => String(c.id) === String(formData.clientId));
      const selectedUsers = users.filter((u) => selectedMemberIds.includes(u.id));

      const supervisors = selectedUsers
        .filter((u) => u.role === 'supervisor' || u.role === 'manager' || u.role === 'owner')
        .map((u) => u.id);

      const workers = selectedUsers
        .filter((u) => u.role === 'worker')
        .map((u) => u.id);

      const formattedStages = phases.map((p, idx) => ({
        id: p.id || `stg_${Date.now()}_${idx + 1}`,
        order: idx + 1,
        name: p.name,
        startDate: p.startDate || formData.startDate || '',
        endDate: p.endDate || formData.endDate || '',
        plannedHours: Number(p.plannedHours) || 0,
        status: 'not started',
        agencyId: null,
        agencyName: 'Unallocated',
      }));

      await projectService.createProject({
        name: formData.name.trim(),
        description: formData.description.trim(),
        clientId: formData.clientId,
        clientName: selectedClient?.name || 'Client',
        clientEmail: selectedClient?.email || '',
        siteAddress: formData.siteAddress.trim(),
        startDate: formData.startDate || '2026-10-20',
        endDate: formData.endDate || formData.startDate || '2026-12-31',
        totalCost: Number(formData.totalCost) || 0,
        projectLead: formData.projectLead || null,
        supervisors,
        workers,
        stages: formattedStages,
      });

      addToast({
        type: 'success',
        title: 'Project Initiated',
        message: `Project "${formData.name.trim()}" has been created successfully.`,
      });

      navigate('/projects');
    } catch (err) {
      console.error('Failed to create project', err);
      addToast({
        type: 'error',
        title: 'Creation failed',
        message: err.message || 'An error occurred while creating the project.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Breadcrumb & Heading */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/projects')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-2 transition-colors group cursor-pointer"
        >
          <ArrowLeftIcon className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Projects</span>
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Add Project</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create a project to track work, manage time, and keep your pod aligned.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Basics Card */}
        <Card
          title={
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold text-foreground">Basics</span>
              <Badge variant="neutral">Required</Badge>
            </div>
          }
          subtitle="The core identity of the project."
        >
          <div className="space-y-4">
            <Input
              label="Project name"
              required
              placeholder="e.g. Billing Portal"
              value={formData.name}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, name: e.target.value }));
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              error={errors.name}
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-foreground">
                  Short description
                </label>
                <span className="text-xs text-muted-foreground">optional</span>
              </div>
              <Textarea
                placeholder="What's this project about? Keep it to 1-2 sentences."
                rows={2}
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <Select
                label="Client"
                required
                options={clients.map((c) => ({
                  value: c.id,
                  label: `${c.name} (${c.email || c.phone || 'Client'})`,
                }))}
                value={formData.clientId}
                onChange={handleClientChange}
                error={errors.clientId}
              />

              <Input
                label="Total Cost Estimate (INR)"
                type="number"
                placeholder="e.g. 1500000"
                value={formData.totalCost}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, totalCost: e.target.value }))
                }
              />
            </div>

            <Input
              label="Site Address"
              required
              placeholder="e.g. Flat 402, Signature Towers, Indiranagar, Bengaluru"
              value={formData.siteAddress}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, siteAddress: e.target.value }));
                if (errors.siteAddress) setErrors((prev) => ({ ...prev, siteAddress: undefined }));
              }}
              error={errors.siteAddress}
            />
          </div>
        </Card>

        {/* 2. Duration Card */}
        <Card
          title={
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold text-foreground">Duration</span>
              <Badge variant="neutral">Optional</Badge>
            </div>
          }
          subtitle="Overall project timeline. Phases below can live within these bounds."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Start date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[border,box-shadow] hover:border-muted-foreground/40 focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                End date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[border,box-shadow] hover:border-muted-foreground/40 focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* 3. Pod Card */}
        <Card
          title={
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold text-foreground">Pod</span>
              <Badge variant="neutral">Optional</Badge>
            </div>
          }
          subtitle="The team assigned to this project."
        >
          <div className="space-y-6">
            {/* Project Lead */}
            <div>
              <Select
                label="Project lead"
                placeholder="No lead yet"
                options={[
                  { value: '', label: 'No lead yet' },
                  ...users.map((u) => ({
                    value: u.id,
                    label: `${u.name} · ${ROLE_LABELS[u.role] || u.role}`,
                  })),
                ]}
                value={formData.projectLead}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, projectLead: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Main point of contact. Leaves will route here if enabled.
              </p>
            </div>

            {/* Who else works on it */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-foreground">
                  Who else works on it?
                </label>
                <span className="text-xs text-muted-foreground">
                  Tick everyone on the team. {selectedMemberIds.length} selected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {users.map((member) => {
                  const isSelected = selectedMemberIds.includes(member.id);
                  const username =
                    member.username ||
                    member.name?.toLowerCase().replace(/\s+/g, '') ||
                    'user';

                  return (
                    <div
                      key={member.id}
                      onClick={() => handleToggleMember(member.id)}
                      className={cn(
                        'flex items-center justify-between gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none',
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-xs'
                          : 'border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/20'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={member.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {member.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            @{username} · {ROLE_LABELS[member.role] || member.role}
                          </p>
                        </div>
                      </div>

                      <div
                        className={cn(
                          'size-5 rounded-full flex items-center justify-center shrink-0 transition-colors',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border bg-background'
                        )}
                      >
                        {isSelected && <CheckIcon className="size-3.5 stroke-[2.5]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* 4. Schedule Card */}
        <Card
          title={
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold text-foreground">Schedule</span>
              <Badge variant="neutral">Optional</Badge>
            </div>
          }
          subtitle="Break the project into sequential or overlapping phases. Team members track time against these."
          headerAction={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSpreadDates}
              className="gap-1.5"
            >
              <RefreshIcon className="size-3.5" />
              <span>Spread across the project dates</span>
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-border overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold text-muted-foreground uppercase tracking-wider text-[11px] w-2/5">
                        PHASE
                      </th>
                      <th className="py-2.5 px-4 font-semibold text-muted-foreground uppercase tracking-wider text-[11px] w-1/4">
                        STARTS
                      </th>
                      <th className="py-2.5 px-4 font-semibold text-muted-foreground uppercase tracking-wider text-[11px] w-1/4">
                        ENDS
                      </th>
                      <th className="py-2.5 px-4 font-semibold text-muted-foreground uppercase tracking-wider text-[11px] w-28 text-right">
                        PLANNED HOURS
                      </th>
                      <th className="py-2.5 px-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {phases.map((phase, idx) => (
                      <tr key={phase.id || idx} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2 px-4">
                          <input
                            type="text"
                            value={phase.name}
                            onChange={(e) =>
                              handleUpdatePhase(idx, 'name', e.target.value)
                            }
                            className="w-full bg-transparent border-0 font-medium text-foreground text-xs focus:ring-0 focus:outline-none focus:bg-muted/40 px-1 py-1 rounded"
                          />
                        </td>
                        <td className="py-2 px-4">
                          <input
                            type="date"
                            value={phase.startDate}
                            onChange={(e) =>
                              handleUpdatePhase(idx, 'startDate', e.target.value)
                            }
                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </td>
                        <td className="py-2 px-4">
                          <input
                            type="date"
                            value={phase.endDate}
                            onChange={(e) =>
                              handleUpdatePhase(idx, 'endDate', e.target.value)
                            }
                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </td>
                        <td className="py-2 px-4">
                          <input
                            type="number"
                            min="0"
                            value={phase.plannedHours}
                            onChange={(e) =>
                              handleUpdatePhase(idx, 'plannedHours', e.target.value)
                            }
                            className="w-20 ml-auto block bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring text-right"
                            placeholder="0"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemovePhase(idx)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                            title="Remove phase"
                          >
                            <TrashIcon className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 border-t border-border bg-muted/10 flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddPhase}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <PlusIcon className="size-3.5" />
                  <span>Add phase</span>
                </Button>
                <span className="text-xs text-muted-foreground">
                  Total Planned:{' '}
                  <span className="font-semibold text-foreground">
                    {totalPlannedHours} hrs
                  </span>
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/projects')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
          >
            Add Project
          </Button>
        </div>
      </form>
    </div>
  );
}

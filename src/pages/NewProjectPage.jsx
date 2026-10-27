import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { clientService } from '../services/clientService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLE_LABELS } from '../config/roles';
import { cn } from '../lib/utils';
import { validateRequired, validatePhone, sanitizePhone } from '../utils/validators';

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
  ChevronDownIcon,
} from '../components/ui/icons';

// 12 SRS Interior Fit-Out Stages in strict sequential order (number prefixes removed per request)
const INITIAL_SRS_PHASES = [
  { id: 'stg_1', name: 'Cleaning', startDate: '', endDate: '', plannedHours: 24 },
  { id: 'stg_2', name: 'Ceiling', startDate: '', endDate: '', plannedHours: 48 },
  { id: 'stg_3', name: 'Carpenter', startDate: '', endDate: '', plannedHours: 72 },
  { id: 'stg_4', name: 'Tiles', startDate: '', endDate: '', plannedHours: 48 },
  { id: 'stg_5', name: 'Plumbing', startDate: '', endDate: '', plannedHours: 40 },
  { id: 'stg_6', name: 'Electrical', startDate: '', endDate: '', plannedHours: 48 },
  { id: 'stg_7', name: 'Glass Agencies', startDate: '', endDate: '', plannedHours: 32 },
  { id: 'stg_8', name: 'Finishing (Wallpaper & Soft)', startDate: '', endDate: '', plannedHours: 40 },
  { id: 'stg_9', name: 'Fabrication', startDate: '', endDate: '', plannedHours: 48 },
  { id: 'stg_10', name: 'Civil Work', startDate: '', endDate: '', plannedHours: 60 },
  { id: 'stg_11', name: 'Artistic Work', startDate: '', endDate: '', plannedHours: 36 },
  { id: 'stg_12', name: 'Painter', startDate: '', endDate: '', plannedHours: 48 },
];

export default function NewProjectPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    contact: '',
    siteAddress: '',
    totalCost: '',
    startDate: '',
    endDate: '',
    projectLead: '',
  });

  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [showAllMembers, setShowAllMembers] = useState(false);
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
      } catch (err) {
        console.error('Failed to load initial data for new project', err);
        toast.error('Could not load clients and team members.');
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [user]);

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
      toast.warning('Please set both Start Date and End Date in the Duration section first.');
      return;
    }

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      toast.error('Project End Date must be after Start Date to calculate phases.');
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
    toast.success(`Sequentially distributed ${phases.length} phases across project duration.`);
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

    const contactErr = validatePhone(formData.contact, { required: true, fieldLabel: 'Contact phone' });
    if (contactErr) validationErrors.contact = contactErr;

    const addressErr = validateRequired(formData.siteAddress, 'Site Address');
    if (addressErr) validationErrors.siteAddress = addressErr;

    if (formData.startDate && formData.endDate && new Date(formData.endDate) < new Date(formData.startDate)) {
      validationErrors.endDate = 'End date cannot be earlier than start date';
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      const firstErrorMsg = Object.values(validationErrors)[0];
      toast.error(`Please fix errors: ${firstErrorMsg}`);
      // Scroll to the first field that has an error
      const firstErrorKey = Object.keys(validationErrors)[0];
      const el =
        document.getElementById(firstErrorKey) ||
        document.querySelector(`[name="${firstErrorKey}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
      return;
    }

    setIsSubmitting(true);
    try {
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
        clientId: formData.contact.trim(),
        clientName: formData.contact.trim(),
        clientContact: formData.contact.trim(),
        clientEmail: '',
        siteAddress: formData.siteAddress.trim(),
        startDate: formData.startDate || '2026-10-20',
        endDate: formData.endDate || formData.startDate || '2026-12-31',
        totalCost: Number(formData.totalCost) || 0,
        projectLead: formData.projectLead || null,
        supervisors,
        workers,
        stages: formattedStages,
      });

      toast.success(`Project "${formData.name.trim()}" has been created successfully.`);
      navigate('/projects?view=board');
    } catch (err) {
      console.error('Failed to create project', err);
      toast.error(err.message || 'An error occurred while creating the project.');
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
          onClick={() => navigate('/projects?view=board')}
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

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* 1. Basics Card */}
        <Card
          title={<span className="text-sm font-semibold text-foreground">Basics</span>}
          subtitle="The core identity of the project."
        >
          <div className="space-y-4">
            <Input
              id="name"
              name="name"
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
              <Input
                id="contact"
                name="contact"
                label="Contact Phone"
                type="tel"
                maxLength={10}
                inputMode="numeric"
                required
                placeholder="10-digit mobile (e.g. 9845012345)"
                value={formData.contact}
                onChange={(e) => {
                  const clean = sanitizePhone(e.target.value);
                  setFormData((prev) => ({ ...prev, contact: clean }));
                  if (errors.contact) {
                    setErrors((prev) => ({
                      ...prev,
                      contact: validatePhone(clean, { required: true, fieldLabel: 'Contact phone' }) || undefined,
                    }));
                  }
                }}
                error={errors.contact}
                helperText="Only 10 digits allowed, numbers only"
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
              id="siteAddress"
              name="siteAddress"
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
          title={<span className="text-sm font-semibold text-foreground">Duration</span>}
          subtitle="Overall project timeline. Phases below can live within these bounds."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-xs font-semibold text-foreground mb-1.5 select-none">
                Start date
              </label>
              <div className="relative">
                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, startDate: e.target.value }));
                    if (errors.startDate) setErrors((prev) => ({ ...prev, startDate: undefined }));
                  }}
                  className={`w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground shadow-2xs outline-none transition-[border,box-shadow] ${
                    errors.startDate
                      ? 'border-2 border-destructive bg-destructive/5 ring-2 ring-destructive/20 focus:border-destructive'
                      : 'border-border hover:border-muted-foreground/40 focus:border-ring focus:ring-2 focus:ring-ring/20'
                  }`}
                />
              </div>
              {errors.startDate && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1" role="alert">
                  {errors.startDate}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="endDate" className="block text-xs font-semibold text-foreground mb-1.5 select-none">
                End date
              </label>
              <div className="relative">
                <input
                  id="endDate"
                  name="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, endDate: e.target.value }));
                    if (errors.endDate) setErrors((prev) => ({ ...prev, endDate: undefined }));
                  }}
                  className={`w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground shadow-2xs outline-none transition-[border,box-shadow] ${
                    errors.endDate
                      ? 'border-2 border-destructive bg-destructive/5 ring-2 ring-destructive/20 focus:border-destructive'
                      : 'border-border hover:border-muted-foreground/40 focus:border-ring focus:ring-2 focus:ring-ring/20'
                  }`}
                />
              </div>
              {errors.endDate && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1" role="alert">
                  {errors.endDate}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* 3. Team Assignment Card (Pod heading removed per request) */}
        <Card>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {(showAllMembers ? users : users.slice(0, 6)).map((member) => {
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
                        'flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg border transition-all cursor-pointer select-none',
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-xs'
                          : 'border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/20'
                      )}
                    >
                      <div className="min-w-0 pr-1">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {member.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          @{username} · {ROLE_LABELS[member.role] || member.role}
                        </p>
                      </div>

                      <div
                        className={cn(
                          'size-4.5 rounded-full flex items-center justify-center shrink-0 transition-colors',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border bg-background'
                        )}
                      >
                        {isSelected && <CheckIcon className="size-3 stroke-[2.5]" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {users.length > 6 && (
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={() => setShowAllMembers((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors border border-primary/20 cursor-pointer"
                  >
                    <span>
                      {showAllMembers
                        ? 'Show Less'
                        : `Show More (${users.length - 6} more)`}
                    </span>
                    <ChevronDownIcon
                      className={cn(
                        'size-3.5 transition-transform duration-200',
                        showAllMembers && 'rotate-180'
                      )}
                    />
                  </button>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* 4. Schedule Card */}
        <Card
          title={<span className="text-sm font-semibold text-foreground">Schedule</span>}
          subtitle="Break the project into sequential or overlapping phases. Team members track time against these."
          headerAction={
            <button
              type="button"
              onClick={handleSpreadDates}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
            >
              <RefreshIcon className="size-3.5 shrink-0" />
              <span>Spread Dates</span>
            </button>
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-border overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <colgroup>
                    <col className="w-auto sm:w-[38%]" />
                    <col className="w-40 sm:w-[24%]" />
                    <col className="w-40 sm:w-[24%]" />
                    <col className="w-28 sm:w-[14%]" />
                    <col className="w-10" />
                  </colgroup>
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                        PHASE
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                        STARTS
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                        ENDS
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-muted-foreground uppercase tracking-wider text-[11px] text-right">
                        PLANNED HOURS
                      </th>
                      <th className="py-2.5 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {phases.map((phase, idx) => (
                      <tr key={phase.id || idx} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-primary/60 shrink-0" />
                            <input
                              type="text"
                              value={phase.name}
                              onChange={(e) =>
                                handleUpdatePhase(idx, 'name', e.target.value)
                              }
                              className="w-full bg-transparent border border-transparent hover:border-border/60 focus:border-border font-medium text-foreground text-xs focus:ring-0 focus:outline-none focus:bg-muted/40 px-2 py-1 rounded transition-colors"
                              placeholder="Phase name"
                            />
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="date"
                            value={phase.startDate}
                            onChange={(e) =>
                              handleUpdatePhase(idx, 'startDate', e.target.value)
                            }
                            className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="date"
                            value={phase.endDate}
                            onChange={(e) =>
                              handleUpdatePhase(idx, 'endDate', e.target.value)
                            }
                            className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              type="number"
                              min="0"
                              value={phase.plannedHours}
                              onChange={(e) =>
                                handleUpdatePhase(idx, 'plannedHours', e.target.value)
                              }
                              className="w-16 bg-background border border-border rounded-md px-2 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-ring text-right"
                              placeholder="0"
                            />
                            <span className="text-[11px] text-muted-foreground font-medium shrink-0">hrs</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemovePhase(idx)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors cursor-pointer"
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
                <button
                  type="button"
                  onClick={handleAddPhase}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                >
                  <PlusIcon className="size-3.5 shrink-0" />
                  <span>Add Phase</span>
                </button>
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
            onClick={() => navigate('/projects?view=board')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Add Project
          </Button>
        </div>
      </form>
    </div>
  );
}

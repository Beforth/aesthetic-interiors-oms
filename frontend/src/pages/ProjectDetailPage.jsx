import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { userService } from '../services/userService';
import { agencyService } from '../services/agencyService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePermission } from '../hooks/usePermission';
import { ROLES, ROLE_LABELS } from '../config/roles';
import { formatCurrency, formatDate } from '../utils/formatters';
import { calculateProgress, isStageLate, TODAY_STR } from '../utils/progress';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Tabs from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import StatusBadge from '../components/ui/StatusBadge';
import ProgressBar from '../components/ui/ProgressBar';
import DetailList from '../components/ui/DetailList';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import EmptyState from '../components/ui/EmptyState';
import StageTimeline from '../components/domain/StageTimeline';
import StageStatusControl from '../components/domain/StageStatusControl';
import AssigneePicker from '../components/domain/AssigneePicker';
import AgencySelect from '../components/domain/AgencySelect';
import PermissionGate from '../components/ui/PermissionGate';

export function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, role } = useAuth();
  const toast = useToast();

  // Permissions
  const canAssignPeople = usePermission('projects.assignPeople');
  const canEditDates = usePermission('stages.editDates');
  const canUpdateStatus = usePermission('stages.updateStatus');
  const canEditProjectStages = usePermission('stages.editProjectStages');

  const [project, setProject] = useState(null);
  const [users, setUsers] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Stage Edit Modal State
  const [editingStage, setEditingStage] = useState(null);
  const [stageFormData, setStageFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    agencyId: '',
    status: 'not started',
  });

  // Assign Team Modal State
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [teamForm, setTeamForm] = useState({
    supervisors: [],
    workers: [],
  });

  // Add Custom Stage Modal State
  const [isAddStageOpen, setIsAddStageOpen] = useState(false);
  const [newStageForm, setNewStageForm] = useState({
    name: '',
    startDate: '2026-10-20',
    endDate: '2026-10-30',
    agencyId: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [proj, allUsers, allAgencies] = await Promise.all([
        projectService.getProjectById(id, currentUser),
        userService.getAllUsers(),
        agencyService.getAllAgencies(),
      ]);

      if (!proj) {
        toast.error('Project not found or access restricted');
        navigate('/projects');
        return;
      }

      setProject(proj);
      setUsers(allUsers);
      setAgencies(allAgencies);
      setTeamForm({
        supervisors: proj.supervisors || [],
        workers: proj.workers || [],
      });
    } catch (err) {
      toast.error('Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, currentUser]);

  if (loading || !project) {
    return (
      <div className="p-12 text-center text-xs text-text-muted">
        Loading project information...
      </div>
    );
  }

  const stages = project.stages || [];
  const progress = calculateProgress(stages);

  // Tabs config
  const projectTabs = [
    { id: 'overview', label: 'Overview', icon: 'projects' },
    { id: 'timeline', label: 'Stages & Timeline', icon: 'calendar', count: stages.length },
    { id: 'tasks', label: 'Tasks', icon: 'tasks' },
    { id: 'dsr', label: 'Daily Reports', icon: 'daily-reports' },
    { id: 'files', label: 'Files', icon: 'folder' },
    { id: 'payments', label: 'Payments', icon: 'payments' },
  ];

  // Resolve team objects
  const assignedSupervisors = users.filter((u) =>
    (project.supervisors || []).includes(u.id)
  );
  const assignedWorkers = users.filter((u) =>
    (project.workers || []).includes(u.id)
  );

  // Handle stage status click for Supervisor / Worker
  const handleQuickStatusChange = async (stage, newStatus) => {
    try {
      const updated = await projectService.updateStageStatus(
        project.id,
        stage.id,
        newStatus
      );
      setProject({ ...updated });
      toast.success(`${stage.name} status updated to "${newStatus}"`);
    } catch (err) {
      toast.error('Failed to update stage status');
    }
  };

  // Open Stage Modal
  const handleOpenEditStage = (stage) => {
    setEditingStage(stage);
    setStageFormData({
      name: stage.name,
      startDate: stage.startDate,
      endDate: stage.endDate,
      agencyId: stage.agencyId || 'internal',
      status: stage.status || 'not started',
    });
  };

  // Save Stage Modal
  const handleSaveStage = async (e) => {
    e.preventDefault();
    if (!editingStage) return;

    try {
      const selectedAgency = agencies.find((a) => a.id === stageFormData.agencyId);
      const agencyName =
        stageFormData.agencyId === 'internal'
          ? 'Internal Site Crew'
          : selectedAgency?.name || 'Unallocated Agency';

      const updated = await projectService.updateStageDetails(
        project.id,
        editingStage.id,
        {
          ...stageFormData,
          agencyName,
          agencyId: stageFormData.agencyId === 'internal' ? null : stageFormData.agencyId,
        }
      );
      setProject({ ...updated });
      setEditingStage(null);
      toast.success(`Stage ${stageFormData.name} updated successfully`);
    } catch (err) {
      toast.error('Failed to update stage');
    }
  };

  // Save Team Assignees
  const handleSaveTeam = async (e) => {
    e.preventDefault();
    try {
      const updated = await projectService.updateProject(project.id, {
        supervisors: teamForm.supervisors,
        workers: teamForm.workers,
      });
      setProject({ ...updated });
      setIsTeamModalOpen(false);
      toast.success('Project team assignments updated');
    } catch (err) {
      toast.error('Failed to update project team');
    }
  };

  // Add Stage for this project only
  const handleAddProjectStage = async (e) => {
    e.preventDefault();
    if (!newStageForm.name.trim()) return;

    const selectedAgency = agencies.find((a) => a.id === newStageForm.agencyId);
    const agencyName =
      newStageForm.agencyId === 'internal'
        ? 'Internal Site Crew'
        : selectedAgency?.name || 'Unallocated';

    const newStage = {
      id: `stg_${Date.now()}`,
      order: stages.length + 1,
      name: newStageForm.name.trim(),
      startDate: newStageForm.startDate,
      endDate: newStageForm.endDate,
      status: 'not started',
      agencyId: newStageForm.agencyId === 'internal' ? null : newStageForm.agencyId,
      agencyName,
    };

    const newStagesList = [...stages, newStage];
    await projectService.updateProjectStages(project.id, newStagesList);
    setProject((prev) => ({ ...prev, stages: newStagesList }));
    setIsAddStageOpen(false);
    toast.success(`Added stage "${newStage.name}" to project!`);
  };

  // Delete Stage for this project only
  const handleDeleteStage = async (stageId, stageName) => {
    if (!window.confirm(`Remove "${stageName}" from this project timeline?`)) return;
    const filtered = stages.filter((s) => s.id !== stageId);
    await projectService.updateProjectStages(project.id, filtered);
    setProject((prev) => ({ ...prev, stages: filtered }));
    toast.success(`Removed stage "${stageName}"`);
  };

  // Reorder Stages (move up/down)
  const handleMoveStage = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const reordered = [...stages];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    // Recalculate order index
    const updated = reordered.map((s, idx) => ({ ...s, order: idx + 1 }));
    await projectService.updateProjectStages(project.id, updated);
    setProject((prev) => ({ ...prev, stages: updated }));
  };

  const overviewItems = [
    { label: 'Client Name', value: project.clientName, icon: 'user' },
    { label: 'Site Address', value: project.siteAddress, icon: 'mapPin' },
    { label: 'Commencement Date', value: formatDate(project.startDate), icon: 'calendar' },
    { label: 'Target Handover', value: formatDate(project.targetDate), icon: 'clock' },
    {
      label: 'Estimated Cost (INR)',
      value: formatCurrency(project.totalCost),
      icon: 'payments',
    },
    {
      label: 'Execution Status',
      value: <StatusBadge status={project.status || 'in progress'} size="sm" />,
      icon: 'check-circle',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title={project.name}
        subtitle={`Site Address: ${project.siteAddress} • Overall Progress: ${progress}%`}
        breadcrumbs={[
          { label: 'Operations', path: '/dashboard' },
          { label: 'Projects', path: '/projects' },
          { label: project.name },
        ]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              leadingIcon="arrow-left"
              onClick={() => navigate('/projects')}
            >
              All Projects
            </Button>
            {canAssignPeople && (
              <Button
                variant="primary"
                size="sm"
                leadingIcon="users"
                onClick={() => setIsTeamModalOpen(true)}
              >
                Assign Team & Roles
              </Button>
            )}
          </>
        }
      />

      {/* Navigation Tabs */}
      <Tabs
        tabs={projectTabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        className="bg-surface rounded-t border px-2"
      />

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Progress Card */}
          <Card title="Project Progress & Milestone Metrics">
            <div className="space-y-3">
              <ProgressBar
                value={progress}
                showLabel
                label="Overall Contract Completion (Averaged Across 12 Stages)"
                size="lg"
                color={progress > 70 ? 'success' : 'brand'}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted pt-2 border-t border-border">
                <span>
                  Total Stages: <strong className="text-text-main">{stages.length}</strong>
                </span>
                <span>
                  Completed:{' '}
                  <strong className="text-success">
                    {stages.filter((s) => s.status === 'done').length}
                  </strong>
                </span>
                <span>
                  In Progress:{' '}
                  <strong className="text-brand-600">
                    {stages.filter((s) => s.status === 'in progress').length}
                  </strong>
                </span>
                <span>
                  Late / Attention Needed:{' '}
                  <strong className="text-danger">
                    {stages.filter((s) => isStageLate(s)).length}
                  </strong>
                </span>
              </div>
            </div>
          </Card>

          {/* Details List */}
          <Card title="Site Contract & Specification Details">
            <DetailList items={overviewItems} columns={3} />
          </Card>

          {/* Assigned Team & Subcontractors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card
              title="Site Supervisory & Crafts Team"
              headerAction={
                canAssignPeople && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsTeamModalOpen(true)}
                  >
                    Edit
                  </Button>
                )
              }
            >
              <div className="space-y-4">
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                    Supervisors ({assignedSupervisors.length})
                  </h5>
                  {assignedSupervisors.length === 0 ? (
                    <p className="text-xs text-text-muted italic">No supervisor assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {assignedSupervisors.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-3 p-2 rounded bg-brand-50 border border-border"
                        >
                          <Avatar name={s.name} size="sm" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-text-main truncate">
                              {s.name}
                            </div>
                            <div className="text-[11px] text-text-muted">
                              {s.phone} • {s.title}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-border">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                    Workers & Artisans ({assignedWorkers.length})
                  </h5>
                  {assignedWorkers.length === 0 ? (
                    <p className="text-xs text-text-muted italic">No workers assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {assignedWorkers.map((w) => (
                        <div
                          key={w.id}
                          className="flex items-center gap-3 p-2 rounded bg-brand-50 border border-border"
                        >
                          <Avatar name={w.name} size="sm" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-text-main truncate">
                              {w.name}
                            </div>
                            <div className="text-[11px] text-text-muted">
                              {w.phone} • {w.title}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <Card title="Allocated Trade Subcontractors">
              <div className="space-y-2">
                {stages
                  .filter((s) => s.agencyName && s.agencyName !== 'Unallocated Agency')
                  .slice(0, 5)
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2 rounded bg-surface border border-border text-xs"
                    >
                      <div>
                        <span className="font-semibold text-text-main">{s.name}</span>
                        <div className="text-[11px] text-brand-600">{s.agencyName}</div>
                      </div>
                      <StatusBadge status={s.status} size="sm" />
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: STAGES & TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-text-main">
                Stages Execution & Schedule
              </h3>
              <p className="text-xs text-text-muted">
                12-stage fit-out pipeline with real-time Gantt tracking and status updates
              </p>
            </div>

            <div className="flex items-center gap-2">
              {canEditProjectStages && (
                <Button
                  variant="primary"
                  size="sm"
                  leadingIcon="plus"
                  onClick={() => setIsAddStageOpen(true)}
                >
                  Add Custom Stage
                </Button>
              )}
            </div>
          </div>

          {/* 1. Stage Timeline Gantt View */}
          <StageTimeline
            stages={stages}
            today={TODAY_STR}
            onStageClick={(stg) => {
              if (canEditDates || canEditProjectStages) {
                handleOpenEditStage(stg);
              }
            }}
          />

          {/* 2. Detailed Stages Table View */}
          <Card title="Stage Execution Management Table">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-brand-50 text-text-muted font-semibold uppercase tracking-wider">
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3">Stage Name</th>
                    <th className="p-3">Allocated Agency</th>
                    <th className="p-3">Start Date</th>
                    <th className="p-3">Target End Date</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stages.map((stage, idx) => {
                    const isLate = isStageLate(stage, TODAY_STR);

                    return (
                      <tr key={stage.id} className="hover:bg-brand-50/50 transition-colors">
                        <td className="p-3 text-center font-bold text-brand-700">
                          {stage.order}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-text-main flex items-center gap-1.5">
                            <span>{stage.name}</span>
                            {isLate && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-danger-light text-danger">
                                Late
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-text-muted">
                          {stage.agencyName || 'Unallocated'}
                        </td>
                        <td className="p-3 font-mono">{formatDate(stage.startDate)}</td>
                        <td className="p-3 font-mono">{formatDate(stage.endDate)}</td>
                        <td className="p-3 text-center">
                          {canUpdateStatus ? (
                            <div className="w-44 mx-auto">
                              <StageStatusControl
                                value={stage.status}
                                onChange={(val) => handleQuickStatusChange(stage, val)}
                              />
                            </div>
                          ) : (
                            <StatusBadge status={stage.status} size="sm" />
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Reorder buttons */}
                            {canEditProjectStages && (
                              <>
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveStage(idx, -1)}
                                  className="p-1 text-text-muted hover:text-text-main disabled:opacity-30"
                                  aria-label="Move stage up"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === stages.length - 1}
                                  onClick={() => handleMoveStage(idx, 1)}
                                  className="p-1 text-text-muted hover:text-text-main disabled:opacity-30"
                                  aria-label="Move stage down"
                                >
                                  ▼
                                </button>
                              </>
                            )}

                            {(canEditDates || canEditProjectStages) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEditStage(stage)}
                              >
                                Edit
                              </Button>
                            )}

                            {canEditProjectStages && stages.length > 1 && (
                              <IconButton
                                icon="trash"
                                size="sm"
                                ariaLabel={`Remove ${stage.name}`}
                                className="text-danger hover:bg-danger-light"
                                onClick={() => handleDeleteStage(stage.id, stage.name)}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: TASKS (Phase 3 Placeholder) */}
      {activeTab === 'tasks' && (
        <EmptyState
          icon="tasks"
          title="Daily Site Tasks & Snagging"
          description="Supervisor punch lists, defect logging, and artisan task delegation will be activated in Phase 3."
        />
      )}

      {/* TAB 4: DAILY REPORTS (Phase 3 Placeholder) */}
      {activeTab === 'dsr' && (
        <EmptyState
          icon="daily-reports"
          title="Daily Site Reports (DSR)"
          description="Supervisor evening site logs, progress photo gallery, and client WhatsApp broadcasts will be activated in Phase 3."
        />
      )}

      {/* TAB 5: FILES (Phase 4 Placeholder) */}
      {activeTab === 'files' && (
        <EmptyState
          icon="folder"
          title="Architectural Blueprints & 3D Renderings"
          description="Site layout DWGs, high-res renders, and vendor warranty documents storage will be activated in Phase 4."
        />
      )}

      {/* TAB 6: PAYMENTS (Phase 4 Placeholder) */}
      {activeTab === 'payments' && (
        <EmptyState
          icon="payments"
          title="Payment Milestones & Disbursements"
          description="Stage-linked client invoices, advance requests, and piece-rate artisan payouts will be activated in Phase 4."
        />
      )}

      {/* Edit Stage Modal */}
      <Modal
        isOpen={!!editingStage}
        onClose={() => setEditingStage(null)}
        title={`Edit Stage: ${editingStage?.name}`}
        subtitle="Manage start and end dates and allocate subcontractor agencies (affects this project only)"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditingStage(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveStage}>
              Save Stage Details
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveStage} className="space-y-4">
          <Input
            label="Stage Title"
            required
            value={stageFormData.name}
            onChange={(e) =>
              setStageFormData({ ...stageFormData, name: e.target.value })
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              required
              value={stageFormData.startDate}
              onChange={(e) =>
                setStageFormData({ ...stageFormData, startDate: e.target.value })
              }
            />
            <Input
              label="Target Completion Date"
              type="date"
              required
              value={stageFormData.endDate}
              onChange={(e) =>
                setStageFormData({ ...stageFormData, endDate: e.target.value })
              }
            />
          </div>

          <AgencySelect
            label="Subcontractor Agency"
            agencies={agencies}
            value={stageFormData.agencyId}
            onChange={(agencyId) =>
              setStageFormData({ ...stageFormData, agencyId })
            }
            includeInternal
          />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-text-main">
              Execution Status
            </label>
            <StageStatusControl
              value={stageFormData.status}
              onChange={(status) =>
                setStageFormData({ ...stageFormData, status })
              }
            />
          </div>
        </form>
      </Modal>

      {/* Assign Team Modal */}
      <Modal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        title="Assign Project Team"
        subtitle="Allocate site supervisors and craftsmen to this project site"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsTeamModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveTeam}>
              Save Assignments
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveTeam} className="space-y-4">
          <AssigneePicker
            label="Site Supervisors"
            roleFilter={ROLES.SUPERVISOR}
            users={users}
            value={teamForm.supervisors}
            onChange={(selected) =>
              setTeamForm({ ...teamForm, supervisors: selected })
            }
          />

          <AssigneePicker
            label="Site Workers & Lead Artisans"
            roleFilter={ROLES.WORKER}
            users={users}
            value={teamForm.workers}
            onChange={(selected) =>
              setTeamForm({ ...teamForm, workers: selected })
            }
          />
        </form>
      </Modal>

      {/* Add Custom Stage Modal */}
      <Modal
        isOpen={isAddStageOpen}
        onClose={() => setIsAddStageOpen(false)}
        title="Add Custom Project Stage"
        subtitle="Appends an extra stage for THIS project only"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsAddStageOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddProjectStage}>
              Add Stage to Project
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddProjectStage} className="space-y-4">
          <Input
            label="Stage Name"
            required
            placeholder="e.g. Bespoke Italian Granite Inlay"
            value={newStageForm.name}
            onChange={(e) =>
              setNewStageForm({ ...newStageForm, name: e.target.value })
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              required
              value={newStageForm.startDate}
              onChange={(e) =>
                setNewStageForm({ ...newStageForm, startDate: e.target.value })
              }
            />
            <Input
              label="End Date"
              type="date"
              required
              value={newStageForm.endDate}
              onChange={(e) =>
                setNewStageForm({ ...newStageForm, endDate: e.target.value })
              }
            />
          </div>

          <AgencySelect
            label="Allocate Agency"
            agencies={agencies}
            value={newStageForm.agencyId}
            onChange={(agencyId) =>
              setNewStageForm({ ...newStageForm, agencyId })
            }
            includeInternal
          />
        </form>
      </Modal>
    </div>
  );
}

export default ProjectDetailPage;

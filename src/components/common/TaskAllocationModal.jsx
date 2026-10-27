import React, { useState, useEffect } from 'react';
import { projectService } from '../../services/projectService';
import { userService } from '../../services/userService';
import { taskService } from '../../services/taskService';
import { useToast } from '../../context/ToastContext';
import { BASE_ROLE_LABELS } from '../../config/roles';
import { defaultStageTemplate } from '../../data/stageTemplate';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import Icon from '../ui/Icon';

const STAGES = defaultStageTemplate.map((s) => s.name);

const PRIORITIES = [
  { value: 'low', label: 'Low Priority' },
  { value: 'medium', label: 'Medium Priority' },
  { value: 'high', label: 'High Priority' },
  { value: 'urgent', label: 'Urgent' },
];

const TYPES = [
  { value: 'site', label: 'Site Execution' },
  { value: 'office', label: 'Office / Design' },
];

export function TaskAllocationModal({ isOpen, onClose, onTaskAllocated }) {
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectId: '',
    assignedToId: '',
    stageName: 'Cleaning',
    priority: 'medium',
    type: 'site',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      Promise.all([projectService.getAllProjects(), userService.getAllUsers()]).then(
        ([projList, userList]) => {
          setProjects(projList || []);
          setUsers(userList || []);
          if (projList && projList.length > 0 && !formData.projectId) {
            setFormData((prev) => ({ ...prev, projectId: projList[0].id }));
          }
          if (userList && userList.length > 0 && !formData.assignedToId) {
            // Find worker or supervisor default
            const defaultUser = userList.find((u) => u.role === 'site_worker' || u.role === 'site_supervisor') || userList[0];
            setFormData((prev) => ({ ...prev, assignedToId: defaultUser.id }));
          }
        }
      );
    }
  }, [isOpen]);

  // Keep milestone stage aligned with project's sequence
  useEffect(() => {
    if (formData.projectId && projects.length > 0) {
      const selectedProj = projects.find((p) => p.id === formData.projectId);
      if (selectedProj?.stages?.length > 0) {
        const hasStage = selectedProj.stages.some((s) => s.name === formData.stageName);
        if (!hasStage) {
          setFormData((prev) => ({ ...prev, stageName: selectedProj.stages[0].name }));
        }
      }
    }
  }, [formData.projectId, projects]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = () => {
    const err = {};
    if (!formData.title.trim()) err.title = 'Task title is required';
    if (!formData.projectId) err.projectId = 'Please select a project';
    if (!formData.assignedToId) err.assignedToId = 'Please assign an artisan or supervisor';
    if (!formData.dueDate) err.dueDate = 'Due date is required';
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const selectedProject = projects.find((p) => String(p.id) === String(formData.projectId));
      const selectedAssignee = users.find((u) => String(u.id) === String(formData.assignedToId));

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        projectId: formData.projectId,
        projectName: selectedProject ? selectedProject.name : 'Site Project',
        assignedToId: formData.assignedToId,
        assignedToName: selectedAssignee ? selectedAssignee.name : 'Assigned Staff',
        assignedToRole: selectedAssignee ? selectedAssignee.role : 'Worker',
        stageName: formData.stageName,
        priority: formData.priority,
        type: formData.type,
        dueDate: formData.dueDate,
        status: 'todo',
      };

      const created = await taskService.createTask(payload);
      toast.success(`Task allocated to ${selectedAssignee?.name || 'team member'}!`);

      // Dispatch global event for live reactivity across all views
      window.dispatchEvent(new CustomEvent('task-allocated', { detail: created }));

      if (onTaskAllocated) {
        onTaskAllocated(created);
      }
      onClose();
      // Reset form
      setFormData((prev) => ({
        ...prev,
        title: '',
        description: '',
      }));
    } catch (err) {
      console.error(err);
      toast.error('Failed to allocate task. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const projectOptions = projects.map((p) => ({
    value: p.id,
    label: `${p.name} (${p.city || p.clientName || 'Site'})`,
  }));

  // Show only user role (Owner, Manager, Supervisor, Worker, Client) without names as requested
  const userOptions = users.map((u) => {
    const roleLabel = (BASE_ROLE_LABELS[u.role] || u.role?.replace('_', ' ')).toUpperCase();
    return {
      value: u.id,
      label: roleLabel,
    };
  });

  // Stages displayed in strict sequential order from master template / project execution stages
  const selectedProject = projects.find((p) => p.id === formData.projectId);
  const stageOptions = (
    selectedProject?.stages && selectedProject.stages.length > 0
      ? selectedProject.stages.map((s, idx) => ({
          value: s.name,
          label: `${s.order || idx + 1}. ${s.name}`,
        }))
      : defaultStageTemplate.map((s) => ({
          value: s.name,
          label: `${s.order}. ${s.name}`,
        }))
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Task Allocation"
      description="Allocate operational tasks, quality checks, or daily deliverables to on-duty team members."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Task Title */}
        <Input
          label="Task Title"
          value={formData.title}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="e.g. Align kitchen carcass frames and check drawer runners"
          error={errors.title}
          autoFocus
          required
        />

        {/* Project & Assignee */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Assigned Project / Site"
            options={projectOptions}
            value={formData.projectId}
            onChange={(e) => handleChange('projectId', e.target.value)}
            error={errors.projectId}
            required
          />

          <Select
            label="Assignee (Artisan / Supervisor)"
            options={userOptions}
            value={formData.assignedToId}
            onChange={(e) => handleChange('assignedToId', e.target.value)}
            error={errors.assignedToId}
            required
          />
        </div>

        {/* Milestone Stage & Task Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Execution Milestone Stage"
            options={stageOptions}
            value={formData.stageName}
            onChange={(e) => handleChange('stageName', e.target.value)}
          />

          <Select
            label="Task Type"
            options={TYPES}
            value={formData.type}
            onChange={(e) => handleChange('type', e.target.value)}
          />
        </div>

        {/* Priority & Due Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Priority Level"
            options={PRIORITIES}
            value={formData.priority}
            onChange={(e) => handleChange('priority', e.target.value)}
          />

          <Input
            type="date"
            label="Due Date"
            value={formData.dueDate}
            onChange={(e) => handleChange('dueDate', e.target.value)}
            error={errors.dueDate}
            required
          />
        </div>

        {/* Detailed Instructions */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Detailed Work Instructions / Notes (Optional)
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
            placeholder="Specify architectural tolerances, vendor coordination details, or material specifications..."
            className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground resize-none"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={submitting}
            leftIcon={<Icon name="check" size={14} />}
          >
            Allocate Task
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default TaskAllocationModal;

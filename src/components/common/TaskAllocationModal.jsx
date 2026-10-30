import React, { useState, useEffect } from 'react';
import { projectService } from '../../services/projectService';
import { userService } from '../../services/userService';
import { taskService } from '../../services/taskService';
import { useToast } from '../../context/ToastContext';
import { validateRequired } from '../../utils/validators';
import { cn } from '../../lib/utils';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import FormMultiAssigneeSelect from './FormMultiAssigneeSelect';

export function TaskAllocationModal({ isOpen, onClose, onTaskAllocated }) {
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectId: '',
    assignedToIds: [],
    type: 'on-site',
    priority: 'medium',
    dueDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (isOpen) {
      setFormErrors({});
      Promise.all([projectService.getAllProjects(), userService.getAllUsers()]).then(
        ([projList, userList]) => {
          const validProjects = projList || [];
          setProjects(validProjects);
          setUsers(userList || []);
          setFormData({
            title: '',
            description: '',
            projectId: validProjects[0]?.id ? String(validProjects[0].id) : 'P1',
            assignedToIds: [],
            type: 'on-site',
            priority: 'medium',
            dueDate: new Date().toISOString().split('T')[0],
          });
        }
      );
    }
  }, [isOpen]);

    const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const titleErr = validateRequired(formData.title, 'Task Title', 2);
    const projErr = validateRequired(formData.projectId, 'Assigned Project');
    const assigneesErr =
      !formData.assignedToIds || formData.assignedToIds.length === 0
        ? 'Please select at least one assignee'
        : null;

    if (titleErr || projErr || assigneesErr) {
      setFormErrors({
        title: titleErr,
        projectId: projErr,
        assignedToIds: assigneesErr,
      });
      toast.error(titleErr || projErr || assigneesErr);
      return;
    }
    setFormErrors({});
    setSubmitting(true);

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const finalDueDate = formData.dueDate && formData.dueDate.trim() ? formData.dueDate.trim() : todayStr;
      const targetProj = projects.find((p) => String(p.id) === String(formData.projectId));
      const selectedUsers = users.filter((u) => formData.assignedToIds.includes(String(u.id)));
      const assignedToNames = selectedUsers.map((u) => {
        const roleLower = String(u.role || '').toLowerCase();
        const isOwner = roleLower === 'owner' || roleLower === 'admin' || (u.name && u.name.toLowerCase().includes('rohit'));
        return isOwner ? `${u.name} (Admin)` : u.name;
      });
      const primaryName = assignedToNames.join(', ') || 'Unassigned';

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        projectId: formData.projectId,
        projectName: targetProj?.name || 'Interior Site Fit-Out',
        type: formData.type,
        priority: formData.priority || 'medium',
        dueDate: finalDueDate,
        assignedToIds: formData.assignedToIds,
        assignedToNames,
        assignedToId: formData.assignedToIds[0] || '',
        assignedToName: primaryName,
        status: 'todo',
      };

      const created = await taskService.createTask(payload);
      toast.success(`Task "${formData.title}" created successfully`);

      // Dispatch global event for live reactivity across all views
      window.dispatchEvent(new CustomEvent('task-allocated', { detail: created }));

      if (onTaskAllocated) {
        onTaskAllocated(created);
      }
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to create task. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onClose();
        setFormErrors({});
      }}
      title="Create Task"
      subtitle="Allocate task to projects, set locations and assign staff"
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onClose();
              setFormErrors({});
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="dashboard-task-allocation-form"
            variant="primary"
            size="sm"
            loading={submitting}
            leadingIcon="plus"
          >
            Create Task
          </Button>
        </div>
      }
    >
      <form
        id="dashboard-task-allocation-form"
        onSubmit={handleSubmit}
        noValidate
        className="space-y-4 text-xs"
      >
        {/* Row 1: Task Title */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Task Title <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, title: e.target.value }));
              if (formErrors.title) setFormErrors((prev) => ({ ...prev, title: '' }));
            }}
            placeholder="e.g. Master bedroom veneer grain continuity inspection"
            className={cn(
              'w-full h-9 rounded-lg border bg-background px-3 text-xs text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs',
              formErrors.title ? 'border-destructive ring-1 ring-destructive' : 'border-border'
            )}
            autoFocus
          />
          {formErrors.title && (
            <p className="mt-1 text-[11px] text-destructive">{formErrors.title}</p>
          )}
        </div>

        {/* Row 2: Description */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Description
          </label>
          <textarea
            rows={2}
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Add specific execution details, material references, or notes..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground resize-none transition-colors focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs"
          />
        </div>

        {/* Row 3: Assigned Project & Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Select
            label="Assigned Project"
            required
            error={formErrors.projectId}
            value={formData.projectId}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, projectId: e.target.value }));
              if (formErrors.projectId) setFormErrors((prev) => ({ ...prev, projectId: '' }));
            }}
            options={projects.map((p) => ({
              value: String(p.id),
              label: p.name,
            }))}
          />

          <Select
            label="Location"
            value={formData.type}
            onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
            options={[
              { value: 'on-site', label: 'On-Site' },
              { value: 'office', label: 'Office' },
              { value: 'meeting', label: 'Meeting' },
              { value: 'other', label: 'Other' },
            ]}
          />
        </div>

        {/* Row 4: Multiple Assignees Selector */}
        <div>
          <FormMultiAssigneeSelect
            users={users}
            required
            label="Assign"
            error={formErrors.assignedToIds}
            selectedIds={formData.assignedToIds}
            onChange={(ids) => {
              setFormData((prev) => ({ ...prev, assignedToIds: ids }));
              if (formErrors.assignedToIds) {
                setFormErrors((prev) => ({ ...prev, assignedToIds: '' }));
              }
            }}
          />
        </div>

        {/* Row 5: Due Date & Priority Level */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Input
            label="Due Date"
            type="date"
            helperText="Defaults to today if omitted"
            error={formErrors.dueDate}
            value={formData.dueDate}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, dueDate: e.target.value }));
              if (formErrors.dueDate) setFormErrors((prev) => ({ ...prev, dueDate: '' }));
            }}
          />

          <Select
            label="Priority Level"
            value={formData.priority}
            onChange={(e) => setFormData((prev) => ({ ...prev, priority: e.target.value }))}
            options={[
              { value: 'low', label: 'Low Priority' },
              { value: 'medium', label: 'Medium Priority' },
              { value: 'high', label: 'High Priority' },
            ]}
          />
        </div>
      </form>
    </Modal>
  );
}

export default TaskAllocationModal;

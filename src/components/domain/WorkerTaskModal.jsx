import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { taskService } from '../../services/taskService';
import { validateRequired } from '../../utils/validators';
import { cn } from '../../lib/utils';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Select from '../ui/Select';
import Input from '../ui/Input';

const today = () => new Date().toISOString().split('T')[0];
const emptyForm = (projects) => ({
  title: '',
  description: '',
  projectId: projects[0]?.id ? String(projects[0].id) : '',
  type: 'on-site',
  priority: 'medium',
  dueDate: today(),
});

/**
 * "Create Task" for a site worker: a task for themselves only. There is no assignee choice, because the server
 * only accepts a worker's own id (tasks.createOwn), and only on a project they are on.
 */
export function WorkerTaskModal({ isOpen, onClose, projects, onCreated }) {
  const { currentUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(() => emptyForm(projects));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(emptyForm(projects));
      setErrors({});
    }
  }, [isOpen, projects]);

  const close = () => {
    setErrors({});
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = {
      title: validateRequired(form.title, 'Task Title', 2),
      projectId: validateRequired(form.projectId, 'Project'),
    };
    if (found.title || found.projectId) {
      setErrors(found);
      toast.error(found.title || found.projectId);
      return;
    }
    setSaving(true);
    try {
      const me = String(currentUser.id);
      const project = projects.find((p) => String(p.id) === String(form.projectId));
      const created = await taskService.createTask({
        title: form.title.trim(),
        description: form.description.trim(),
        projectId: form.projectId,
        projectName: project?.name || '',
        type: form.type,
        priority: form.priority,
        dueDate: form.dueDate || today(),
        assignedToIds: [me],
        assignedToNames: [currentUser.name],
        assignedToId: me,
        assignedToName: currentUser.name,
        status: 'todo',
      });
      toast.success(`Task "${form.title.trim()}" created`);
      window.dispatchEvent(new CustomEvent('task-allocated', { detail: created }));
      onCreated?.(created);
      close();
    } catch (err) {
      toast.error(err.message || 'Could not create the task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Create Task"
      subtitle="A task for yourself"
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button type="button" variant="outline" size="sm" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="worker-task-form" variant="primary" size="sm" loading={saving} leadingIcon="plus">
            Create Task
          </Button>
        </div>
      }
    >
      <form id="worker-task-form" onSubmit={submit} noValidate className="space-y-4 text-xs">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Task Title <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, title: e.target.value }));
              if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
            }}
            placeholder="e.g. Check the wardrobe hinges before polish"
            className={cn(
              'w-full h-9 rounded-lg border bg-background px-3 text-xs text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs',
              errors.title ? 'border-destructive ring-1 ring-destructive' : 'border-border'
            )}
            autoFocus
          />
          {errors.title && <p className="mt-1 text-[11px] text-destructive">{errors.title}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Description</label>
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Anything to remember about this task..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground resize-none transition-colors focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Select
            label="Project"
            required
            error={errors.projectId}
            value={form.projectId}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, projectId: e.target.value }));
              if (errors.projectId) setErrors((prev) => ({ ...prev, projectId: '' }));
            }}
            options={projects.map((p) => ({ value: String(p.id), label: p.name }))}
          />
          <Select
            label="Location"
            value={form.type}
            onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
            options={[
              { value: 'on-site', label: 'On-Site' },
              { value: 'office', label: 'Office' },
              { value: 'meeting', label: 'Meeting' },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Input
            label="Due Date"
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
          />
          <Select
            label="Priority"
            value={form.priority}
            onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
          />
        </div>

        <p className="text-[11px] text-text-muted">This task is assigned to you. You can move it forward from the Tasks page.</p>
      </form>
    </Modal>
  );
}

export default WorkerTaskModal;

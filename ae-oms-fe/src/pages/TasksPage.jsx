import React, { useState, useEffect, useMemo } from 'react';
import { taskService } from '../services/taskService';
import { projectService } from '../services/projectService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLES } from '../config/roles';
import { formatDate } from '../utils/formatters';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Tabs from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import SearchInput from '../components/ui/SearchInput';
import Select from '../components/ui/Select';
import StatusBadge from '../components/ui/StatusBadge';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Icon from '../components/ui/Icon';

const STATUS_COLUMNS = [
  { key: 'todo', label: 'To Do', color: 'border-t-brand-400 bg-brand-50/20' },
  { key: 'in progress', label: 'In Progress', color: 'border-t-amber-500 bg-amber-50/20' },
  { key: 'done', label: 'Completed', color: 'border-t-emerald-600 bg-emerald-50/20' },
];

export function TasksPage() {
  const toast = useToast();
  const { currentUser, hasPermission } = useAuth();
  const canCreate =
    hasPermission('tasks.create') ||
    currentUser?.role === ROLES.ADMIN ||
    currentUser?.role === ROLES.MANAGER ||
    currentUser?.role === ROLES.SUPERVISOR;

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [viewMode, setViewMode] = useState('board'); // 'board' or 'list'
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'site' or 'office'

  // Create Task Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectId: 'P1',
    stageName: 'Carpenter',
    assignedToId: '',
    type: 'site',
    priority: 'medium',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
  });

  // Photo Attachment Modal state
  const [photoTargetTask, setPhotoTargetTask] = useState(null);
  const [photoInputUrl, setPhotoInputUrl] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [allTasks, allProjects, allUsers] = await Promise.all([
        taskService.getAllTasks(),
        projectService.getAllProjects().catch(() => []),
        userService.getAllUsers().catch(() => []),
      ]);
      setTasks(allTasks);
      setProjects(allProjects);
      setUsers(allUsers);
      if (allUsers.length > 0 && !formData.assignedToId) {
        setFormData((prev) => ({ ...prev, assignedToId: allUsers[0].id }));
      }
    } catch (e) {
      toast.error('Failed to load tasks and assignees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        searchTerm === '' ||
        t.title?.toLowerCase().includes(q) ||
        t.projectName?.toLowerCase().includes(q) ||
        t.assignedToName?.toLowerCase().includes(q) ||
        t.stageName?.toLowerCase().includes(q);

      const matchesProject = projectFilter === 'ALL' || t.projectId === projectFilter;
      const matchesAssignee = assigneeFilter === 'ALL' || String(t.assignedToId) === String(assigneeFilter);
      const matchesType = typeFilter === 'ALL' || t.type === typeFilter;

      return matchesSearch && matchesProject && matchesAssignee && matchesType;
    });
  }, [tasks, searchTerm, projectFilter, assigneeFilter, typeFilter]);

  // Create Task Submit
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    try {
      const targetProj = projects.find((p) => p.id === formData.projectId);
      const targetUser = users.find((u) => String(u.id) === String(formData.assignedToId));

      await taskService.createTask({
        ...formData,
        projectName: targetProj?.name || 'Interior Site Fit-Out',
        assignedToName: targetUser?.name || 'Assigned Craftsman',
      });

      toast.success(`Task "${formData.title}" assigned successfully`);
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      toast.error('Failed to create task');
    }
  };

  // Quick checkbox toggle handler
  const handleToggleTaskStatus = async (taskId, currentStatus) => {
    const nextStatus = currentStatus === 'done' ? 'in progress' : 'done';
    try {
      await taskService.updateTaskStatus(taskId, nextStatus);
      toast.success(nextStatus === 'done' ? 'Task marked as completed!' : 'Task moved to in progress');
      loadData();
    } catch {
      toast.error('Failed to update task status');
    }
  };

  const pendingTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== 'done');
  }, [tasks]);

  // Status advance handler
  const handleAdvanceStatus = async (task) => {
    const nextStatus =
      task.status === 'todo' ? 'in progress' : task.status === 'in progress' ? 'done' : 'todo';
    try {
      await taskService.updateTaskStatus(task.id, nextStatus);
      toast.success(`Task status moved to "${nextStatus}"`);
      loadData();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  // Add Photo Attachment handler
  const handleAttachPhoto = async () => {
    if (!photoInputUrl.trim()) return;
    try {
      await taskService.attachPhoto(photoTargetTask.id, photoInputUrl.trim());
      toast.success('Inspection photo attached to task');
      setPhotoTargetTask(null);
      setPhotoInputUrl('');
      loadData();
    } catch (err) {
      toast.error('Failed to attach photo');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tasks & Site Checklist"
        subtitle="SRS Section 3.7 - Assign and track site trades and office deliverables with photo proofs"
        breadcrumbs={[
          { label: 'Operations', path: '/dashboard' },
          { label: 'Tasks' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-lg bg-surface p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('board')}
                className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 ${
                  viewMode === 'board' ? 'bg-brand-50 text-brand-700 shadow-2xs' : 'text-text-muted hover:text-text-main'
                }`}
                title="Kanban Board View"
              >
                <Icon name="columns" size={14} />
                <span className="hidden sm:inline">Board</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 ${
                  viewMode === 'list' ? 'bg-brand-50 text-brand-700 shadow-2xs' : 'text-text-muted hover:text-text-main'
                }`}
                title="Table List View"
              >
                <Icon name="list" size={14} />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>

            {canCreate && (
              <Button
                variant="primary"
                size="sm"
                leadingIcon="plus"
                onClick={() => setIsModalOpen(true)}
              >
                Create Task
              </Button>
            )}
          </div>
        }
      />

      {/* SECTION: Task Allocation & Real-time Checkoff Board */}
      <div className="p-5 bg-surface rounded-2xl border border-border shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-3">
          <div>
            <h3 className="text-base font-bold text-text-main flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Task Allocation Board</span>
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                {pendingTasks.length} Pending
              </span>
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Click checkboxes to mark tasks as completed in real time
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {canCreate && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="text-xs text-brand-700 bg-brand-50 border border-brand-200 hover:bg-brand-100 font-semibold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Icon name="plus" size={12} />
                <span>Allocate Task</span>
              </button>
            )}
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted bg-brand-50/50 rounded-xl">
            No site tasks allocated yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {tasks.slice(0, 6).map((task) => {
              const isDone = task.status === 'done';
              return (
                <div
                  key={task.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isDone
                      ? 'bg-slate-50 border-border/60 opacity-75'
                      : 'bg-surface border-border hover:border-amber-400'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleTaskStatus(task.id, task.status)}
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                        isDone
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-surface border-border hover:border-indigo-500'
                      }`}
                      title={isDone ? 'Mark in progress' : 'Mark done'}
                    >
                      {isDone && <Icon name="check" size={13} className="stroke-[3]" />}
                    </button>

                    <div className="min-w-0">
                      <p
                        className={`text-xs sm:text-sm font-semibold truncate ${
                          isDone ? 'line-through text-text-muted' : 'text-text-main'
                        }`}
                      >
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-text-muted mt-0.5 flex-wrap">
                        <span className="font-medium text-indigo-700">
                          {task.projectName || 'Site Project'}
                        </span>
                        <span>•</span>
                        <span>Assigned to: {task.assignedToName || 'Artisan'}</span>
                        {task.dueDate && (
                          <>
                            <span>•</span>
                            <span>Due: {formatDate(task.dueDate)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={task.status} size="sm" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter Toolbar */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-1">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tasks, sites, assignees..."
            />
          </div>

          <div>
            <Select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Projects (All)' },
                ...projects.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </div>

          <div>
            <Select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Assignees' },
                ...users.map((u) => ({ value: String(u.id), label: `${u.name} (${u.role})` })),
              ]}
            />
          </div>

          <div>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Types (Site + Office)' },
                { value: 'site', label: 'Site Trade Tasks (FR-TSK-02)' },
                { value: 'office', label: 'Office & Design Tasks (FR-TSK-02)' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* VIEW 1: Kanban Board View */}
      {viewMode === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STATUS_COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter(
              (t) =>
                t.status === col.key ||
                (col.key === 'todo' && (t.status === 'pending' || t.status === 'to do'))
            );

            return (
              <div key={col.key} className="space-y-3">
                <div
                  className={`flex items-center justify-between p-2.5 rounded-lg border bg-surface border-t-4 ${col.color}`}
                >
                  <div className="font-bold text-xs uppercase tracking-wider text-text-main flex items-center gap-2">
                    <span>{col.label}</span>
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-800 text-[11px] font-mono flex items-center justify-center font-bold">
                      {colTasks.length}
                    </span>
                  </div>
                  {canCreate && col.key === 'todo' && (
                    <IconButton
                      icon="plus"
                      size="xs"
                      ariaLabel="Add task"
                      onClick={() => setIsModalOpen(true)}
                    />
                  )}
                </div>

                <div className="space-y-2.5 min-h-[400px]">
                  {colTasks.map((t) => (
                    <Card
                      key={t.id}
                      className={`p-3.5 space-y-2.5 shadow-2xs hover:shadow-sm transition-all border ${
                        t.isOverdue ? 'border-danger/60 bg-danger-light/10' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                          {t.stageName || t.type}
                        </span>
                        {t.isOverdue && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-danger-light text-danger flex items-center gap-1">
                            <Icon name="clock" size={10} />
                            <span>Overdue</span>
                          </span>
                        )}
                      </div>

                      <div className="font-semibold text-xs text-text-main leading-snug">
                        {t.title}
                      </div>

                      <div className="text-[11px] text-text-muted truncate">
                        {t.projectName}
                      </div>

                      {/* Photo Attachments preview (FR-TSK-04) */}
                      {t.photos && t.photos.length > 0 && (
                        <div className="flex items-center gap-1.5 pt-1">
                          {t.photos.map((ph, idx) => (
                            <img
                              key={idx}
                              src={ph}
                              alt="Site proof"
                              className="w-8 h-8 rounded object-cover border border-border"
                            />
                          ))}
                          <span className="text-[10px] text-text-muted">
                            {t.photos.length} photo{t.photos.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t text-xs">
                        <div className="flex items-center gap-1.5">
                          <Avatar name={t.assignedToName} size="xs" />
                          <span className="text-[11px] text-text-muted truncate max-w-[100px]">
                            {t.assignedToName}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <IconButton
                            icon="camera"
                            size="xs"
                            variant="ghost"
                            ariaLabel="Attach photo"
                            title="Attach Photo Proof (FR-TSK-04)"
                            onClick={() => {
                              setPhotoTargetTask(t);
                              setPhotoInputUrl('https://images.unsplash.com/photo-1541123437800-1bb1317badc2?w=300');
                            }}
                          />
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => handleAdvanceStatus(t)}
                            title="Advance stage"
                          >
                            {t.status === 'done' ? 'Reopen' : 'Next >'}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}

                  {colTasks.length === 0 && (
                    <div className="p-6 text-center text-xs text-text-muted border-2 border-dashed rounded-lg bg-surface/50">
                      No tasks in {col.label}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VIEW 2: Table List View */
        <Card>
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-brand-50 text-text-muted uppercase font-semibold border-b">
                <tr>
                  <th className="p-3">Task Details</th>
                  <th className="p-3">Project & Stage</th>
                  <th className="p-3">Assignee</th>
                  <th className="p-3">Due Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-brand-50/50">
                    <td className="p-3 font-semibold text-text-main max-w-sm">
                      <div className="truncate">{t.title}</div>
                      <div className="text-[11px] text-text-muted font-normal uppercase">
                        {t.type} • Priority: {t.priority}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-text-main">{t.projectName}</div>
                      <div className="text-[11px] text-brand-700">{t.stageName || '-'}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={t.assignedToName} size="xs" />
                        <span>{t.assignedToName}</span>
                      </div>
                    </td>
                    <td className="p-3 font-mono">
                      <span className={t.isOverdue ? 'text-danger font-bold' : 'text-text-muted'}>
                        {t.dueDate || '-'}
                      </span>
                      {t.isOverdue && <span className="block text-[10px] text-danger">Overdue</span>}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={t.status} size="sm" />
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          icon="camera"
                          size="xs"
                          ariaLabel="Attach photo"
                          onClick={() => {
                            setPhotoTargetTask(t);
                            setPhotoInputUrl('https://images.unsplash.com/photo-1541123437800-1bb1317badc2?w=300');
                          }}
                        />
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleAdvanceStatus(t)}
                        >
                          Change Status
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Task Modal (FR-TSK-01 & FR-TSK-02) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Operational Task"
        subtitle="SRS Section 3.7: Assign deliverables to site craftsmen or office design team"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateTask}>
              Assign Task
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
          <Input
            label="Task Title / Snag Description"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Master bedroom veneer grain continuity inspection"
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Assigned Project"
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
            />

            <Select
              label="Assignment Type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              options={[
                { value: 'site', label: 'Site Trade Task (On-Site)' },
                { value: 'office', label: 'Office Deliverable (Studio)' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Assigned Person (FR-TSK-01)"
              value={formData.assignedToId}
              onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
              options={users.map((u) => ({
                value: String(u.id),
                label: `${u.name} (${u.role})`,
              }))}
            />

            <Input
              label="Stage / Trade"
              value={formData.stageName}
              onChange={(e) => setFormData({ ...formData, stageName: e.target.value })}
              placeholder="e.g. Carpenter, Ceiling, Plumbing"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Due Date (FR-TSK-07)"
              type="date"
              required
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />

            <Select
              label="Priority Level"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              options={[
                { value: 'low', label: 'Low Priority' },
                { value: 'medium', label: 'Medium Priority' },
                { value: 'high', label: 'High Priority (Urgent Snag)' },
              ]}
            />
          </div>
        </form>
      </Modal>

      {/* Attach Photo Modal (FR-TSK-04) */}
      <Modal
        isOpen={!!photoTargetTask}
        onClose={() => setPhotoTargetTask(null)}
        title="Attach Inspection Photo"
        subtitle={`Task: ${photoTargetTask?.title}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setPhotoTargetTask(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleAttachPhoto}>
              Upload Photo Proof
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <Input
            label="Photo URL or Cloudflare R2 Upload Path"
            required
            value={photoInputUrl}
            onChange={(e) => setPhotoInputUrl(e.target.value)}
            placeholder="https://... or photo data"
            helperText="SRS FR-TSK-04: Captures real-time workmanship proofs on mobile or desktop"
          />
          {photoInputUrl && (
            <div className="border rounded-lg p-2 bg-brand-50 flex items-center justify-center">
              <img
                src={photoInputUrl}
                alt="Preview"
                className="max-h-40 rounded object-cover shadow-2xs"
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default TasksPage;

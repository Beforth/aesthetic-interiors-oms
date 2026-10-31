import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiClient } from '../services/apiClient';
import { dsrService, categoryValue } from '../services/dsrService';
import { projectService } from '../services/projectService';
import { DSR_CATEGORIES, DSR_STATUSES, NO_PROJECT, dateDaysAgo } from '../data/dsr';
import { formatDuration, parseDuration } from '../utils/dsr';
import { validateRequired } from '../utils/validators';
import { cn } from '../lib/utils';

import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import EmptyState from '../components/ui/EmptyState';
import DsrAttachmentUploader from '../components/dsr/DsrAttachmentUploader';
import DsrPhotoLightboxModal from '../components/dsr/DsrPhotoLightboxModal';
import { CameraIcon, ClockIcon, EyeIcon, SearchIcon, TrashIcon, EditIcon } from '../components/ui/icons';

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
];
const BACKDATE_DAYS = 7; // the server only accepts work logged for the last 7 days
const EMPTY_FORM = { task: '', date: '', project: NO_PROJECT, category: DSR_CATEGORIES[0], time: '', status: 'completed', note: '', attachments: [] };

function rangeFor(period) {
  const today = dateDaysAgo(0);
  if (period === 'today') return { from: today, to: today };
  if (period === 'yesterday') return { from: dateDaysAgo(1), to: dateDaysAgo(1) };
  if (period === '7d') return { from: dateDaysAgo(6), to: today };
  return { from: dateDaysAgo(29), to: today };
}

const dayLabel = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
};
const sumMinutes = (rows) => rows.reduce((total, e) => total + e.minutes, 0);
const statusLabel = (value) => DSR_STATUSES.find((s) => s.value === value)?.label || value;

/** Brand-only status chip: filled when done, outlined while working, red text when blocked. */
function StatusChip({ status }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap border',
        status === 'completed' && 'bg-brand-900 text-white border-brand-900',
        status === 'in progress' && 'bg-transparent text-foreground border-border',
        status === 'blocked' && 'bg-destructive/10 text-destructive border-destructive/30'
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

/**
 * Daily report for a site worker: only their own entries. They can add work (today, or a missed day of the last
 * 7), edit or delete their own entries, and add photos. Photos cannot be changed or removed once uploaded.
 */
export function WorkerDsrPage() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const me = currentUser?.name || 'You';

  const [period, setPeriod] = useState('7d');
  const [search, setSearch] = useState('');
  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [lightbox, setLightbox] = useState({ isOpen: false, attachments: [], initialIndex: 0 });

  const { from, to } = rangeFor(period);
  const refresh = () => setReloadKey((n) => n + 1);

  const load = useCallback(async () => {
    try {
      const [rows, projectRows] = await Promise.all([
        dsrService.listEntries({ from, to }), // only ever your own
        projectService.getAllProjects(currentUser),
      ]);
      setEntries(rows);
      setProjects((projectRows || []).map((p) => ({ id: p.id, name: p.name })));
    } catch (err) {
      toast.error(err.message || 'Could not load your daily reports');
    } finally {
      setLoading(false);
    }
  }, [from, to, currentUser, toast]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const today = dateDaysAgo(0);
  const todayRows = entries.filter((e) => e.date === today);
  const todayMinutes = sumMinutes(todayRows);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter((e) => !q || [e.task, e.note, e.project, e.category].some((v) => (v || '').toLowerCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [entries, search]);

  const groups = useMemo(() => {
    const byDate = new Map();
    visible.forEach((e) => byDate.set(e.date, [...(byDate.get(e.date) || []), e]));
    return [...byDate].map(([date, rows]) => ({ date, rows, minutes: sumMinutes(rows) }));
  }, [visible]);

  const projectNames = [NO_PROJECT, ...projects.map((p) => p.name)];
  const noteRequired = form.project === NO_PROJECT && form.category === 'Other';

  // ---- add / edit --------------------------------------------------------------------------------------------------
  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, date: today });
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (entry) => {
    setEditing(entry);
    setForm({
      task: entry.task,
      date: entry.date,
      project: entry.project,
      category: entry.category,
      time: formatDuration(entry.minutes),
      status: entry.status,
      note: entry.note || '',
      attachments: [], // photos already saved are shown below the form; only new ones are added here
    });
    setErrors({});
    setFormOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    const taskError = validateRequired(form.task, 'What you worked on', 3);
    if (taskError) found.task = taskError;
    const minutes = parseDuration(form.time);
    if (minutes === null) found.time = 'Enter the time like 45m, 1h 30m or 2h';
    else if (minutes < 1) found.time = 'Time must be at least 1 minute';
    else if (minutes > 24 * 60) found.time = 'A single entry cannot be more than 24 hours';
    if (!editing && (!form.date || form.date > today || form.date < dateDaysAgo(BACKDATE_DAYS))) {
      found.date = `Pick today or one of the last ${BACKDATE_DAYS} days`;
    }
    if (noteRequired && !form.note.trim()) found.note = 'Add a description when there is no project and the category is Other';
    setErrors(found);
    if (Object.keys(found).length) return;

    const project = projects.find((p) => p.name === form.project);
    const body = {
      task: form.task.trim(),
      projectId: project ? String(project.id) : null,
      category: categoryValue(form.category),
      minutes,
      status: form.status,
      note: form.note.trim(),
    };
    setSaving(true);
    try {
      let saved;
      if (editing) {
        saved = await apiClient.patch(`/dsr/entries/${editing.id}/`, body);
      } else {
        saved = await apiClient.post('/dsr/entries/', { ...body, date: form.date });
      }
      await dsrService.addPhotos(saved.id, form.attachments, saved); // add-only
      toast.success(editing ? 'Entry updated' : 'Work added');
      setFormOpen(false);
      if (!editing) setPeriod('7d');
      refresh();
    } catch (err) {
      toast.error(err.message || 'Could not save the entry');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await dsrService.deleteEntry(deleting.id);
      toast.success('Entry deleted');
      refresh();
    } catch (err) {
      toast.error(err.message || 'Could not delete the entry');
    }
    setDeleting(null);
  };

  const openPhotos = (entry, index = 0) =>
    setLightbox({ isOpen: true, attachments: entry.attachments || [], initialIndex: index });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Report"
        subtitle="What you worked on each day"
        actions={
          <Button variant="primary" size="sm" leadingIcon="plus" onClick={openAdd}>
            Add Work
          </Button>
        }
      />

      {/* Today at a glance */}
      <div className="p-5 rounded-2xl bg-brand-900 text-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="flex items-center gap-5 sm:gap-8 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-200">Logged today</p>
            <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums leading-tight">
              {todayMinutes ? formatDuration(todayMinutes) : '—'}
            </p>
          </div>
          <div className="hidden sm:block w-px h-10 bg-white/20" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-200">Entries today</p>
            <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums leading-tight">{todayRows.length}</p>
          </div>
        </div>
        <span className="self-start sm:self-center inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/10 border border-white/25">
          <ClockIcon className="size-3.5" />
          {todayRows.length ? 'Report started' : 'Nothing logged yet'}
        </span>
      </div>

      {/* Period and search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer',
                period === p.value ? 'bg-brand-900 text-white' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="size-4 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your work..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <span className="text-xs text-muted-foreground sm:ml-auto">
          <span className="font-bold text-foreground">{visible.length}</span> entries • {formatDuration(sumMinutes(visible))}
        </span>
      </div>

      {/* Entries, one block per day */}
      {loading ? (
        <div className="p-10 text-center text-xs text-muted-foreground">Loading your reports…</div>
      ) : groups.length === 0 ? (
        <EmptyState
          title="No work logged here yet"
          description={search ? 'Nothing matches your search.' : 'Add what you worked on today.'}
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.date} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b border-border">
                <h3 className="text-sm font-bold text-foreground">
                  {group.date === today ? 'Today • ' : ''}
                  {dayLabel(group.date)}
                </h3>
                <span className="text-xs font-semibold text-muted-foreground">{formatDuration(group.minutes)}</span>
              </div>
              <ul className="divide-y divide-border">
                {group.rows.map((entry) => (
                  <li key={entry.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-snug">{entry.task}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {entry.project} • {entry.category}
                      </p>
                      {entry.note && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.note}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {(entry.attachments || []).length > 0 && (
                        <button
                          type="button"
                          onClick={() => openPhotos(entry)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                          title="View photos"
                        >
                          <CameraIcon className="size-4" />
                          {entry.attachments.length}
                        </button>
                      )}
                      <span className="font-mono text-xs font-semibold text-foreground w-14 text-right">
                        {formatDuration(entry.minutes)}
                      </span>
                      <StatusChip status={entry.status} />
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewing(entry)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                          title="View details"
                        >
                          <EyeIcon className="size-4" />
                        </button>
                        {entry.canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(entry)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <EditIcon className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleting(entry)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                              title="Delete"
                            >
                              <TrashIcon className="size-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Add / edit */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit work log' : 'Add work log'}
        subtitle={editing ? 'Change what you logged, or add more photos.' : undefined}
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button variant="outline" size="sm" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" form="worker-dsr-form" variant="primary" size="sm" loading={saving}>
              {editing ? 'Save changes' : 'Add entry'}
            </Button>
          </div>
        }
      >
        <form id="worker-dsr-form" onSubmit={submit} noValidate className="space-y-4">
          <Input
            label="What did you work on?"
            required
            value={form.task}
            onChange={(e) => setForm({ ...form, task: e.target.value })}
            placeholder="e.g. Fixed the wardrobe shutters in the master bedroom"
            error={errors.task}
            autoFocus
          />

          {!editing && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-foreground">Date</label>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setForm({ ...form, date: today })} className="px-2 py-0.5 text-[10px] font-semibold rounded bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 cursor-pointer">Today</button>
                  <button type="button" onClick={() => setForm({ ...form, date: dateDaysAgo(1) })} className="px-2 py-0.5 text-[10px] font-semibold rounded bg-muted hover:bg-muted/80 text-foreground border border-border cursor-pointer">Yesterday</button>
                </div>
              </div>
              <input
                type="date"
                value={form.date}
                min={dateDaysAgo(BACKDATE_DAYS)}
                max={today}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className={cn('w-full px-3 py-2 border rounded-lg bg-card text-foreground text-xs cursor-pointer', errors.date ? 'border-destructive' : 'border-border')}
              />
              {errors.date && <p className="text-[11px] font-medium text-destructive">{errors.date}</p>}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Select
              label="Project"
              value={form.project}
              onChange={(e) => setForm({ ...form, project: e.target.value })}
              options={projectNames.map((name) => ({ value: name, label: name }))}
            />
            <Select
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={DSR_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Time spent"
              required
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              placeholder="e.g. 1h 30m"
              error={errors.time}
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={DSR_STATUSES}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">
              Notes {noteRequired && <span className="text-destructive">*</span>}
            </label>
            <textarea
              rows={3}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder={noteRequired ? 'Describe the work (required with no project and Other)' : 'Optional details'}
              className={cn('w-full rounded-lg border bg-card px-3 py-2 text-xs text-foreground resize-none', errors.note ? 'border-destructive' : 'border-border')}
            />
            {errors.note && <p className="text-[11px] font-medium text-destructive">{errors.note}</p>}
          </div>

          <div className="pt-2 border-t border-border/70 space-y-3">
            {editing && (editing.attachments || []).length > 0 && (
              <div>
                <p className="text-xs font-medium text-foreground mb-1.5">Photos already added (cannot be changed)</p>
                <div className="flex flex-wrap gap-2">
                  {editing.attachments.map((photo, index) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => openPhotos(editing, index)}
                      className="size-14 rounded-lg overflow-hidden border border-border bg-muted cursor-pointer"
                      title={photo.name}
                    >
                      {photo.isImage ? <img src={photo.url} alt={photo.name} className="size-full object-cover" /> : <span className="text-[10px]">{photo.name}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <DsrAttachmentUploader
              attachments={form.attachments}
              onChange={(next) => setForm({ ...form, attachments: next })}
              userName={me}
              maxFiles={Math.max(0, 10 - (editing?.attachments?.length || 0))}
            />
          </div>
        </form>
      </Modal>

      {/* Details */}
      <Modal
        isOpen={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.task || 'Work log'}
        subtitle={viewing ? `${dayLabel(viewing.date)} • ${viewing.project}` : undefined}
        size="md"
        footer={<Button variant="outline" size="sm" onClick={() => setViewing(null)}>Close</Button>}
      >
        {viewing && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div><p className="text-muted-foreground">Category</p><p className="font-semibold text-foreground mt-0.5">{viewing.category}</p></div>
              <div><p className="text-muted-foreground">Time</p><p className="font-mono font-semibold text-foreground mt-0.5">{formatDuration(viewing.minutes)}</p></div>
              <div><p className="text-muted-foreground">Status</p><div className="mt-0.5"><StatusChip status={viewing.status} /></div></div>
            </div>
            {viewing.note && (
              <div><p className="text-muted-foreground">Notes</p><p className="text-foreground mt-0.5 leading-relaxed">{viewing.note}</p></div>
            )}
            {(viewing.attachments || []).length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1.5">Photos ({viewing.attachments.length})</p>
                <div className="flex flex-wrap gap-2">
                  {viewing.attachments.map((photo, index) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => openPhotos(viewing, index)}
                      className="size-20 rounded-lg overflow-hidden border border-border bg-muted cursor-pointer"
                      title={photo.name}
                    >
                      {photo.isImage ? <img src={photo.url} alt={photo.name} className="size-full object-cover" /> : <span className="text-[10px]">{photo.name}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <DsrPhotoLightboxModal
        isOpen={lightbox.isOpen}
        onClose={() => setLightbox((prev) => ({ ...prev, isOpen: false }))}
        attachments={lightbox.attachments}
        initialIndex={lightbox.initialIndex}
        canDelete={false}
      />

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title="Delete this entry?"
        message={deleting ? `"${deleting.task}" will be removed from your daily report.` : ''}
        confirmText="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default WorkerDsrPage;

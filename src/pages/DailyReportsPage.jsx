import React, { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLE_LABELS } from '../config/roles';
import { DSR_CATEGORIES, DSR_PROJECTS, DSR_STATUSES, NO_PROJECT, dateDaysAgo, mockDsrEntries } from '../data/dsr';
import { downloadCsv, entriesToCsv, formatDuration, parseDuration } from '../utils/dsr';
import { validateRequired } from '../utils/validators';

import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import SearchInput from '../components/ui/SearchInput';
import EmptyState from '../components/ui/EmptyState';
import PermissionGate from '../components/ui/PermissionGate';
import { StatusBadge } from '../components/ui/Badge';

const PAGE_SIZE = 20;

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'longest', label: 'Longest time' },
  { value: 'shortest', label: 'Shortest time' },
  { value: 'person', label: 'Person A to Z' },
];

const DEFAULT_FILTERS = {
  period: '7d',
  from: '',
  to: '',
  search: '',
  person: 'ALL',
  project: 'ALL',
  category: 'ALL',
  status: 'ALL',
  sort: 'newest',
};

const EMPTY_FORM = { task: '', project: NO_PROJECT, category: DSR_CATEGORIES[0], time: '', status: 'completed', note: '' };

/** The date range (inclusive, YYYY-MM-DD) a period stands for; a from/to pair overrides the period. */
function rangeFor({ period, from, to }) {
  if (from || to) return { start: from, end: to };
  const today = dateDaysAgo(0);
  if (period === 'today') return { start: today, end: today };
  if (period === 'yesterday') return { start: dateDaysAgo(1), end: dateDaysAgo(1) };
  if (period === '7d') return { start: dateDaysAgo(6), end: today };
  if (period === '30d') return { start: dateDaysAgo(29), end: today };
  return { start: '', end: '' };
}

function dayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  if (dateStr === dateDaysAgo(0)) return `${label} · Today`;
  if (dateStr === dateDaysAgo(1)) return `${label} · Yesterday`;
  return label;
}

const sum = (rows) => rows.reduce((total, e) => total + e.minutes, 0);

export function DailyReportsPage() {
  const toast = useToast();
  const { currentUser, role, hasPermission } = useAuth();
  const canViewAll = hasPermission('dsr.viewAll');

  const [entries, setEntries] = useState(mockDsrEntries);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // the entry being edited, or null when adding
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [deleting, setDeleting] = useState(null);

  const isOwn = (e) => e.authorName === currentUser?.name;
  const canChange = (e) => canViewAll || isOwn(e);

  const setFilter = (key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'period') {
        next.from = '';
        next.to = '';
      }
      return next;
    });
    setPage(1);
  };

  const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  // Everyone who may see these entries, before any filter is applied
  const visibleEntries = useMemo(
    () => (canViewAll ? entries : entries.filter(isOwn)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, canViewAll, currentUser?.name]
  );

  const people = useMemo(() => [...new Set(visibleEntries.map((e) => e.authorName))].sort(), [visibleEntries]);
  const projects = useMemo(() => [...new Set([...DSR_PROJECTS, ...visibleEntries.map((e) => e.project)])], [visibleEntries]);

  const filtered = useMemo(() => {
    const { start, end } = rangeFor(filters);
    const q = filters.search.trim().toLowerCase();
    const rows = visibleEntries.filter((e) => {
      if (start && e.date < start) return false;
      if (end && e.date > end) return false;
      if (filters.person !== 'ALL' && e.authorName !== filters.person) return false;
      if (filters.project !== 'ALL' && e.project !== filters.project) return false;
      if (filters.category !== 'ALL' && e.category !== filters.category) return false;
      if (filters.status !== 'ALL' && e.status !== filters.status) return false;
      if (q && ![e.task, e.note, e.project, e.category, e.authorName].some((v) => (v || '').toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
    const order = {
      newest: (a, b) => b.date.localeCompare(a.date),
      oldest: (a, b) => a.date.localeCompare(b.date),
      longest: (a, b) => b.minutes - a.minutes,
      shortest: (a, b) => a.minutes - b.minutes,
      person: (a, b) => a.authorName.localeCompare(b.authorName) || b.date.localeCompare(a.date),
    }[filters.sort];
    return [...rows].sort(order); // Array.sort is stable, so entries keep their order within a day
  }, [visibleEntries, filters]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const grouped = filters.sort === 'newest' || filters.sort === 'oldest';

  const groups = useMemo(() => {
    if (!grouped) return [{ key: 'all', date: null, rows: pageRows }];
    const byDate = new Map();
    pageRows.forEach((e) => byDate.set(e.date, [...(byDate.get(e.date) || []), e]));
    return [...byDate].map(([date, rows]) => ({ key: date, date, rows }));
  }, [pageRows, grouped]);

  const completed = filtered.filter((e) => e.status === 'completed').length;
  const peopleCount = new Set(filtered.map((e) => e.authorName)).size;

  // ------------------------------------------------------------------ add / edit
  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (entry) => {
    setEditing(entry);
    setForm({
      task: entry.task,
      project: entry.project,
      category: entry.category,
      time: formatDuration(entry.minutes),
      status: entry.status,
      note: entry.note || '',
    });
    setErrors({});
    setFormOpen(true);
  };

  const closeForm = () => setFormOpen(false);

  const submitForm = (e) => {
    e.preventDefault();
    const found = {};
    const taskError = validateRequired(form.task, 'What you worked on', 3);
    if (taskError) found.task = taskError;
    const minutes = parseDuration(form.time);
    if (minutes === null) found.time = 'Enter the time like 45m, 1h 30m or 2h';
    else if (minutes > 24 * 60) found.time = 'A single entry cannot be more than 24 hours';
    setErrors(found);
    if (Object.keys(found).length) return;

    const values = {
      task: form.task.trim(),
      project: form.project,
      category: form.category,
      minutes,
      status: form.status,
      note: form.note.trim(),
    };

    if (editing) {
      setEntries((prev) => prev.map((x) => (x.id === editing.id ? { ...x, ...values } : x)));
      toast.success('Entry updated');
    } else {
      setEntries((prev) => [
        {
          id: `dsr-${Date.now()}`,
          date: dateDaysAgo(0),
          authorId: String(currentUser?.id ?? ''),
          authorName: currentUser?.name || 'You',
          authorRole: ROLE_LABELS[role] || role || '',
          auto: false,
          ...values,
        },
        ...prev,
      ]);
      toast.success('Work added');
    }
    setFormOpen(false);
  };

  const confirmDelete = () => {
    setEntries((prev) => prev.filter((x) => x.id !== deleting.id));
    setDeleting(null);
    toast.success('Entry deleted');
  };

  // ------------------------------------------------------------------ export
  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.error('There is nothing to export for these filters');
      return;
    }
    downloadCsv(`dsr-${dateDaysAgo(0)}.csv`, entriesToCsv(filtered));
    toast.success(`Exported ${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'}`);
  };

  const selectOptions = (all, items) => [{ value: 'ALL', label: all }, ...items.map((v) => (typeof v === 'string' ? { value: v, label: v } : v))];
  const columns = canViewAll ? 8 : 7;

  const renderRow = (e) => (
    <tr key={e.id} className="border-t border-border hover:bg-brand-50/60 transition-colors">
      {canViewAll && (
        <td className="px-4 py-3 align-top">
          <div className="flex items-center gap-2.5 min-w-[150px]">
            <Avatar name={e.authorName} size="sm" />
            <div className="leading-tight">
              <div className="text-sm font-medium text-text-main">{e.authorName}</div>
              <div className="text-[11px] text-text-muted">{e.authorRole}</div>
            </div>
          </div>
        </td>
      )}
      <td className="px-4 py-3 align-top">
        <div className="flex items-start gap-2">
          <span className="text-sm text-text-main leading-snug">{e.task}</span>
          {e.auto && (
            <span className="shrink-0 mt-0.5 rounded-full bg-info-light text-info text-[10px] font-semibold px-2 py-0.5">
              Auto
            </span>
          )}
        </div>
        {e.note && <div className="text-xs text-text-muted mt-1">{e.note}</div>}
      </td>
      <td className="px-4 py-3 align-top text-sm text-text-main">{e.project}</td>
      <td className="px-4 py-3 align-top text-sm text-text-main whitespace-nowrap">{e.category}</td>
      <td className="px-4 py-3 align-top text-sm font-semibold text-text-main whitespace-nowrap">{formatDuration(e.minutes)}</td>
      <td className="px-4 py-3 align-top">
        <StatusBadge status={e.status} size="sm" />
      </td>
      <td className="px-4 py-3 align-top">
        {canChange(e) ? (
          <div className="flex items-center justify-end gap-0.5">
            <IconButton icon="edit" ariaLabel="Edit entry" size="sm" onClick={() => openEdit(e)} />
            <IconButton icon="trash" ariaLabel="Delete entry" size="sm" onClick={() => setDeleting(e)} />
          </div>
        ) : (
          <span className="text-text-muted text-sm">-</span>
        )}
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Daily Status Report"
        subtitle={canViewAll ? "Everyone's submitted work" : 'Your submitted work'}
        actions={
          <>
            <Button variant="outline" size="sm" leadingIcon="download" onClick={exportCsv}>
              Export CSV
            </Button>
            <PermissionGate permission="dsr.submit">
              <Button variant="primary" size="sm" leadingIcon="plus" onClick={openAdd}>
                Add work
              </Button>
            </PermissionGate>
          </>
        }
        className="!mb-2"
      />

      {/* Filters */}
      <div className="bg-surface border border-border rounded p-3 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="w-full lg:w-44 shrink-0">
            <Select
              aria-label="Period"
              placeholder={null}
              value={filters.from || filters.to ? 'custom' : filters.period}
              onChange={(e) => setFilter('period', e.target.value)}
              options={[...PERIODS, ...(filters.from || filters.to ? [{ value: 'custom', label: 'Custom range' }] : [])]}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">From</span>
            <Input aria-label="From date" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} />
            <span className="text-xs text-text-muted">To</span>
            <Input aria-label="To date" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <SearchInput value={filters.search} onChange={(e) => setFilter('search', e.target.value)} placeholder="Search entries..." />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canViewAll && (
            <div className="w-full sm:w-44">
              <Select aria-label="Person" placeholder={null} value={filters.person} onChange={(e) => setFilter('person', e.target.value)} options={selectOptions('All people', people)} />
            </div>
          )}
          <div className="w-full sm:w-52">
            <Select aria-label="Project" placeholder={null} value={filters.project} onChange={(e) => setFilter('project', e.target.value)} options={selectOptions('All projects', projects)} />
          </div>
          <div className="w-full sm:w-44">
            <Select aria-label="Category" placeholder={null} value={filters.category} onChange={(e) => setFilter('category', e.target.value)} options={selectOptions('All categories', DSR_CATEGORIES)} />
          </div>
          <div className="w-full sm:w-40">
            <Select aria-label="Status" placeholder={null} value={filters.status} onChange={(e) => setFilter('status', e.target.value)} options={selectOptions('All statuses', DSR_STATUSES)} />
          </div>
          <div className="w-full sm:w-40">
            <Select aria-label="Sort by" placeholder={null} value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)} options={SORTS.filter((s) => canViewAll || s.value !== 'person')} />
          </div>
          <Button variant="ghost" size="sm" leadingIcon="close" disabled={!hasActiveFilters} onClick={clearFilters}>
            Clear
          </Button>

          <div className="ml-auto text-sm text-text-muted">
            <span className="font-semibold text-text-main">{formatDuration(sum(filtered))}</span>
            {' · '}
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
            {' · '}
            {completed} completed
            {canViewAll && ` · ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}`}
          </div>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="daily-reports"
          title={visibleEntries.length === 0 ? 'No work logged yet' : 'No entries match these filters'}
          description={
            visibleEntries.length === 0
              ? 'Add what you worked on and it will show up here.'
              : 'Try a wider period or clear the filters.'
          }
          action={
            hasActiveFilters ? (
              <Button size="sm" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : (
              <PermissionGate permission="dsr.submit">
                <Button size="sm" onClick={openAdd}>
                  Add work
                </Button>
              </PermissionGate>
            )
          }
        />
      ) : (
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="bg-brand-50 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {canViewAll && <th className="px-4 py-2.5">Person</th>}
                  <th className="px-4 py-2.5 w-[34%]">Task</th>
                  <th className="px-4 py-2.5 min-w-[170px]">Project</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <React.Fragment key={group.key}>
                    {group.date && (
                      <tr className="border-t border-border bg-brand-50/50">
                        <td colSpan={columns} className="px-4 py-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-text-main">{dayLabel(group.date)}</span>
                            <span className="text-text-muted">
                              {formatDuration(sum(group.rows))} · {group.rows.length} {group.rows.length === 1 ? 'entry' : 'entries'}
                              {canViewAll && ` · ${new Set(group.rows.map((r) => r.authorName)).size} people`}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {group.rows.map(renderRow)}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-text-muted">
              <span>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                  Previous
                </Button>
                <span>
                  Page {currentPage} of {pageCount}
                </span>
                <Button variant="outline" size="sm" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add / edit work. Clicking outside the box or pressing Esc closes it (Modal). */}
      <Modal
        isOpen={formOpen}
        onClose={closeForm}
        title={editing ? 'Edit work' : 'Add work'}
        subtitle={editing ? 'Change what was logged for this entry.' : 'Add what you worked on. Only your own time counts.'}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" form="dsr-form" variant="primary" size="sm" leadingIcon={editing ? undefined : 'plus'}>
              {editing ? 'Save changes' : 'Add entry'}
            </Button>
          </>
        }
      >
        <form id="dsr-form" onSubmit={submitForm} className="space-y-4" noValidate>
          <Input
            label="What did you work on?"
            required
            autoFocus
            value={form.task}
            onChange={(e) => setForm({ ...form, task: e.target.value })}
            placeholder="What did you work on?"
            error={errors.task}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Project" placeholder={null} value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} options={projects} />
            <Select label="Category" placeholder={null} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={DSR_CATEGORIES} />
            <Input
              label="Time"
              required
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              placeholder="1h 30m"
              error={errors.time}
            />
            <Select label="Status" placeholder={null} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={DSR_STATUSES} />
          </div>
          <Input label="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional" />
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this entry?"
        subtitle="It will be removed from the report."
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-main">{deleting?.task}</p>
      </Modal>
    </div>
  );
}

export default DailyReportsPage;

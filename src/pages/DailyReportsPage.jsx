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

// `person: ''` means "me": everyone opens their own DSR first, and a person is picked to look at someone else's.
const DEFAULT_FILTERS = {
  period: '7d',
  from: '',
  to: '',
  search: '',
  person: '',
  project: 'ALL',
  category: 'ALL',
  status: 'ALL',
};

const EMPTY_FORM = { task: '', project: NO_PROJECT, category: DSR_CATEGORIES[0], time: '', status: 'completed', note: '' };

const TH = 'px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted border-r border-border last:border-r-0';
const TD = 'px-5 py-4 align-middle border-r border-border last:border-r-0';

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
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

const sum = (rows) => rows.reduce((total, e) => total + e.minutes, 0);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function DailyReportsPage() {
  const toast = useToast();
  const { currentUser, role, hasPermission } = useAuth();
  const canViewAll = hasPermission('dsr.viewAll');
  const me = currentUser?.name || '';

  const [entries, setEntries] = useState(mockDsrEntries);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [showMore, setShowMore] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // the entry being edited, or null when adding
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [deleting, setDeleting] = useState(null);
  const [viewing, setViewing] = useState(null); // the entry whose description is open

  // Whose DSR is on screen. Only people who may see everyone's work can look at anyone else's.
  const person = canViewAll && filters.person ? filters.person : me;
  const viewingSelf = person === me;
  const canChange = (e) => canViewAll || e.authorName === me;

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

  const moreCount =
    ['project', 'category', 'status'].filter((k) => filters[k] !== 'ALL').length + (filters.from || filters.to ? 1 : 0);
  const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  // Everyone in the person filter: me first, then the others A to Z (the admin is one of them)
  const peopleOptions = useMemo(() => {
    const others = [...new Set(entries.map((e) => e.authorName))].filter((n) => n !== me).sort();
    return [{ value: me, label: `${me} (You)` }, ...others.map((n) => ({ value: n, label: n }))];
  }, [entries, me]);

  const projects = useMemo(() => [...new Set([...DSR_PROJECTS, ...entries.map((e) => e.project)])], [entries]);

  const filtered = useMemo(() => {
    const { start, end } = rangeFor(filters);
    const q = filters.search.trim().toLowerCase();
    return entries
      .filter((e) => {
        if (e.authorName !== person) return false;
        if (start && e.date < start) return false;
        if (end && e.date > end) return false;
        if (filters.project !== 'ALL' && e.project !== filters.project) return false;
        if (filters.category !== 'ALL' && e.category !== filters.category) return false;
        if (filters.status !== 'ALL' && e.status !== filters.status) return false;
        if (q && ![e.task, e.note, e.project, e.category].some((v) => (v || '').toLowerCase().includes(q))) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // newest day first; stable, so a day keeps its order
  }, [entries, filters, person]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const groups = useMemo(() => {
    const byDate = new Map();
    pageRows.forEach((e) => byDate.set(e.date, [...(byDate.get(e.date) || []), e]));
    return [...byDate].map(([date, rows]) => ({ date, rows, minutes: sum(rows) }));
  }, [pageRows]);

  const completed = filtered.filter((e) => e.status === 'completed').length;

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
          authorName: me || 'You',
          authorRole: ROLE_LABELS[role] || role || '',
          auto: false,
          ...values,
        },
        ...prev,
      ]);
      clearFilters(); // new work is yours and dated today, so go back to your own DSR where it shows
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
    downloadCsv(`dsr-${person.toLowerCase().replace(/\s+/g, '-')}-${dateDaysAgo(0)}.csv`, entriesToCsv(filtered));
    toast.success(`Exported ${plural(filtered.length, 'entry', 'entries')}`);
  };

  const selectOptions = (all, items) => [{ value: 'ALL', label: all }, ...items.map((v) => (typeof v === 'string' ? { value: v, label: v } : v))];

  const renderRow = (e, group, index) => (
    <tr key={e.id} className="border-t border-border hover:bg-brand-50/50 transition-colors">
      {index === 0 && (
        <td rowSpan={group.rows.length} className={`${TD} text-center bg-surface min-w-[150px] w-[150px]`}>
          <div className="text-sm font-semibold text-text-main whitespace-nowrap">{dayLabel(group.date)}</div>
          <div className="text-xs text-text-muted mt-1 whitespace-nowrap">
            {formatDuration(group.minutes)} · {plural(group.rows.length, 'entry', 'entries')}
          </div>
        </td>
      )}
      <td className={TD}>
        <div className="flex items-start gap-2">
          <span className="text-sm text-text-main leading-snug">{e.task}</span>
          {e.auto && (
            <span className="shrink-0 mt-0.5 rounded-full bg-info-light text-info text-[10px] font-semibold px-2 py-0.5">Auto</span>
          )}
        </div>
      </td>
      <td className={`${TD} text-sm text-text-main`}>{e.project}</td>
      <td className={`${TD} text-sm text-text-main whitespace-nowrap`}>{e.category}</td>
      <td className={`${TD} text-sm font-semibold text-text-main text-center whitespace-nowrap`}>{formatDuration(e.minutes)}</td>
      <td className={`${TD} text-center`}>
        <StatusBadge status={e.status} size="sm" />
      </td>
      <td className={TD}>
        <div className="flex items-center justify-center gap-0.5">
          <IconButton icon="info" ariaLabel="View description" size="sm" onClick={() => setViewing(e)} />
          {canChange(e) && (
            <>
              <IconButton icon="edit" ariaLabel="Edit entry" size="sm" onClick={() => openEdit(e)} />
              <IconButton icon="trash" ariaLabel="Delete entry" size="sm" onClick={() => setDeleting(e)} />
            </>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-4 sm:-mx-4 lg:-mx-6">
      <PageHeader
        title="Daily Status Report"
        subtitle={viewingSelf ? 'Your submitted work' : `${person}'s submitted work`}
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

      {/* Filters: one quiet row; the less-used filters sit behind the Filters button */}
      <div className="space-y-2">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          {canViewAll && (
            <div className="w-full md:w-56 shrink-0">
              <Select
                aria-label="Person"
                placeholder={null}
                value={person}
                onChange={(e) => setFilter('person', e.target.value === me ? '' : e.target.value)}
                options={peopleOptions}
              />
            </div>
          )}
          <div className="flex-1 min-w-[200px]">
            <SearchInput value={filters.search} onChange={(e) => setFilter('search', e.target.value)} placeholder="Search entries..." />
          </div>
          <div className="w-full md:w-40 shrink-0">
            <Select
              aria-label="Period"
              placeholder={null}
              value={filters.from || filters.to ? 'custom' : filters.period}
              onChange={(e) => setFilter('period', e.target.value)}
              options={[...PERIODS, ...(filters.from || filters.to ? [{ value: 'custom', label: 'Custom range' }] : [])]}
            />
          </div>
          <Button variant="outline" size="md" leadingIcon="filter" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore}>
            Filters{moreCount > 0 ? ` · ${moreCount}` : ''}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="md" leadingIcon="close" onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>

        {showMore && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Select aria-label="Project" placeholder={null} value={filters.project} onChange={(e) => setFilter('project', e.target.value)} options={selectOptions('All projects', projects)} />
            <Select aria-label="Category" placeholder={null} value={filters.category} onChange={(e) => setFilter('category', e.target.value)} options={selectOptions('All categories', DSR_CATEGORIES)} />
            <Select aria-label="Status" placeholder={null} value={filters.status} onChange={(e) => setFilter('status', e.target.value)} options={selectOptions('All statuses', DSR_STATUSES)} />
            <div className="flex items-center gap-2">
              <Input aria-label="From date" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} />
              <span className="text-xs text-text-muted">to</span>
              <Input aria-label="To date" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} />
            </div>
          </div>
        )}

        <div className="text-sm text-text-muted">
          <span className="font-semibold text-text-main">{formatDuration(sum(filtered))}</span>
          {' · '}
          {plural(filtered.length, 'entry', 'entries')}
          {' · '}
          {completed} completed
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="daily-reports"
          title={entries.some((e) => e.authorName === person) ? 'No entries match these filters' : 'No work logged yet'}
          description={
            entries.some((e) => e.authorName === person)
              ? 'Try a wider period or clear the filters.'
              : viewingSelf
              ? 'Add what you worked on and it will show up here.'
              : `${person} has not logged any work yet.`
          }
          action={
            hasActiveFilters ? (
              <Button size="sm" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : viewingSelf ? (
              <PermissionGate permission="dsr.submit">
                <Button size="sm" onClick={openAdd}>
                  Add work
                </Button>
              </PermissionGate>
            ) : null
          }
        />
      ) : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left border-collapse">
              <thead>
                <tr className="bg-brand-50">
                  <th className={`${TH} text-center`}>Date</th>
                  <th className={`${TH} w-[36%]`}>Task</th>
                  <th className={TH}>Project</th>
                  <th className={TH}>Category</th>
                  <th className={`${TH} text-center`}>Time</th>
                  <th className={`${TH} text-center`}>Status</th>
                  <th className={`${TH} text-center`}>Actions</th>
                </tr>
              </thead>
              <tbody>{groups.map((group) => group.rows.map((e, i) => renderRow(e, group, i)))}</tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-text-muted">
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
          <Input label="Description" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional" />
        </form>
      </Modal>

      {/* Description of one task, opened with the info button */}
      <Modal
        isOpen={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.task}
        subtitle={viewing ? `${viewing.project} · ${viewing.category} · ${formatDuration(viewing.minutes)}` : ''}
        size="sm"
      >
        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">Description</div>
        <p className="text-sm text-text-main leading-relaxed whitespace-pre-wrap">
          {viewing?.note || <span className="text-text-muted">No description added.</span>}
        </p>
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

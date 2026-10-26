import React, { useMemo, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLE_LABELS } from '../config/roles';
import {
  DSR_CATEGORIES,
  DSR_PROJECTS,
  DSR_STATUSES,
  NO_PROJECT,
  dateDaysAgo,
  localTimestamp,
  mockDsrEntries,
} from '../data/dsr';
import {
  downloadCsv,
  entriesToCsv,
  formatDuration,
  formatFileSize,
  parseDuration,
  compressImage,
} from '../utils/dsr';
import { validateRequired } from '../utils/validators';

import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import Icon from '../components/ui/Icon';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import SearchInput from '../components/ui/SearchInput';
import EmptyState from '../components/ui/EmptyState';
import PermissionGate from '../components/ui/PermissionGate';
import PersonMenu from '../components/dsr/PersonMenu';
import DsrAttachmentUploader from '../components/dsr/DsrAttachmentUploader';
import DsrPhotoLightboxModal from '../components/dsr/DsrPhotoLightboxModal';
import DsrPhotoActionMenu from '../components/dsr/DsrPhotoActionMenu';
import { Avatar } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import {
  ClockIcon,
  CheckIcon,
  CalendarIcon,
  AlertIcon,
  BuildingIcon,
  SparkleIcon,
  CameraIcon,
  ImageIcon,
  FileIcon,
  DownloadIcon,
  UploadIcon,
  TrashIcon,
  EyeIcon,
  PlusIcon,
  MoreIcon,
} from '../components/ui/icons';

const PAGE_SIZES = [10, 25, 50, 100];
const STORAGE_KEY = 'osm_dsr_entries_v2';

function pageNumbers(current, total) {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const list = [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  return list.flatMap((n, i) => (i > 0 && n - list[i - 1] > 1 ? ['gap-' + n, n] : [n]));
}

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'all', label: 'All Time' },
];

const DEFAULT_FILTERS = {
  period: '7d',
  from: '',
  to: '',
  search: '',
  people: null,
  project: 'ALL',
  category: 'ALL',
  status: 'ALL',
};

const EMPTY_FORM = {
  task: '',
  project: NO_PROJECT,
  category: DSR_CATEGORIES[0],
  time: '',
  status: 'completed',
  note: '',
  attachments: [],
};

/**
 * Minimal status pill conforming strictly to BefUI & design.md tokens
 */
function StatusPill({ status }) {
  const label = DSR_STATUSES.find((x) => x.value === status)?.label || status;
  const isDone = status === 'completed';
  const isBlocked = status === 'blocked';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap border ${
        isDone
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
          : isBlocked
          ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20'
          : 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20'
      }`}
    >
      {label}
    </span>
  );
}

function rangeFor({ period, from, to }) {
  if (from || to) return { start: from, end: to };
  const today = dateDaysAgo(0);
  if (period === 'today') return { start: today, end: today };
  if (period === 'yesterday') return { start: dateDaysAgo(1), end: dateDaysAgo(1) };
  if (period === '7d') return { start: dateDaysAgo(6), end: today };
  if (period === '30d') return { start: dateDaysAgo(29), end: today };
  return { start: '', end: '' };
}

function longDayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function timeLabel(createdAt) {
  const time = (createdAt || '').split('T')[1];
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

const sum = (rows) => rows.reduce((total, e) => total + e.minutes, 0);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * Resolves numerical hierarchy authority rank for DSR view access:
 * 1: Admin / Owner (Highest authority)
 * 2: Manager
 * 3: Site Supervisor
 * 4: Site Worker
 * 5: Client
 */
function getRoleRank(r) {
  const clean = (r || '').toLowerCase().trim();
  if (clean.includes('admin') || clean.includes('owner')) return 1;
  if (clean.includes('manage')) return 2;
  if (clean.includes('supervis')) return 3;
  if (clean.includes('work') || clean.includes('artisan')) return 4;
  if (clean.includes('client')) return 5;
  return 4;
}

export function DailyReportsPage() {
  const toast = useToast();
  const { currentUser, role, hasPermission } = useAuth();
  const canViewAll = hasPermission('dsr.viewAll');
  const me = currentUser?.name || '';
  const myId = String(currentUser?.id || '');

  // Calculate caller's authority level
  const myRank = getRoleRank(role || currentUser?.role);
  const isAdmin = myRank === 1;

  // Initial load with localStorage support
  const [entries, setEntries] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((e) => {
            const mock = mockDsrEntries.find((m) => m.id === e.id);
            if (mock && (!e.attachments || e.attachments.length === 0) && mock.attachments?.length > 0) {
              return { ...e, attachments: mock.attachments };
            }
            return e;
          });
        }
      }
    } catch (err) {
      console.warn('Failed to parse saved DSR entries:', err);
    }
    return mockDsrEntries;
  });

  const updateEntries = (updater) => {
    setEntries((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        console.warn('Failed to save to localStorage:', err);
      }
      return next;
    });
  };

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showMore, setShowMore] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [deleting, setDeleting] = useState(null);
  const [viewing, setViewing] = useState(null);

  // Photo management state
  const [lightbox, setLightbox] = useState({
    isOpen: false,
    attachments: [],
    initialIndex: 0,
    entry: null,
  });
  const [deletingPhoto, setDeletingPhoto] = useState(null); // { entry, photo }
  const detailFileInputRef = useRef(null);
  const tableUploadInputRef = useRef(null);
  const [selectedUploadTarget, setSelectedUploadTarget] = useState(null);

  /**
   * Authority Access Rule:
   * 1. A user can ALWAYS see their own entries.
   * 2. Admin/Owner (Rank 1) DSR is NEVER shown to any other person (only show to admin).
   * 3. Top-down flow: Higher authority person can see below authority person DSR.
   *    Lower priority person CANNOT see higher priority person DSR.
   */
  const canUserViewEntry = (e) => {
    // 1. Own entries are always visible to the author
    if (e.authorName === me || (myId && String(e.authorId) === myId)) {
      return true;
    }

    // 2. Admin / Owner can see all subordinates
    if (myRank === 1) {
      return true;
    }

    const authorRank = getRoleRank(e.authorRole);

    // 3. Admin DSR is strictly hidden from non-admins
    if (authorRank === 1) {
      return false;
    }

    // 4. Strict top-down: user can only see people at or below their rank
    if (authorRank >= myRank) {
      return true;
    }

    return false;
  };

  // Base list of entries that current user is authorized to see
  const accessibleEntries = useMemo(() => {
    return entries.filter(canUserViewEntry);
  }, [entries, me, myId, myRank]);

  // Everyone else who has logged work that current user is authorized to view
  const others = useMemo(() => {
    return [...new Set(accessibleEntries.map((e) => e.authorName))]
      .filter((n) => n !== me)
      .sort();
  }, [accessibleEntries, me]);

  // Whose DSR is on screen
  const canViewOthers = canViewAll && others.length > 0;
  const selectedPeople = canViewOthers && filters.people ? filters.people : [me];
  const viewingSelf = selectedPeople.length === 1 && selectedPeople[0] === me;
  const multiple = selectedPeople.length > 1;

  // Edit / delete permissions: can change own or if admin
  const canChange = (e) => isAdmin || e.authorName === me || (myId && String(e.authorId) === myId);

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

  const setPeople = (names) =>
    setFilter('people', names.length === 1 && names[0] === me ? null : names);

  const moreCount =
    ['project', 'category', 'status'].filter((k) => filters[k] !== 'ALL').length +
    (filters.from || filters.to ? 1 : 0);
  const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const projects = useMemo(
    () => [...new Set([...DSR_PROJECTS, ...accessibleEntries.map((e) => e.project)])],
    [accessibleEntries]
  );

  const filtered = useMemo(() => {
    const { start, end } = rangeFor(filters);
    const q = filters.search.trim().toLowerCase();
    return accessibleEntries
      .filter((e) => {
        if (!selectedPeople.includes(e.authorName)) return false;
        if (start && e.date < start) return false;
        if (end && e.date > end) return false;
        if (filters.project !== 'ALL' && e.project !== filters.project) return false;
        if (filters.category !== 'ALL' && e.category !== filters.category) return false;
        if (filters.status !== 'ALL' && e.status !== filters.status) return false;
        if (
          q &&
          ![e.task, e.note, e.project, e.category, e.authorName].some((v) =>
            (v || '').toLowerCase().includes(q)
          )
        )
          return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [accessibleEntries, filters, selectedPeople]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const groups = useMemo(() => {
    const byDate = new Map();
    pageRows.forEach((e) => byDate.set(e.date, [...(byDate.get(e.date) || []), e]));
    return [...byDate].map(([date, rows]) => ({ date, rows, minutes: sum(rows) }));
  }, [pageRows]);

  const completedCount = filtered.filter((e) => e.status === 'completed').length;
  const inProgressCount = filtered.filter((e) => e.status === 'in progress').length;
  const blockedCount = filtered.filter((e) => e.status === 'blocked').length;

  let whose = `${selectedPeople[0]}'s`;
  if (viewingSelf) whose = 'Your';
  else if (multiple) whose = others.length + 1 === selectedPeople.length ? "Everyone's" : "Selected team's";

  const todayStr = dateDaysAgo(0);
  const yesterdayStr = dateDaysAgo(1);

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
      attachments: entry.attachments ? [...entry.attachments] : [],
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
      attachments: form.attachments || [],
    };

    if (editing) {
      updateEntries((prev) =>
        prev.map((x) => (x.id === editing.id ? { ...x, ...values } : x))
      );
      toast.success('Entry updated');
    } else {
      const newEntry = {
        id: `dsr-${Date.now()}`,
        date: dateDaysAgo(0),
        createdAt: localTimestamp(),
        authorId: String(currentUser?.id ?? ''),
        authorName: me || 'You',
        authorRole: ROLE_LABELS[role] || role || '',
        auto: false,
        ...values,
      };
      updateEntries((prev) => [newEntry, ...prev]);
      clearFilters();
      toast.success('Work added');
    }
    setFormOpen(false);
  };

  const confirmDelete = () => {
    updateEntries((prev) => prev.filter((x) => x.id !== deleting.id));
    setDeleting(null);
    toast.success('Entry deleted');
  };

  // ------------------------------------------------------------------ photo actions
  const openLightbox = (entry, initialIndex = 0) => {
    setLightbox({
      isOpen: true,
      attachments: entry.attachments || [],
      initialIndex,
      entry,
    });
  };

  const closeLightbox = () => {
    setLightbox((prev) => ({ ...prev, isOpen: false }));
  };

  const openDeletePhoto = (entry, photo) => {
    setDeletingPhoto({ entry, photo });
  };

  const handleConfirmDeletePhoto = () => {
    if (!deletingPhoto) return;
    const { entry, photo } = deletingPhoto;

    updateEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entry.id) return e;
        const nextAtts = (e.attachments || []).filter((a) => a.id !== photo.id);
        const updatedEntry = { ...e, attachments: nextAtts };
        if (viewing && viewing.id === e.id) {
          setViewing(updatedEntry);
        }
        if (lightbox.isOpen && lightbox.entry?.id === e.id) {
          if (nextAtts.length === 0) {
            setLightbox((prevLb) => ({ ...prevLb, isOpen: false, attachments: [] }));
          } else {
            setLightbox((prevLb) => ({
              ...prevLb,
              attachments: nextAtts,
              initialIndex: 0,
              entry: updatedEntry,
            }));
          }
        }
        return updatedEntry;
      })
    );

    setDeletingPhoto(null);
    toast.success('Photo deleted from DSR entry');
  };

  const handleDirectPhotoUpload = async (e, targetEntry) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const newAtts = [];
      for (const file of Array.from(files)) {
        const processed = await compressImage(file, 1400, 0.82);
        newAtts.push({
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: processed.name,
          url: processed.url,
          type: processed.type,
          size: processed.size,
          caption: '',
          uploadedAt: new Date().toISOString(),
          uploadedBy: me || 'You',
          isImage: processed.type.startsWith('image/'),
        });
      }

      if (newAtts.length > 0) {
        updateEntries((prev) =>
          prev.map((item) => {
            if (item.id !== targetEntry.id) return item;
            const merged = [...(item.attachments || []), ...newAtts];
            const updated = { ...item, attachments: merged };
            if (viewing && viewing.id === item.id) {
              setViewing(updated);
            }
            return updated;
          })
        );
        toast.success(`Attached ${newAtts.length} new photo${newAtts.length > 1 ? 's' : ''}`);
      }
    } catch (err) {
      console.error('Failed to upload photos:', err);
      toast.error('Failed to attach photos');
    } finally {
      e.target.value = '';
    }
  };

  // ------------------------------------------------------------------ export
  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.error('There is nothing to export for these filters');
      return;
    }
    const who =
      viewingSelf || selectedPeople.length === 1
        ? selectedPeople[0].toLowerCase().replace(/\s+/g, '-')
        : 'team';
    downloadCsv(`dsr-${who}-${dateDaysAgo(0)}.csv`, entriesToCsv(filtered));
    toast.success(`Exported ${plural(filtered.length, 'entry', 'entries')}`);
  };

  const selectOptions = (all, items) => [
    { value: 'ALL', label: all },
    ...items.map((v) => (typeof v === 'string' ? { value: v, label: v } : v)),
  ];

  const hasAnyForSelection = accessibleEntries.some((e) => selectedPeople.includes(e.authorName));

  return (
    <div className="relative space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Daily Status Report"
        subtitle={`${whose} operational site execution, photos, and daily task records`}
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-surface hover:bg-slate-50 text-text-main border border-border transition-colors shadow-2xs cursor-pointer"
            >
              <DownloadIcon className="size-4 text-text-muted" />
              <span>Export CSV</span>
            </button>
            <PermissionGate permission="dsr.submit">
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-sm cursor-pointer"
              >
                <PlusIcon className="size-4" />
                <span>Add Work</span>
              </button>
            </PermissionGate>
          </div>
        }
      />

      {/* Sleek Compact KPI Summary Cards */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Tasks Completed Card */}
        <div className="w-48 sm:w-52 rounded-xl border border-border bg-card px-3 py-2 shadow-2xs hover:border-border/80 transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Tasks Completed
            </span>
            <div className="size-5 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckIcon className="size-3 stroke-[2.5]" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-lg font-bold font-mono tracking-tight text-foreground tabular-nums">
              {completedCount}
            </span>
            <span className="text-[10px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              {filtered.length > 0 ? `${Math.round((completedCount / filtered.length) * 100)}% done` : '0%'}
            </span>
          </div>
        </div>

        {/* In Progress Card */}
        <div className="w-48 sm:w-52 rounded-xl border border-border bg-card px-3 py-2 shadow-2xs hover:border-border/80 transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              In Progress
            </span>
            <div className="size-5 rounded-md bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
              <SparkleIcon className="size-3" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-lg font-bold font-mono tracking-tight text-foreground tabular-nums">
              {inProgressCount}
            </span>
            <span className="text-[10px] text-muted-foreground truncate font-medium">
              Active ongoing
            </span>
          </div>
        </div>
      </div>

      {/* Modern Filter Toolbar Container - Sticky on scroll */}
      <div className="sticky top-0 z-20 rounded-xl border border-border bg-card/95 backdrop-blur-md p-3 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5 justify-between">
          <div className="flex items-center gap-2.5 flex-1 min-w-0 flex-wrap">
            {canViewOthers && (
              <div className="w-full sm:w-56 shrink-0">
                <PersonMenu
                  me={me}
                  others={others}
                  value={selectedPeople}
                  onChange={setPeople}
                />
              </div>
            )}

            <div className="flex-1 min-w-[200px]">
              <SearchInput
                value={filters.search}
                onChange={(e) => setFilter('search', e.target.value)}
                placeholder="Search tasks, photos, projects, categories..."
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Native Clean Segmented Control */}
            <div className="flex items-center bg-muted/80 p-0.5 rounded-lg border border-border/70">
              {PERIODS.map((p) => {
                const isActive = !filters.from && !filters.to && filters.period === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setFilter('period', p.value)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-card text-foreground shadow-xs border border-border/80'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="md"
              leadingIcon="filter"
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
            >
              Filters{moreCount > 0 ? ` · ${moreCount}` : ''}
            </Button>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="md"
                leadingIcon="close"
                onClick={clearFilters}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Collapsible Secondary Filter Tray */}
        {showMore && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-border/70 animate-in fade-in">
            <Select
              label="Project"
              aria-label="Project"
              placeholder={null}
              value={filters.project}
              onChange={(e) => setFilter('project', e.target.value)}
              options={selectOptions('All projects', projects)}
            />
            <Select
              label="Category"
              aria-label="Category"
              placeholder={null}
              value={filters.category}
              onChange={(e) => setFilter('category', e.target.value)}
              options={selectOptions('All categories', DSR_CATEGORIES)}
            />
            <Select
              label="Status"
              aria-label="Status"
              placeholder={null}
              value={filters.status}
              onChange={(e) => setFilter('status', e.target.value)}
              options={selectOptions('All statuses', DSR_STATUSES)}
            />
            <Input
              label="From Date"
              aria-label="From date"
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => setFilter('from', e.target.value)}
            />
            <Input
              label="To Date"
              aria-label="To date"
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => setFilter('to', e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Main Content: Organized Day Section Cards */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="daily-reports"
          title={hasAnyForSelection ? 'No entries match these filters' : 'No work logged yet'}
          description={
            hasAnyForSelection
              ? 'Try choosing a wider time period or clearing current filters.'
              : viewingSelf
              ? 'Add what you worked on today, upload site photos, and it will show up here.'
              : 'Nobody selected has logged any work for this period.'
          }
          action={
            hasActiveFilters ? (
              <Button size="sm" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : viewingSelf ? (
              <PermissionGate permission="dsr.submit">
                <Button size="sm" onClick={openAdd}>
                  Add Work
                </Button>
              </PermissionGate>
            ) : null
          }
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const isToday = group.date === todayStr;
            const isYesterday = group.date === yesterdayStr;

            return (
              <div
                key={group.date}
                className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden"
              >
                {/* Clean, Flat Day Header */}
                <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between gap-2.5">
                  <h3 className="text-sm font-semibold text-foreground">
                    {isToday
                      ? 'Current Day Operations'
                      : isYesterday
                      ? 'Yesterday'
                      : longDayLabel(group.date)}
                  </h3>

                  {/* Summary Metric Chips */}
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs text-muted-foreground font-medium">
                      {plural(group.rows.length, 'task submitted', 'tasks submitted')}
                    </span>
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/70 tabular-nums">
                      {formatDuration(group.minutes)} logged
                    </span>
                  </div>
                </div>

                {/* Structured Table for this Day */}
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed text-left text-xs border-collapse">
                    <colgroup>
                      {multiple && <col className="w-36" />}
                      <col className="w-[32%]" />
                      <col className="w-32" />
                      <col className="w-[24%]" />
                      <col className="w-32" />
                      <col className="w-20" />
                      <col className="w-28" />
                      <col className="w-24" />
                    </colgroup>
                    <thead>
                      <tr className="bg-muted/30 border-b border-border/70 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {multiple && (
                          <th className="h-8 px-4 w-36">
                            Member
                          </th>
                        )}
                        <th className="h-8 px-4">
                          Task Description
                        </th>
                        <th className="h-8 px-4 w-32">
                          Site Photo
                        </th>
                        <th className="h-8 px-4">
                          Project
                        </th>
                        <th className="h-8 px-4 w-32">
                          Category
                        </th>
                        <th className="h-8 px-4 w-20 text-center">
                          Time
                        </th>
                        <th className="h-8 px-4 w-28 text-center">
                          Status
                        </th>
                        <th className="h-8 px-4 w-24 text-center">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {group.rows.map((e) => {
                        const attachments = e.attachments || [];
                        const photoAttachments = attachments.filter(
                          (a) => a.type?.startsWith('image/') || a.isImage
                        );
                        const fileAttachments = attachments.filter(
                          (a) => !a.type?.startsWith('image/') && !a.isImage
                        );
                        const primaryPhoto = photoAttachments[0] || (attachments.length > 0 ? attachments[0] : null);

                        return (
                          <tr
                            key={e.id}
                            className="group hover:bg-muted/35 transition-colors"
                          >
                            {/* Member Column (shown when multiple members selected) */}
                            {multiple && (
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-2.5">
                                  <Avatar name={e.authorName} size="xs" />
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
                                      <span>{e.authorName}</span>
                                      {e.authorName === me && (
                                        <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1 rounded">
                                          You
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                      {e.authorRole || timeLabel(e.createdAt)}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            )}

                            {/* Task Description */}
                            <td className="px-4 py-3 min-w-0">
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-medium text-foreground leading-snug line-clamp-2">
                                  {e.task}
                                </span>
                                {e.auto && (
                                  <Badge variant="info" size="sm" className="shrink-0 text-[9px] px-1.5 py-0">
                                    Auto
                                  </Badge>
                                )}
                              </div>
                              {e.note && (
                                <div className="mt-1 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                                  <span className="text-muted-foreground/50 select-none">•</span>
                                  <span className="italic line-clamp-1">{e.note}</span>
                                </div>
                              )}
                            </td>

                            {/* Site Photo with 3-Dots Action Menu (Small Uploaded Img + Three Dots) */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <DsrPhotoActionMenu
                                entry={e}
                                photo={primaryPhoto}
                                allPhotos={photoAttachments.length > 0 ? photoAttachments : attachments}
                                canManage={isAdmin || canChange(e)}
                                onViewPhoto={(entry, idx) => openLightbox(entry, idx)}
                                onUploadPhoto={() => {
                                  setSelectedUploadTarget(e);
                                  tableUploadInputRef.current?.click();
                                }}
                              />
                            </td>

                            {/* Project */}
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1.5 min-w-0" title={e.project === NO_PROJECT ? 'No Project' : e.project}>
                                <BuildingIcon className="size-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate font-medium text-foreground">
                                  {e.project === NO_PROJECT ? (
                                    <span className="text-muted-foreground italic">No Project</span>
                                  ) : (
                                    e.project
                                  )}
                                </span>
                              </div>
                            </td>

                            {/* Category */}
                            <td className="px-4 py-3 text-xs whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md bg-muted/80 text-[11px] font-medium text-muted-foreground border border-border/70 truncate inline-block max-w-full">
                                {e.category}
                              </span>
                            </td>

                            {/* Time Logged */}
                            <td className="px-4 py-3 text-xs text-center whitespace-nowrap">
                              <span className="inline-flex items-center justify-center font-mono text-xs font-bold text-foreground bg-muted/90 px-2.5 py-0.5 rounded-md border border-border/80 tabular-nums">
                                {formatDuration(e.minutes)}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <StatusPill status={e.status} />
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                <IconButton
                                  icon="eye"
                                  ariaLabel="View details"
                                  size="sm"
                                  onClick={() => setViewing(e)}
                                />
                                {canChange(e) && (
                                  <IconButton
                                    icon="trash"
                                    ariaLabel="Delete entry"
                                    size="sm"
                                    onClick={() => setDeleting(e)}
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
              </div>
            );
          })}

          {/* Clean Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border border-border rounded-xl px-4 py-3 text-xs text-muted-foreground bg-card shadow-2xs">
            <span>
              Showing{' '}
              <strong className="text-foreground">
                {(currentPage - 1) * pageSize + 1}-
                {Math.min(currentPage * pageSize, filtered.length)}
              </strong>{' '}
              of <strong className="text-foreground">{filtered.length}</strong> items
            </span>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                Rows per page
                <select
                  aria-label="Rows per page"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-xs"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              <nav aria-label="Pagination" className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Prev
                </Button>
                {pageNumbers(currentPage, pageCount).map((n, i) =>
                  typeof n === 'string' ? (
                    <span key={n + i} className="px-1 text-xs text-muted-foreground">
                      …
                    </span>
                  ) : (
                    <button
                      key={n}
                      type="button"
                      aria-label={`Page ${n}`}
                      aria-current={n === currentPage ? 'page' : undefined}
                      onClick={() => setPage(n)}
                      className={`size-8 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        n === currentPage
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-foreground hover:bg-muted border border-border/60'
                      }`}
                    >
                      {n}
                    </button>
                  )
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </Button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Work Modal (Includes Photo/File Upload) */}
      <Modal
        isOpen={formOpen}
        onClose={closeForm}
        title={editing ? 'Edit work log' : 'Add work log'}
        subtitle={
          editing
            ? 'Update what was logged for this entry and attach site photos.'
            : 'Record what you worked on today and upload site photos.'
        }
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button variant="outline" size="sm" onClick={closeForm}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="dsr-form"
              variant="primary"
              size="sm"
              leadingIcon={editing ? undefined : 'plus'}
            >
              {editing ? 'Save changes' : 'Add entry'}
            </Button>
          </div>
        }
      >
        <form id="dsr-form" onSubmit={submitForm} className="space-y-4" noValidate>
          <Input
            label="What did you work on?"
            required
            autoFocus
            value={form.task}
            onChange={(e) => setForm({ ...form, task: e.target.value })}
            placeholder="e.g. Completed second coat painting on master bedroom ceiling"
            error={errors.task}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Project"
              placeholder={null}
              value={form.project}
              onChange={(e) => setForm({ ...form, project: e.target.value })}
              options={projects}
            />
            <Select
              label="Category"
              placeholder={null}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={DSR_CATEGORIES}
            />
            <Input
              label="Time spent"
              required
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              placeholder="e.g. 1h 30m or 45m"
              error={errors.time}
            />
            <Select
              label="Status"
              placeholder={null}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={DSR_STATUSES}
            />
          </div>
          <Input
            label="Notes / Description"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Optional additional notes or milestone details"
          />

          {/* User Photo & Document Upload Option */}
          <div className="pt-2 border-t border-border/70">
            <DsrAttachmentUploader
              attachments={form.attachments || []}
              onChange={(newAtts) => setForm({ ...form, attachments: newAtts })}
              userName={me || 'You'}
            />
          </div>
        </form>
      </Modal>

      {/* Details View Modal with Photo Gallery & Admin Actions */}
      <Modal
        isOpen={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title="DSR Entry Details"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-muted-foreground">
              {isAdmin && (
                <span className="font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                  Admin Access
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setViewing(null)}>
              Close
            </Button>
          </div>
        }
      >
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 p-3.5 rounded-lg bg-muted/40 border border-border">
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5 tracking-wider">
                  Task
                </span>
                <h3 className="text-sm font-bold text-foreground leading-snug">
                  {viewing.task}
                </h3>
              </div>
              <span className="shrink-0">
                <StatusPill status={viewing.status} />
              </span>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg border border-border bg-card text-xs">
              {[
                [
                  'Person',
                  viewing.authorName === me
                    ? `${viewing.authorName} (You)`
                    : viewing.authorName,
                ],
                ['Role', viewing.authorRole || 'Team Member'],
                ['Date', longDayLabel(viewing.date)],
                ['Time spent', formatDuration(viewing.minutes)],
                ['Project', viewing.project],
                ['Category', viewing.category],
                ['Logged at', timeLabel(viewing.createdAt) || '-'],
                ['Files', `${(viewing.attachments || []).length} attached`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="mt-0.5 text-xs font-semibold text-foreground truncate">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            {viewing.note && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Description / Remarks
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                  {viewing.note}
                </div>
              </div>
            )}

            {/* Attached Site Photos & Documents Section */}
            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CameraIcon className="size-4 text-primary" />
                  <h4 className="text-xs font-semibold text-foreground">
                    Attached Site Photos & Documents
                  </h4>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/70">
                    {(viewing.attachments || []).length}
                  </span>
                </div>

                {/* Direct Upload button for Admin or Entry Author */}
                {(isAdmin || canChange(viewing)) && (
                  <div>
                    <input
                      ref={detailFileInputRef}
                      type="file"
                      accept="image/*,.pdf,.doc,.docx,.txt"
                      multiple
                      className="sr-only"
                      onChange={(e) => handleDirectPhotoUpload(e, viewing)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      leadingIcon="plus"
                      onClick={() => detailFileInputRef.current?.click()}
                    >
                      Upload Photos
                    </Button>
                  </div>
                )}
              </div>

              {(!viewing.attachments || viewing.attachments.length === 0) ? (
                <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-5 text-center">
                  <p className="text-xs text-muted-foreground">
                    No site photos or files attached to this work log.
                  </p>
                  {(isAdmin || canChange(viewing)) && (
                    <button
                      type="button"
                      onClick={() => detailFileInputRef.current?.click()}
                      className="text-xs text-primary font-semibold hover:underline mt-1.5 inline-block cursor-pointer"
                    >
                      + Click here to upload site photos or progress documents
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {viewing.attachments.map((att, idx) => {
                    const isImg = att.type?.startsWith('image/') || att.isImage;
                    return (
                      <div
                        key={att.id || idx}
                        className="rounded-lg border border-border bg-card shadow-2xs overflow-hidden flex flex-col group hover:border-border/80 transition-all"
                      >
                        {/* Visual Thumbnail */}
                        {isImg && att.url ? (
                          <div
                            className="relative h-32 w-full bg-muted overflow-hidden cursor-pointer"
                            onClick={() => openLightbox(viewing, idx)}
                          >
                            <img
                              src={att.url}
                              alt={att.caption || att.name}
                              className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <span className="p-1.5 rounded-full bg-black/60 text-white backdrop-blur-xs">
                                <EyeIcon className="size-4" />
                              </span>
                            </div>
                            {att.size > 0 && (
                              <span className="absolute bottom-1.5 right-1.5 text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur-xs">
                                {formatFileSize(att.size)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div
                            className="h-28 w-full bg-muted/60 flex flex-col items-center justify-center p-3 text-center border-b border-border/60 cursor-pointer"
                            onClick={() => openLightbox(viewing, idx)}
                          >
                            <FileIcon className="size-7 text-muted-foreground mb-1" />
                            <span className="text-xs font-semibold text-foreground truncate max-w-[200px]">
                              {att.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              {formatFileSize(att.size)}
                            </span>
                          </div>
                        )}

                        {/* Caption and Admin Action Controls */}
                        <div className="p-2.5 flex-1 flex flex-col justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-foreground line-clamp-1">
                              {att.caption || att.name}
                            </p>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
                              <span className="truncate">{att.uploadedBy || viewing.authorName}</span>
                              {att.uploadedAt && <span>{timeLabel(att.uploadedAt)}</span>}
                            </div>
                          </div>

                          {/* Action Toolbar */}
                          <div className="flex items-center justify-between pt-1.5 border-t border-border/60">
                            <div className="flex items-center gap-1">
                              <IconButton
                                icon="eye"
                                ariaLabel="View photo details"
                                size="xs"
                                onClick={() => openLightbox(viewing, idx)}
                              />
                              {att.url && (
                                <a
                                  href={att.url}
                                  download={att.name || 'dsr-photo'}
                                  className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                  title="Download original"
                                >
                                  <DownloadIcon className="size-3.5" />
                                </a>
                              )}
                            </div>

                            {/* Admin & Author Controls (Delete Photo) */}
                            {(isAdmin || canChange(viewing)) && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openDeletePhoto(viewing, att)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer border border-rose-500/20 shadow-2xs"
                                  title={isAdmin ? "Admin: Delete this photo permanently" : "Delete photo"}
                                >
                                  <TrashIcon className="size-3 text-rose-500" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Entry Modal */}
      <Modal
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this entry?"
        subtitle="This entry will be permanently removed from the daily report."
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button variant="outline" size="sm" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-xs text-foreground font-medium">{deleting?.task}</p>
      </Modal>

      {/* Photo Lightbox Preview Modal */}
      <DsrPhotoLightboxModal
        isOpen={lightbox.isOpen}
        onClose={closeLightbox}
        attachments={lightbox.attachments}
        initialIndex={lightbox.initialIndex}
        canDelete={isAdmin || (lightbox.entry && canChange(lightbox.entry))}
        onDeletePhoto={(photo) => {
          if (lightbox.entry) {
            openDeletePhoto(lightbox.entry, photo);
          }
        }}
      />

      {/* Admin Delete Photo Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingPhoto)}
        title="Delete this photo?"
        message={`Are you sure you want to permanently delete "${deletingPhoto?.photo?.caption || deletingPhoto?.photo?.name || 'this photo'}" from ${deletingPhoto?.entry?.authorName || 'this'}'s DSR entry? This action cannot be undone.`}
        confirmText="Delete Photo"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={handleConfirmDeletePhoto}
        onCancel={() => setDeletingPhoto(null)}
      />

      {/* Hidden file input for table row quick upload */}
      <input
        ref={tableUploadInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.txt"
        multiple
        className="sr-only"
        onChange={(evt) => {
          if (selectedUploadTarget) {
            handleDirectPhotoUpload(evt, selectedUploadTarget);
            setSelectedUploadTarget(null);
          }
        }}
      />
    </div>
  );
}

export default DailyReportsPage;

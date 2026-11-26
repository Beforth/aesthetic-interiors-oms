import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { portalService } from '../services/portalService';
import { projectService } from '../services/projectService';
import { formatDate } from '../utils/formatters';
import { cn } from '../lib/utils';

import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Avatar from '../components/ui/Avatar';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { DsrPhotoLightboxModal } from '../components/dsr/DsrPhotoLightboxModal';

const PAGE_SIZE = 20;

const CATEGORIES = [
  { value: '', label: 'All work types' },
  { value: 'site visit', label: 'Site visit' },
  { value: 'design work', label: 'Design work' },
  { value: 'client meeting', label: 'Client meeting' },
  { value: 'review approval', label: 'Review & approval' },
  { value: 'planning', label: 'Planning' },
  { value: 'other', label: 'Other' },
];

const STATUSES = [
  { value: '', label: 'Any status' },
  { value: 'completed', label: 'Completed' },
  { value: 'in progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
];

const PERIODS = [
  { value: '', label: 'All time' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
];

const STATUS_BADGE = {
  completed: { label: 'Completed', variant: 'success' },
  'in progress': { label: 'In progress', variant: 'info' },
  blocked: { label: 'Blocked', variant: 'danger' },
};

const categoryLabel = (value) => CATEGORIES.find((c) => c.value === value)?.label || 'Other';

const isoDaysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
};

/** "Today", "Yesterday", or "Wednesday, 25 Nov 2026" for the heading above each day's reports. */
function dayHeading(iso) {
  if (iso === isoDaysAgo(0)) return 'Today';
  if (iso === isoDaysAgo(1)) return 'Yesterday';
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

function Report({ report, showProject, onOpenPhoto }) {
  const status = STATUS_BADGE[report.status] || STATUS_BADGE.completed;
  const photos = report.photos || [];
  return (
    <li className="flex gap-3">
      <Avatar name={report.by || 'Team'} size="md" />
      <div className="min-w-0 flex-1 rounded-xl border border-border bg-card p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{report.by || 'Site team'}</p>
            <p className="text-xs text-muted-foreground">
              {report.byRole || 'Team member'}
              {showProject ? ` · ${report.projectName}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline">{categoryLabel(report.category)}</Badge>
            <Badge variant={status.variant} dot>
              {status.label}
            </Badge>
          </div>
        </div>

        <p className="mt-3 text-sm font-medium text-foreground">{report.task}</p>
        {report.note ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{report.note}</p> : null}

        {photos.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => onOpenPhoto(photos, index)}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={photo.caption ? `Open photo: ${photo.caption}` : 'Open site photo'}
              >
                <img src={photo.url} alt={photo.caption || 'Site photo'} loading="lazy" className="size-full object-cover transition-transform duration-200 group-hover:scale-105" />
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * The client's "Site updates" tab: a feed of every report logged against their projects, by whoever is on the team
 * (the site supervisor, the workers, anyone associated with the project). It is a record to browse and filter, not a
 * second copy of the project screen (which shows the progress). Read-only.
 */
export function ClientUpdatesPage() {
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({ search: '', project: '', category: '', status: '', period: '' });
  const [search, setSearch] = useState('');
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState({ photos: [], index: 0 });

  useEffect(() => {
    projectService.getAllProjects().then((rows) => setProjects(rows || [])).catch(() => setProjects([]));
  }, []);

  // wait for the person to stop typing before searching
  useEffect(() => {
    const id = window.setTimeout(() => setFilters((f) => (f.search === search ? f : { ...f, search })), 350);
    return () => window.clearTimeout(id);
  }, [search]);

  const query = useMemo(
    () => ({
      pageSize: PAGE_SIZE,
      search: filters.search.trim(),
      project: filters.project,
      category: filters.category,
      status: filters.status,
      dateFrom: filters.period === 'week' ? isoDaysAgo(7) : filters.period === 'month' ? isoDaysAgo(30) : '',
    }),
    [filters]
  );

  const load = useCallback(
    async (nextPage = 1) => {
      if (nextPage === 1) setLoading(true);
      else setLoadingMore(true);
      setError('');
      try {
        const data = await portalService.getUpdates({ ...query, page: nextPage });
        setReports((current) => (nextPage === 1 ? data.results : [...current, ...data.results]));
        setTotal(data.count);
        setHasMore(Boolean(data.next));
        setPage(nextPage);
      } catch (err) {
        setError(err?.message || 'We could not load your site updates.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  // pick up a report the team has just submitted when the client comes back to this tab
  useEffect(() => {
    const onFocus = () => load(1);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const days = useMemo(() => {
    const groups = [];
    reports.forEach((report) => {
      const last = groups[groups.length - 1];
      if (last && last.date === report.date) last.items.push(report);
      else groups.push({ date: report.date, items: [report] });
    });
    return groups;
  }, [reports]);

  const lightboxItems = useMemo(
    () =>
      lightbox.photos.map((p) => ({ id: p.id, url: p.url, name: p.caption || 'Site photo', caption: p.caption, type: 'image/jpeg', isImage: true })),
    [lightbox.photos]
  );

  const filtered = Boolean(filters.search || filters.project || filters.category || filters.status || filters.period);
  const clear = () => {
    setSearch('');
    setFilters({ search: '', project: '', category: '', status: '', period: '' });
  };
  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-4 pb-16">
      <PageHeader
        title="Site updates"
        subtitle="Every report from the team working on your site"
        actions={
          <Button variant="outline" size="sm" leadingIcon="refresh" onClick={() => load(1)} disabled={loading}>
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={filtered ? 'Matching reports' : 'Reports'} icon="clipboard-list" value={total} />
        <StatCard label="Your sites" icon="briefcase" value={projects.length} />
        <StatCard label="Latest report" icon="calendar" value={reports.length ? formatDate(reports[0].date) : '—'} valueClassName="text-lg" />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <Input leadingIcon="search" placeholder="Search reports or people..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {projects.length > 1 && (
          <Select
            value={filters.project}
            onChange={set('project')}
            className="w-44"
            options={[{ value: '', label: 'All projects' }, ...projects.map((p) => ({ value: String(p.id), label: p.name }))]}
          />
        )}
        <Select value={filters.category} onChange={set('category')} className="w-40" options={CATEGORIES} />
        <Select value={filters.status} onChange={set('status')} className="w-36" options={STATUSES} />
        <Select value={filters.period} onChange={set('period')} className="w-36" options={PERIODS} />
        {filtered && (
          <Button variant="ghost" size="sm" onClick={clear}>
            Clear
          </Button>
        )}
      </div>

      {loading && reports.length === 0 ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : error ? (
        <EmptyState icon="warning" title="Site updates unavailable" description={error} />
      ) : reports.length === 0 ? (
        <EmptyState
          icon="clipboard-list"
          title={filtered ? 'No reports match these filters' : 'No site updates yet'}
          description={filtered ? 'Try clearing a filter.' : 'Reports appear here as soon as the team submits them for your site.'}
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Showing {reports.length} of {total} {total === 1 ? 'report' : 'reports'}
          </p>
          <div className="space-y-6">
            {days.map((day) => (
              <section key={day.date}>
                <h2 className={cn('mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground')}>
                  {dayHeading(day.date)}
                  <span className="ml-2 font-normal normal-case tracking-normal">{formatDate(day.date)}</span>
                </h2>
                <ul className="space-y-3">
                  {day.items.map((report) => (
                    <Report key={report.id} report={report} showProject={projects.length > 1} onOpenPhoto={(photos, index) => setLightbox({ photos, index })} />
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" loading={loadingMore} onClick={() => load(page + 1)}>
                Load older reports
              </Button>
            </div>
          )}
        </>
      )}

      <DsrPhotoLightboxModal isOpen={lightboxItems.length > 0} onClose={() => setLightbox({ photos: [], index: 0 })} attachments={lightboxItems} initialIndex={lightbox.index} />
    </div>
  );
}

export default ClientUpdatesPage;

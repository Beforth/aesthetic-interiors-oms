import React, { useMemo, useState } from 'react';
import Card from '../ui/Card';
import StatCard from '../ui/StatCard';
import StatusBadge from '../ui/StatusBadge';
import EmptyState from '../ui/EmptyState';
import Icon from '../ui/Icon';
import { Badge } from '../ui/badge';
import { DsrPhotoLightboxModal } from '../dsr/DsrPhotoLightboxModal';
import { formatDate } from '../../utils/formatters';

/** 'review approval' -> 'Review & Approval' */
function categoryLabel(value) {
  const text = String(value || 'other').toLowerCase();
  if (text === 'review approval') return 'Review & Approval';
  return text.replace(/\b\w/g, (c) => c.toUpperCase());
}

function ReportCard({ report, onOpenPhoto }) {
  const photos = report.photos || [];
  return (
    <li className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{report.task}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDate(report.date)}
            {report.by ? ` · ${report.by}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline">{categoryLabel(report.category)}</Badge>
          <StatusBadge status={report.status} size="sm" />
        </div>
      </div>

      {report.note ? <p className="text-sm text-muted-foreground leading-relaxed">{report.note}</p> : null}

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => onOpenPhoto(photos, index)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={photo.caption ? `Open photo: ${photo.caption}` : 'Open site photo'}
            >
              <img
                src={photo.url}
                alt={photo.caption || 'Site photo'}
                loading="lazy"
                className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

/**
 * The client's view of one project: how much work is done and the site reports staff submit.
 * Used both on the signed-in client screen and on the public share link, so it only draws what it is given
 * (the shape of `portalService` updates) and never fetches anything itself.
 */
export function ClientProjectUpdate({ data }) {
  const [lightbox, setLightbox] = useState({ photos: [], index: 0 });
  const { project, progress, updates = [], updateCount = 0, lastUpdateDate } = data;

  const lightboxItems = useMemo(
    () =>
      lightbox.photos.map((p) => ({
        id: p.id,
        url: p.url,
        name: p.caption || 'Site photo',
        caption: p.caption,
        type: 'image/jpeg',
        isImage: true,
      })),
    [lightbox.photos]
  );

  return (
    <div className="space-y-4">
      {/* How much is done, in the same figure cards as the dashboard */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Work completed" icon="check-circle" value={`${progress.percent}%`} progress={progress.percent} />
        <StatCard
          label="Stages done"
          icon="clipboard-list"
          value={`${progress.done} of ${progress.total}`}
          subtext={progress.inProgress > 0 ? `${progress.inProgress} in progress` : 'None in progress'}
        />
        <StatCard label="Target handover" icon="calendar" value={formatDate(project.targetDate)} valueClassName="text-lg" />
        <StatCard label="Last site update" icon="clock" value={lastUpdateDate ? formatDate(lastUpdateDate) : 'No updates yet'} valueClassName="text-lg" />
      </div>

      <Card title={project.name} subtitle={project.clientName || undefined} headerAction={<StatusBadge status={project.status} />}>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Started</dt>
            <dd className="font-medium text-foreground">{formatDate(project.startDate)}</dd>
          </div>
          {project.siteAddress ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Site</dt>
              <dd className="font-medium text-foreground">{project.siteAddress}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      {/* Site reports from the team */}
      <Card
        title="Site updates"
        subtitle="Daily reports from the team on site"
        headerAction={updateCount > 0 ? <span className="text-xs text-muted-foreground">{updateCount} total</span> : null}
      >
        {updates.length === 0 ? (
          <EmptyState
            icon="clipboard-list"
            title="No site updates yet"
            description="Reports will appear here as soon as the team submits them for your site."
            variant="bare"
          />
        ) : (
          <ul className="space-y-3">
            {updates.map((report) => (
              <ReportCard key={report.id} report={report} onOpenPhoto={(photos, index) => setLightbox({ photos, index })} />
            ))}
          </ul>
        )}
        {updateCount > updates.length ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon name="info" size={13} />
            Showing the {updates.length} most recent updates.
          </p>
        ) : null}
      </Card>

      <DsrPhotoLightboxModal
        isOpen={lightboxItems.length > 0}
        onClose={() => setLightbox({ photos: [], index: 0 })}
        attachments={lightboxItems}
        initialIndex={lightbox.index}
      />
    </div>
  );
}

export default ClientProjectUpdate;

import React from 'react';
import StatusBadge from '../ui/StatusBadge';
import Avatar from '../ui/Avatar';
import {
  TrashIcon,
  MapPinIcon,
  ArrowRightIcon,
  TriangleAlertIcon,
} from '../ui/icons';
import { formatCurrency } from '../../utils/formatters';
import { calculateProgress, hasLateStages } from '../../utils/progress';
import { cn } from '../../lib/utils';

/**
 * Domain card representing a Project entity with progress, kanban draggable support, late stage alerts, and deletion.
 *
 * @param {Object} props
 * @param {Object} props.project
 * @param {Array<Object>} [props.teamUsers=[]] - Resolved user objects for supervisors & workers
 * @param {function(): void} [props.onClick]
 * @param {boolean} [props.draggable=false]
 * @param {function(React.DragEvent): void} [props.onDragStart]
 * @param {function(React.DragEvent): void} [props.onDragEnd]
 * @param {boolean} [props.canAdvance=false]
 * @param {function(Object): void} [props.onAdvance]
 * @param {boolean} [props.canDelete=false]
 * @param {function(Object): void} [props.onDelete]
 */
export function ProjectCard({
  project,
  teamUsers = [],
  onClick,
  draggable = false,
  onDragStart,
  onDragEnd,
  canAdvance = false,
  onAdvance,
  canDelete = false,
  onDelete,
}) {
  const progress = calculateProgress(project.stages || []);
  const isDelayed = hasLateStages(project.stages || []);

  // Determine current active stage
  const currentStage =
    (project.stages || []).find((s) => s.status === 'in progress') ||
    (project.stages || []).find((s) => s.status === 'not started') ||
    project.stages?.[project.stages.length - 1];

  // Resolve team avatars
  const supervisorIds = project.supervisors || [];
  const workerIds = project.workers || [];
  const assignedTeam = teamUsers.filter(
    (u) => supervisorIds.includes(u.id) || workerIds.includes(u.id)
  );

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        'group relative flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all duration-200',
        'hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5',
        draggable ? 'cursor-grab active:cursor-grabbing' : onClick ? 'cursor-pointer' : ''
      )}
    >
      {/* Header: Title, Late Stage badge, Status badge & Delete button */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition-colors truncate">
                {project.name}
              </h4>
              {isDelayed && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30 shrink-0">
                  <TriangleAlertIcon className="size-3" />
                  <span>Late Stage</span>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Client: <span className="font-semibold text-foreground">{project.clientName}</span>
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge status={project.status || 'in progress'} size="sm" />
            {canDelete && onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(project);
                }}
                title="Delete project"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all cursor-pointer"
                aria-label={`Delete project ${project.name}`}
              >
                <TrashIcon className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Site Location Address */}
        <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5 truncate">
          <MapPinIcon className="size-3.5 text-primary shrink-0" />
          <span className="truncate">{project.siteAddress || 'No site address provided'}</span>
        </div>

        {/* Polished Progress Bar Container */}
        <div className="mb-4 bg-muted/30 rounded-lg p-2.5 border border-border/50">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[11px] font-medium text-muted-foreground truncate">
              Progress ({currentStage ? currentStage.name : 'Staging'})
            </span>
            <span className="text-xs font-bold font-mono text-foreground">{progress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                isDelayed ? 'bg-warning' : progress > 70 ? 'bg-success' : 'bg-primary'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer: Total Cost & Team Avatars / Advance button */}
      <div className="flex items-center justify-between border-t border-border/70 pt-3 text-xs mt-auto">
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total Cost
          </span>
          <span className="text-sm font-bold font-mono tracking-tight text-foreground">
            {formatCurrency(project.totalCost)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {assignedTeam.length > 0 ? (
            <div className="flex items-center -space-x-2 overflow-hidden py-0.5">
              {assignedTeam.slice(0, 4).map((member) => (
                <Avatar
                  key={member.id}
                  name={member.name}
                  size="sm"
                  className="ring-2 ring-card shadow-2xs"
                />
              ))}
              {assignedTeam.length > 4 && (
                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center ring-2 ring-card">
                  +{assignedTeam.length - 4}
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground italic text-[11px]">No team assigned</span>
          )}

          {canAdvance && onAdvance && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAdvance(project);
              }}
              title={`Advance status from "${project.status || 'in progress'}"`}
              className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 transition-all duration-150 cursor-pointer shrink-0"
            >
              <ArrowRightIcon className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectCard;

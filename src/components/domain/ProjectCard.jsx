import React from 'react';
import Card from '../ui/Card';
import ProgressBar from '../ui/ProgressBar';
import StatusBadge from '../ui/StatusBadge';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';
import { formatCurrency } from '../../utils/formatters';
import { calculateProgress, hasLateStages } from '../../utils/progress';

/**
 * Domain card representing a Project entity with progress, kanban draggable support, and late stage alerts.
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
    <Card
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`transition-all hover:border-brand-500 hover:shadow-sm ${
        draggable ? 'cursor-grab active:cursor-grabbing' : onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-bold text-text-main truncate">
              {project.name}
            </h4>
            {isDelayed && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-danger-light text-danger border border-danger/30">
                <Icon name="warning" size={11} />
                <span>Late Stage</span>
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted mt-0.5 truncate">
            Client: <span className="font-medium text-text-main">{project.clientName}</span>
          </p>
        </div>

        <StatusBadge status={project.status || 'in progress'} size="sm" />
      </div>

      <div className="text-xs text-text-muted mb-3 flex items-center gap-1.5 truncate">
        <Icon name="mapPin" size={13} className="text-brand-500 shrink-0" />
        <span className="truncate">{project.siteAddress}</span>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <ProgressBar
          value={progress}
          showLabel
          label={`Progress (${currentStage ? currentStage.name : 'Staging'})`}
          color={isDelayed ? 'warning' : progress > 70 ? 'success' : 'brand'}
        />
      </div>

      {/* Footer: Budget & Team Avatars */}
      <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
        <div>
          <span className="text-[11px] text-text-muted block">Total Cost</span>
          <span className="font-bold text-text-main">
            {formatCurrency(project.totalCost)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {assignedTeam.length > 0 ? (
            <div className="flex items-center -space-x-2 overflow-hidden">
              {assignedTeam.slice(0, 4).map((member) => (
                <Avatar
                  key={member.id}
                  name={member.name}
                  size="sm"
                  className="ring-2 ring-surface"
                />
              ))}
              {assignedTeam.length > 4 && (
                <span className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold flex items-center justify-center ring-2 ring-surface">
                  +{assignedTeam.length - 4}
                </span>
              )}
            </div>
          ) : (
            <span className="text-text-muted italic text-[11px]">No team assigned</span>
          )}

          {canAdvance && onAdvance && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAdvance(project);
              }}
              title={`Advance status from "${project.status || 'in progress'}"`}
              className="p-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 transition-colors cursor-pointer shrink-0"
            >
              <Icon name="arrow-right" size={13} />
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default ProjectCard;

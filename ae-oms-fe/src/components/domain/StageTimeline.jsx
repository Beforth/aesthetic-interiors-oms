import React from 'react';
import { formatDate } from '../../utils/formatters';
import { TODAY_STR, isStageLate } from '../../utils/progress';
import StatusBadge from '../ui/StatusBadge';

/**
 * Interactive Gantt-style timeline visualization for interior fit-out stages.
 * Renders horizontal duration bars on a date axis with a vertical 'Today' marker.
 *
 * @param {Object} props
 * @param {Array<Object>} props.stages - Array of project stages
 * @param {string} [props.today=TODAY_STR] - Today's date reference
 * @param {function(Object): void} [props.onStageClick]
 */
export function StageTimeline({ stages = [], today = TODAY_STR, onStageClick }) {
  if (!stages || stages.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-text-muted">
        No stages defined for this project.
      </div>
    );
  }

  // Calculate global start & end dates
  const timestamps = stages.flatMap((s) => [
    new Date(s.startDate).getTime(),
    new Date(s.endDate).getTime(),
  ]);

  const todayTime = new Date(today).getTime();
  timestamps.push(todayTime);

  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const totalDurationMs = Math.max(maxTime - minTime, 86400000 * 30); // at least 30 days

  // Today marker percentage
  const todayPercent = Math.min(
    Math.max(0, ((todayTime - minTime) / totalDurationMs) * 100),
    100
  );

  const getBarColor = (stage) => {
    if (stage.status === 'done' || stage.status === 'completed') {
      return 'bg-success text-surface border-success';
    }
    if (isStageLate(stage, today)) {
      return 'bg-danger text-surface border-danger';
    }
    if (stage.status === 'in progress' || stage.status === 'in-progress') {
      return 'bg-brand-500 text-surface border-brand-600';
    }
    return 'bg-brand-100 text-brand-700 border-border';
  };

  return (
    <div className="bg-surface border border-border rounded shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 overflow-hidden">
      {/* Legend & Today Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-border text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-semibold text-text-main">Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-success inline-block" />
            <span className="text-text-muted">Done</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-brand-500 inline-block" />
            <span className="text-text-muted">In Progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-danger inline-block" />
            <span className="text-text-muted">Late</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-brand-100 border border-border inline-block" />
            <span className="text-text-muted">Not Started</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-600 ring-2 ring-brand-100 animate-pulse" />
          <span className="font-bold text-brand-700">Today: {formatDate(today)}</span>
        </div>
      </div>

      {/* Horizontally scrollable timeline container */}
      <div className="overflow-x-auto">
        <div className="min-w-[850px] relative pb-4">
          {/* Timeline Date Header */}
          <div className="flex items-center justify-between text-[11px] font-mono text-text-muted pb-2 border-b border-border mb-3 select-none">
            <span className="w-64 font-sans font-semibold text-text-main text-xs uppercase tracking-wider">
              Stage & Agency Scope
            </span>
            <div className="flex-1 flex justify-between px-2">
              <span>{formatDate(new Date(minTime))}</span>
              <span>{formatDate(new Date(minTime + totalDurationMs * 0.33))}</span>
              <span>{formatDate(new Date(minTime + totalDurationMs * 0.66))}</span>
              <span>{formatDate(new Date(maxTime))}</span>
            </div>
          </div>

          {/* Vertical Today Marker spanning whole height */}
          <div
            className="absolute top-7 bottom-0 w-0.5 bg-brand-600 z-10 pointer-events-none flex flex-col items-center"
            style={{ left: `calc(16rem + (100% - 16rem) * ${todayPercent / 100})` }}
          >
            <div className="bg-brand-600 text-surface text-[10px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap -mt-2">
              Today
            </div>
            <div className="w-0.5 flex-1 bg-brand-600 border-l border-dashed border-surface" />
          </div>

          {/* Stage Rows */}
          <div className="space-y-2.5">
            {stages.map((stage) => {
              const startMs = new Date(stage.startDate).getTime();
              const endMs = new Date(stage.endDate).getTime();
              const durationDays = Math.max(
                1,
                Math.round((endMs - startMs) / (1000 * 60 * 60 * 24))
              );

              const leftPercent = Math.min(
                Math.max(0, ((startMs - minTime) / totalDurationMs) * 100),
                100
              );
              const widthPercent = Math.min(
                Math.max(2, ((endMs - startMs) / totalDurationMs) * 100),
                100 - leftPercent
              );

              const isLate = isStageLate(stage, today);

              return (
                <div
                  key={stage.id}
                  onClick={() => onStageClick && onStageClick(stage)}
                  className={`flex items-center group rounded p-1 transition-colors ${
                    onStageClick ? 'hover:bg-brand-50 cursor-pointer' : ''
                  }`}
                >
                  {/* Left Label: Stage, Order & Agency */}
                  <div className="w-64 shrink-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-brand-100 text-brand-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {stage.order}
                      </span>
                      <span className="text-xs font-bold text-text-main truncate">
                        {stage.name}
                      </span>
                      {isLate && (
                        <span className="text-[10px] font-bold px-1.5 rounded bg-danger-light text-danger shrink-0">
                          Late
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-text-muted truncate ml-7">
                      {stage.agencyName || 'Unallocated Agency'}
                    </div>
                  </div>

                  {/* Right Track: Bar with Duration & Dates */}
                  <div className="flex-1 relative h-8 bg-brand-50/50 rounded flex items-center px-1">
                    <div
                      className={`absolute h-6 rounded flex items-center px-2 text-[11px] font-semibold transition-all shadow-xs overflow-hidden select-none border ${getBarColor(
                        stage
                      )}`}
                      style={{
                        left: `${leftPercent}%`,
                        width: `${Math.max(widthPercent, 5)}%`,
                      }}
                      data-tooltip={`${stage.name} (${formatDate(stage.startDate)} - ${formatDate(
                        stage.endDate
                      )})`}
                    >
                      <span className="truncate">
                        {durationDays}d
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StageTimeline;

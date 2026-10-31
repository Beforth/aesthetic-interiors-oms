import React from 'react';
import { CheckIcon, SparkleIcon, BuildingIcon } from '../ui/icons';

/**
 * The three summary cards of the Daily Report for a site worker: the same plain white cards as before, with the
 * numbers and icons in the same colour as the "Add Work" button (the app's primary colour).
 */
export function WorkerDsrCards({ completed, inProgress, sites, total }) {
  const cards = [
    { label: 'Tasks Completed', value: completed, note: total > 0 ? `${Math.round((completed / total) * 100)}% done` : '0%', Icon: CheckIcon },
    { label: 'In Progress', value: inProgress, note: 'Active ongoing', Icon: SparkleIcon },
    { label: 'Active Sites', value: sites, note: 'Live projects', Icon: BuildingIcon },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {cards.map(({ label, value, note, Icon }) => (
        <div
          key={label}
          className="w-64 sm:w-72 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs hover:border-primary/40 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">{label}</span>
            <div className="size-6 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Icon className="size-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-primary tabular-nums">{value}</span>
            <span className="text-xs font-medium text-primary truncate">{note}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default WorkerDsrCards;

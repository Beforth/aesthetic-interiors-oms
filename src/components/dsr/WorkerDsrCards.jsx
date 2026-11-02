import React from 'react';
import { CheckIcon, ClockIcon, BuildingIcon } from '../ui/icons';

/**
 * The three summary cards of the Daily Report for a site worker:
 * Clean BefUI cards conforming strictly to the app design tokens and matching icons.
 */
export function WorkerDsrCards({ completed, inProgress, sites }) {
  const cards = [
    { label: 'Tasks Completed', value: completed, Icon: CheckIcon },
    { label: 'In Progress', value: inProgress, Icon: ClockIcon },
    { label: 'Active Sites', value: sites, Icon: BuildingIcon },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {cards.map(({ label, value, Icon }) => (
        <div
          key={label}
          className="w-64 sm:w-72 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs hover:border-primary/40 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">{label}</span>
            <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Icon className="size-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-primary tabular-nums">{value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default WorkerDsrCards;

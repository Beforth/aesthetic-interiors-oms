import React from 'react';
import { CheckIcon, SparkleIcon, BuildingIcon } from '../ui/icons';

/**
 * The three summary cards of the Daily Report for a site worker, in the app's dark brand colour (the same look as
 * the worker's Dashboard and Attendance highlight). Same numbers as the cards other roles see.
 */
export function WorkerDsrCards({ completed, inProgress, sites, total }) {
  const cards = [
    { label: 'Tasks Completed', value: completed, note: total > 0 ? `${Math.round((completed / total) * 100)}% done` : '0%', Icon: CheckIcon },
    { label: 'In Progress', value: inProgress, note: 'Active ongoing', Icon: SparkleIcon },
    { label: 'Active Sites', value: sites, note: 'Live projects', Icon: BuildingIcon },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
      {cards.map(({ label, value, note, Icon }) => (
        <div key={label} className="rounded-2xl bg-brand-900 text-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-200 truncate">{label}</span>
            <div className="size-7 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <Icon className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-3xl sm:text-4xl font-bold font-mono tabular-nums leading-none">{value}</span>
            <span className="text-xs font-medium text-brand-200 truncate">{note}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default WorkerDsrCards;

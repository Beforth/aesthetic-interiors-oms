import React from 'react';
import StatCard from '../ui/StatCard';
import { CheckIcon, ClockIcon, BuildingIcon } from '../ui/icons';

/** The three summary figures of the Daily Report, for every role. */
export function WorkerDsrCards({ completed, inProgress, sites }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard label="Tasks completed" value={completed} icon={<CheckIcon />} />
      <StatCard label="In progress" value={inProgress} icon={<ClockIcon />} />
      <StatCard label="Active sites" value={sites} icon={<BuildingIcon />} />
    </div>
  );
}

export default WorkerDsrCards;

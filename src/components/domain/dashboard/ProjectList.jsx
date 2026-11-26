import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../../ui/Card';
import { Avatar } from '../../ui/avatar';
import { ArrowRightIcon } from '../../ui/icons';
import { cn } from '../../../lib/utils';

const TONES = {
  neutral: { chip: 'bg-brand-50 text-primary', bar: 'surface-brand' },
  bad: { chip: 'bg-red-50 text-destructive', bar: 'bg-destructive' },
};

/**
 * Up to four projects with how far along each is, a chip for the date, and a link to the rest.
 * `projects`: [{ id, name, progress }]; `chip(project)` writes the date chip; `tone="bad"` is for late work.
 */
export function ProjectList({ title, projects, chip, empty, tone = 'neutral' }) {
  const colours = TONES[tone];

  return (
    <Card
      className="flex flex-col"
      bodyClassName="flex flex-1 flex-col"
      title={title}
      headerAction={<span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums', colours.chip)}>{projects.length}</span>}
    >
      {projects.length === 0 ? (
        <p className="m-auto py-6 text-center text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {projects.slice(0, 4).map((p) => (
            <li key={p.id}>
              <Link to={`/projects/${p.id}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted">
                <Avatar name={p.name} size="sm" className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-foreground">{p.name}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="h-1 max-w-32 flex-1 overflow-hidden rounded-full bg-border">
                      <span className={cn('block h-full rounded-full', colours.bar)} style={{ width: `${p.progress}%` }} />
                    </span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">{p.progress}% done</span>
                  </span>
                </span>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', colours.chip)}>{chip(p)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link to="/projects" className="mt-auto flex items-center justify-center gap-1 pt-3 text-xs font-semibold text-primary hover:underline">
        View all projects
        <ArrowRightIcon className="size-3" />
      </Link>
    </Card>
  );
}

export default ProjectList;

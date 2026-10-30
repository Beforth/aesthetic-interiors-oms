import * as React from 'react';
import { Avatar } from './avatar';
import { ArrowDownRightIcon, ArrowUpRightIcon } from './icons';
import { cn } from '../../lib/utils';
import { useChartIn } from './charts';

export interface LeaderboardItem {
  id?: string | number;
  name: string;
  value: number;
  /** Place change since the last period: positive moved up, negative moved down. */
  delta?: number;
  subtitle?: string;
  src?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const medal = [
  'bg-amber-500/15 text-amber-600 dark:text-amber-300 font-bold',
  'bg-slate-400/20 text-slate-600 dark:text-slate-300 font-bold',
  'bg-orange-500/15 text-orange-600 dark:text-orange-300 font-bold',
];

/**
 * Ranked list of people, teams, or projects with a bar behind each score.
 * Sorted descending. Bars fill in smoothly; the top three get gold, silver and bronze badges.
 */
export function Leaderboard({
  items,
  format = (n) => n.toLocaleString('en-IN'),
  limit,
  maxValue,
  className,
}: {
  items: LeaderboardItem[];
  format?: (n: number) => string;
  limit?: number;
  maxValue?: number;
  className?: string;
}) {
  const [ref, on] = useChartIn<HTMLOListElement>();
  const sorted = [...items].sort((a, b) => b.value - a.value).slice(0, limit);
  const max = maxValue || sorted[0]?.value || 1;

  return (
    <ol ref={ref} className={cn('grid gap-2.5', className)}>
      {sorted.map((it, i) => (
        <li
          key={it.id || `${it.name}-${i}`}
          onClick={it.onClick}
          className={cn(
            'relative flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-card px-3.5 py-3 shadow-2xs transition-all',
            it.onClick && 'cursor-pointer hover:border-indigo-400 hover:shadow-xs'
          )}
          onMouseEnter={it.onMouseEnter}
          onMouseLeave={it.onMouseLeave}
        >
          {/* Animated Background Progress Bar */}
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 bg-primary/10"
            style={{
              width: on ? `${Math.min(100, (it.value / max) * 100)}%` : 0,
              transition: `width 900ms cubic-bezier(0.22,1,0.36,1) ${i * 80}ms`,
            }}
          />

          {/* Rank Badge */}
          <span
            className={cn(
              'relative grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums',
              medal[i] ?? 'text-muted-foreground bg-slate-100'
            )}
          >
            {i + 1}
          </span>

          {/* Project / Entity Avatar */}
          <Avatar name={it.name} src={it.src} size="sm" className="relative shrink-0" />

          {/* Text Information */}
          <span className="relative grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-sm font-bold text-text-main">{it.name}</span>
            {it.subtitle && (
              <span className="truncate text-xs text-text-muted mt-0.5">{it.subtitle}</span>
            )}
          </span>

          {/* Delta / Milestone Indicator */}
          {it.delta !== undefined && it.delta !== 0 && (
            <span
              className={cn(
                'relative inline-flex items-center text-xs font-medium tabular-nums px-2 py-0.5 rounded-md shrink-0',
                it.delta > 0
                  ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                  : 'text-rose-700 bg-rose-50 border border-rose-200'
              )}
              aria-label={`${it.delta > 0 ? 'Up' : 'Down'} ${Math.abs(it.delta)}`}
            >
              {it.delta > 0 ? (
                <ArrowUpRightIcon className="size-3.5 mr-0.5" />
              ) : (
                <ArrowDownRightIcon className="size-3.5 mr-0.5" />
              )}
              {Math.abs(it.delta)}
            </span>
          )}

          {/* Metric Value */}
          <span onMouseEnter={it.onMouseEnter} onMouseLeave={it.onMouseLeave} className="relative text-sm font-bold text-indigo-700 tabular-nums shrink-0 px-1.5 py-0.5 rounded-md hover:bg-indigo-50 transition-colors" title="Hover to view in overall progress bar">
            {format(it.value)}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default Leaderboard;

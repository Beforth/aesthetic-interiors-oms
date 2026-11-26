'use client';

import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';
import { useStretch } from './motion-hooks';
import { cn } from '../../lib/utils';

function pages(page: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  if (page > 3) out.push('…');
  for (let p = Math.max(2, page - 1); p <= Math.min(total - 1, page + 1); p++) out.push(p);
  if (page < total - 2) out.push('…');
  out.push(total);
  return out;
}

const btn =
  'grid h-8 min-w-8 place-items-center rounded-md px-2 text-[13px] font-medium text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-40';

export function Pagination({
  page,
  pageCount,
  onPageChange,
  className,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const nav = React.useRef<HTMLElement>(null);
  const { edge, style } = useStretch(nav, (el) => el.querySelector<HTMLElement>('[aria-current="page"]'));
  return (
    <nav ref={nav} aria-label="Pagination" className={cn('relative flex items-center gap-1', className)}>
      {edge && <span aria-hidden className="pointer-events-none absolute motion-reduce:!transition-none rounded-md bg-primary" style={{ ...style, top: edge.top, height: edge.height }} />}
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
        <ChevronLeftIcon className="size-4" />
      </button>
      {pages(page, pageCount).map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-1 text-muted-foreground">
            …
          </span>
        ) : (
          <button type="button"
            key={p}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onPageChange(p)}
            className={cn(btn, 'relative', p === page && (edge ? 'text-primary-foreground hover:bg-transparent hover:text-primary-foreground' : 'bg-secondary text-foreground'))}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" className={btn} disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} aria-label="Next page">
        <ChevronRightIcon className="size-4" />
      </button>
    </nav>
  );
}

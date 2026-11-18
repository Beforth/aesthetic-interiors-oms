import React from 'react';
import SearchInput from './SearchInput';
import { cn } from '../../lib/utils';

/**
 * Standard data filter & action toolbar used above tables and grid views.
 *
 * variant="default" — bordered surface with a subtle shadow.
 * variant="clean"   — open toolbar with no surrounding box. The search keeps
 *                     its own outline so it stays visible, but never sits
 *                     nested inside another bordered container.
 *
 * layout="auto"     — wraps controls responsively (default).
 * layout="inline"   — keeps search and every filter on one aligned line with
 *                     horizontal scrolling on narrow screens.
 */
export function DataToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  searchVariant,
  filters,
  actions,
  totalCount,
  variant = 'default',
  layout = 'auto',
  className = '',
}) {
  const isClean = variant === 'clean';
  const isInline = layout === 'inline';
  const searchMode = searchVariant || 'default';

  return (
    <div
      className={cn(
        isInline
          ? 'flex flex-row items-center gap-3 overflow-x-auto pb-1'
          : 'flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3',
        isClean
          ? 'bg-transparent py-2'
          : 'bg-surface border border-border rounded p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
        className
      )}
    >
      <div
        className={cn(
          isInline
            ? 'flex flex-row items-center gap-3 shrink-0'
            : 'flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 min-w-0'
        )}
      >
        {onSearchChange && (
          <div
            className={cn(
              'shrink-0',
              isInline ? 'w-64' : 'w-full',
              !isInline && (isClean ? 'sm:max-w-sm' : 'sm:max-w-xs')
            )}
          >
            <SearchInput
              value={searchValue}
              onChange={(e) =>
                typeof onSearchChange === 'function' &&
                onSearchChange(e.target.value)
              }
              placeholder={searchPlaceholder}
              variant={searchMode}
            />
          </div>
        )}

        {filters && (
          <div className={cn('flex items-center gap-2', isInline ? 'shrink-0 flex-nowrap' : 'flex-wrap')}>
            {filters}
          </div>
        )}

        {totalCount !== undefined && (
          <span className="hidden lg:inline-flex text-xs text-muted-foreground font-medium whitespace-nowrap">
            ({totalCount} {totalCount === 1 ? 'record' : 'records'})
          </span>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export default DataToolbar;

import React from 'react';
import Icon from './Icon';
import Select from './Select';

/** Standard page sizes shared by every data list in the app. */
export const PAGE_SIZE_OPTIONS = [10, 25, 30];

/**
 * befui Pagination component conforming to https://befui.vercel.app/
 *
 * Pass `onPageSizeChange` to show the shared 10 / 25 / 30 rows-per-page control.
 */
export function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalItems,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  className = '',
}) {
  if (totalPages <= 1 && !totalItems) return null;

  const effectivePageSize = pageSize || 10;
  const startItem = (currentPage - 1) * effectivePageSize + 1;
  const endItem = Math.min(
    currentPage * effectivePageSize,
    totalItems || currentPage * effectivePageSize
  );

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground ${className}`}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
        {totalItems ? (
          <span>
            {startItem}–{endItem} of{' '}
            <strong className="font-semibold text-text-main">{totalItems}</strong>
          </span>
        ) : (
          <span>
            {currentPage} / <strong className="font-semibold text-text-main">{totalPages}</strong>
          </span>
        )}

        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 whitespace-nowrap">
            Rows
            <span className="w-20">
              <Select
                aria-label="Rows per page"
                value={effectivePageSize}
                onChange={(event) => onPageSizeChange(Number(event.target.value))}
                options={PAGE_SIZE_OPTIONS.map((size) => ({
                  value: size,
                  label: String(size),
                }))}
                placeholder=""
                className="text-xs"
              />
            </span>
          </label>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          className="size-8 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed text-text-main transition-colors flex items-center justify-center shadow-xs cursor-pointer"
        >
          <Icon name="chevronLeft" size={14} />
        </button>

        <span className="px-2 py-1 font-mono font-medium text-text-main select-none">
          {currentPage} / {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
          className="size-8 rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed text-text-main transition-colors flex items-center justify-center shadow-xs cursor-pointer"
        >
          <Icon name="chevronRight" size={14} />
        </button>
      </div>
    </div>
  );
}

export default Pagination;

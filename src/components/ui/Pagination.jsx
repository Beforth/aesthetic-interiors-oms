import React from 'react';
import Icon from './Icon';

/**
 * befui Pagination component conforming to https://befui.vercel.app/
 */
export function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalItems,
  pageSize,
  onPageChange,
  className = '',
}) {
  if (totalPages <= 1 && !totalItems) return null;

  const startItem = (currentPage - 1) * (pageSize || 10) + 1;
  const endItem = Math.min(currentPage * (pageSize || 10), totalItems || currentPage * (pageSize || 10));

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground ${className}`}
    >
      <div>
        {totalItems ? (
          <span>
            {startItem}–{endItem} of <strong className="font-semibold text-text-main">{totalItems}</strong>
          </span>
        ) : (
          <span>
            {currentPage} / <strong className="font-semibold text-text-main">{totalPages}</strong>
          </span>
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

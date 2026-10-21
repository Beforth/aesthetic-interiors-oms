import React from 'react';
import Icon from './Icon';

/**
 * Accessible table pagination component.
 *
 * @param {Object} props
 * @param {number} props.currentPage - Current active page (1-based)
 * @param {number} props.totalPages - Total number of pages
 * @param {number} [props.totalItems] - Total row count across all pages
 * @param {number} [props.pageSize] - Rows per page
 * @param {function(number): void} props.onPageChange - Handler called on page click
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
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border bg-surface text-xs text-text-muted ${className}`}
    >
      <div>
        {totalItems ? (
          <span>
            Showing <strong className="font-semibold text-text-main">{startItem}</strong> to{' '}
            <strong className="font-semibold text-text-main">{endItem}</strong> of{' '}
            <strong className="font-semibold text-text-main">{totalItems}</strong> entries
          </span>
        ) : (
          <span>
            Page <strong className="font-semibold text-text-main">{currentPage}</strong> of{' '}
            <strong className="font-semibold text-text-main">{totalPages}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          className="p-1.5 rounded border border-border bg-surface hover:bg-brand-50 disabled:opacity-40 disabled:cursor-not-allowed text-text-main transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
        >
          <Icon name="chevron-left" size={16} />
        </button>

        <span className="px-2 py-1 font-medium text-text-main select-none">
          {currentPage} / {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
          className="p-1.5 rounded border border-border bg-surface hover:bg-brand-50 disabled:opacity-40 disabled:cursor-not-allowed text-text-main transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </div>
    </div>
  );
}

export default Pagination;

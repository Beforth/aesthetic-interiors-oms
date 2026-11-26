import React from 'react';
import { Pagination as PageButtons } from './befui-pagination';
import Select from './Select';

/** Standard page sizes shared by every data list in the app. */
export const PAGE_SIZE_OPTIONS = [10, 25, 30];

/**
 * The footer of every paged list: how many rows are shown and the rows-per-page control, beside BefUI's page buttons
 * (https://befui.vercel.app/#/components/pagination).
 *
 * Pass `onPageSizeChange` to show the 10 / 25 / 30 rows-per-page control.
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

      <PageButtons page={currentPage} pageCount={Math.max(1, totalPages)} onPageChange={onPageChange} />
    </div>
  );
}

export default Pagination;

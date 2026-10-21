import React from 'react';
import EmptyState from './EmptyState';
import Skeleton from './Skeleton';
import Pagination from './Pagination';

/**
 * Robust, accessible Table component with columns configuration, loading skeletons,
 * empty state, and integrated pagination.
 *
 * @param {Object} props
 * @param {Array<{key: string, header: string|React.ReactNode, render?: function, width?: string, align?: 'left'|'center'|'right', className?: string}>} props.columns
 * @param {Array<Object>} props.data
 * @param {string} [props.keyField='id']
 * @param {function(Object): void} [props.onRowClick]
 * @param {boolean} [props.loading=false]
 * @param {string} [props.emptyTitle='No data available']
 * @param {string} [props.emptyDescription]
 * @param {Object} [props.pagination] - Pagination props
 * @param {string} [props.className]
 */
export function Table({
  columns = [],
  data = [],
  keyField = 'id',
  onRowClick,
  loading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no entries to display at this moment.',
  pagination,
  className = '',
}) {
  return (
    <div className={`w-full bg-surface border border-border rounded overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-brand-50">
              {columns.map((col, idx) => (
                <th
                  key={col.key || idx}
                  style={{ width: col.width }}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted select-none
                    ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}
                    ${col.className || ''}
                  `}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {loading ? (
              // Skeletons during loading state
              Array.from({ length: 5 }).map((_, rIdx) => (
                <tr key={`loading-row-${rIdx}`} className="bg-surface">
                  {columns.map((col, cIdx) => (
                    <td key={`loading-cell-${cIdx}`} className="px-4 py-3">
                      <Skeleton variant="text" width={col.width || '80%'} height={16} />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={columns.length} className="p-8">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                  />
                </td>
              </tr>
            ) : (
              // Data Rows
              data.map((row, rIdx) => {
                const rowKey = row[keyField] || rIdx;
                const isClickable = !!onRowClick;

                return (
                  <tr
                    key={rowKey}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`bg-surface transition-colors
                      ${isClickable ? 'cursor-pointer hover:bg-brand-100/60' : 'hover:bg-brand-50/60'}
                    `}
                  >
                    {columns.map((col, cIdx) => {
                      const cellValue = row[col.key];
                      const rendered = col.render ? col.render(row, rIdx) : cellValue;

                      return (
                        <td
                          key={col.key || cIdx}
                          className={`px-4 py-3 text-text-main align-middle
                            ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}
                            ${col.className || ''}
                          `}
                        >
                          {rendered ?? '-'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && !loading && data.length > 0 && (
        <Pagination {...pagination} />
      )}
    </div>
  );
}

export default Table;

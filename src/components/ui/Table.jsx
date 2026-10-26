import React from 'react';
import EmptyState from './EmptyState';
import Skeleton from './Skeleton';
import Pagination from './Pagination';

/**
 * Renders a table cell using the column's render function or raw property value.
 * Supports row-first signature (render(row, val, rIdx)) as well as val-first fallback,
 * ensuring no unhandled TypeError can crash the table.
 */
function renderTableCell(col, row, rIdx) {
  if (!col.render) {
    const val = col.key ? row?.[col.key] : undefined;
    return val !== undefined && val !== null ? val : '—';
  }
  if (typeof col.render !== 'function') {
    return col.render;
  }
  const cellVal = col.key ? row?.[col.key] : undefined;
  try {
    // 1. Standard BefUI signature: render(row, cellVal, rIdx)
    return col.render(row, cellVal, rIdx);
  } catch (err1) {
    try {
      // 2. Alternative signature: render(cellVal, row, rIdx)
      return col.render(cellVal, row, rIdx);
    } catch (err2) {
      console.error('Table cell render error for col:', col.key, err2);
      return cellVal !== undefined && cellVal !== null ? cellVal : '—';
    }
  }
}

/**
 * BefUI Table component conforming to https://befui.vercel.app/
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
    <div className={`w-full rounded-xl border border-border overflow-hidden bg-card text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.03)] ${className}`}>
      <div className="relative w-full overflow-x-auto">
        <table className="w-full text-left border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-xs border-b border-border/80">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={col.key || idx}
                  style={{ width: col.width }}
                  className={`h-9 whitespace-nowrap px-4 text-left align-middle text-[11px] font-medium uppercase tracking-wider text-muted-foreground select-none
                    ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}
                    ${col.className || ''}
                  `}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {loading ? (
              Array.from({ length: 4 }).map((_, rIdx) => (
                <tr key={`skel-${rIdx}`} className="border-b border-border/60">
                  {columns.map((_, cIdx) => (
                    <td key={`skel-c-${cIdx}`} className="px-4 py-3">
                      <Skeleton className="h-4 w-3/4 rounded-md" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              data.map((row, rIdx) => (
                <tr
                  key={row[keyField] || rIdx}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-border/60 transition-colors hover:bg-muted/70 ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((col, cIdx) => (
                    <td
                      key={col.key || cIdx}
                      className={`px-4 py-3 align-middle text-[13px] ${
                        col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                      } ${col.cellClassName || ''}`}
                    >
                      {renderTableCell(col, row, rIdx)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && !loading && data.length > 0 && (
        <div className="border-t border-border/70 p-3 bg-muted/10">
          <Pagination {...pagination} />
        </div>
      )}
    </div>
  );
}

export default Table;

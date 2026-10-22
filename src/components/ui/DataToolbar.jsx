import React from 'react';
import SearchInput from './SearchInput';

/**
 * Standard data filter & action toolbar used above tables and grid views.
 *
 * @param {Object} props
 * @param {string} [props.searchValue]
 * @param {function(string|object): void} [props.onSearchChange]
 * @param {string} [props.searchPlaceholder='Search records...']
 * @param {React.ReactNode} [props.filters] - Filter dropdowns or toggle buttons
 * @param {React.ReactNode} [props.actions] - Action buttons (Create, Import, Export)
 * @param {number} [props.totalCount] - Optional total item count badge
 * @param {string} [props.className]
 */
export function DataToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  filters,
  actions,
  totalCount,
  className = '',
}) {
  return (
    <div
      className={`bg-surface border border-border rounded p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
        {onSearchChange && (
          <div className="w-full sm:max-w-xs shrink-0">
            <SearchInput
              value={searchValue}
              onChange={(e) =>
                typeof onSearchChange === 'function' &&
                onSearchChange(e.target.value)
              }
              placeholder={searchPlaceholder}
            />
          </div>
        )}

        {filters && (
          <div className="flex items-center gap-2 flex-wrap">
            {filters}
          </div>
        )}

        {totalCount !== undefined && (
          <span className="hidden lg:inline-flex text-xs text-text-muted font-medium ml-2">
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

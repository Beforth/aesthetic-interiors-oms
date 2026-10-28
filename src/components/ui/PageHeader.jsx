import React from 'react';
import Breadcrumbs from './Breadcrumbs';

/**
 * Standard page header with title, subtitle, breadcrumb, and call-to-action buttons.
 *
 * @param {Object} props
 * @param {string} props.title - Page title
 * @param {string} [props.subtitle] - Explanatory subtitle
 * @param {Array<{label: string, path?: string}>} [props.breadcrumbs]
 * @param {React.ReactNode} [props.actions] - Action buttons
 * @param {string} [props.className]
 */
export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  className = '',
}) {
  // Defensively filter out redundant 'Operations' or 'HRMS' breadcrumb root across any screen
  const visibleBreadcrumbs = breadcrumbs?.filter(
    (b) =>
      b?.label &&
      b.label.toLowerCase() !== 'operations' &&
      b.label.toLowerCase() !== 'hrms'
  );

  return (
    <div className={`flex flex-col gap-2 mb-4 sm:mb-6 ${className}`}>
      {visibleBreadcrumbs && visibleBreadcrumbs.length > 0 && (
        <Breadcrumbs items={visibleBreadcrumbs} className="mb-1" />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default PageHeader;

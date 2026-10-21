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
  return (
    <div className={`flex flex-col gap-2 mb-6 ${className}`}>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} className="mb-1" />}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-main tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-text-muted mt-0.5">
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

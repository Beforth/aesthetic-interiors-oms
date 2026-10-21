import React from 'react';

/**
 * Clean card container conforming to design system tokens (white surface, 1px border, 6px radius).
 *
 * @param {Object} props
 * @param {string} [props.title]
 * @param {string} [props.subtitle]
 * @param {React.ReactNode} [props.headerAction]
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
export function Card({
  title,
  subtitle,
  headerAction,
  children,
  className = '',
  ...rest
}) {
  const hasHeader = title || subtitle || headerAction;

  return (
    <div
      className={`bg-surface border border-border rounded shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden ${className}`}
      {...rest}
    >
      {hasHeader && (
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-4">
          <div>
            {title && <h3 className="text-base font-semibold text-text-main leading-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export default Card;

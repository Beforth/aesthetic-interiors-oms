import React from 'react';
import Icon from './Icon';

/**
 * Reusable empty state view for tables, lists, and empty screens.
 *
 * @param {Object} props
 * @param {string} [props.icon='folder']
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {React.ReactNode} [props.action]
 * @param {string} [props.className]
 */
export function EmptyState({
  icon = 'folder',
  title = 'No items found',
  description,
  action,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded bg-surface/60 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center mb-3">
        <Icon name={icon} size={24} />
      </div>
      <h4 className="text-sm font-semibold text-text-main">{title}</h4>
      {description && (
        <p className="text-xs text-text-muted mt-1 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default EmptyState;

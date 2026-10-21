import React from 'react';
import Icon from './Icon';

/**
 * Standard inline Alert banner conforming to status design tokens.
 *
 * @param {Object} props
 * @param {'info'|'success'|'warning'|'danger'} [props.type='info']
 * @param {string} [props.title]
 * @param {React.ReactNode} props.children
 * @param {function(): void} [props.onDismiss]
 * @param {React.ReactNode} [props.action]
 * @param {string} [props.className]
 */
export function Alert({
  type = 'info',
  title,
  children,
  onDismiss,
  action,
  className = '',
}) {
  const typeMap = {
    info: {
      container: 'bg-info-light border-info/30 text-text-main',
      iconColor: 'text-info',
      iconName: 'info',
    },
    success: {
      container: 'bg-success-light border-success/30 text-text-main',
      iconColor: 'text-success',
      iconName: 'success',
    },
    warning: {
      container: 'bg-warning-light border-warning/30 text-text-main',
      iconColor: 'text-warning',
      iconName: 'warning',
    },
    danger: {
      container: 'bg-danger-light border-danger/30 text-text-main',
      iconColor: 'text-danger',
      iconName: 'danger',
    },
  };

  const current = typeMap[type] || typeMap.info;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-3.5 rounded border ${current.container} ${className}`}
    >
      <div className={`mt-0.5 shrink-0 ${current.iconColor}`}>
        <Icon name={current.iconName} size={18} />
      </div>

      <div className="flex-1 text-xs leading-relaxed">
        {title && <h5 className="font-semibold text-text-main mb-0.5">{title}</h5>}
        <div>{children}</div>
        {action && <div className="mt-2">{action}</div>}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-text-muted hover:text-text-main p-1 rounded transition-colors -mr-1 -mt-1"
          aria-label="Dismiss alert"
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}

export default Alert;

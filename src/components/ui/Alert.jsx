import React from 'react';
import Icon from './Icon';

/**
 * befui Alert component conforming to https://befui.vercel.app/
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
      container: 'border-blue-200 bg-blue-50/70 text-blue-900',
      iconColor: 'text-blue-600',
      iconName: 'info',
    },
    success: {
      container: 'border-success/20 bg-success/10 text-emerald-900',
      iconColor: 'text-success',
      iconName: 'success',
    },
    warning: {
      container: 'border-warning/25 bg-warning/10 text-amber-900',
      iconColor: 'text-warning',
      iconName: 'warning',
    },
    danger: {
      container: 'border-destructive/20 bg-destructive/10 text-rose-900',
      iconColor: 'text-destructive',
      iconName: 'danger',
    },
  };

  const current = typeMap[type] || typeMap.info;

  return (
    <div
      role="alert"
      className={`rounded-xl border p-4 flex items-start gap-3 text-sm ${current.container} ${className}`}
    >
      <div className={`shrink-0 mt-0.5 ${current.iconColor}`}>
        <Icon name={current.iconName} size={18} />
      </div>

      <div className="flex-1 min-w-0">
        {title && <h5 className="font-semibold leading-none tracking-tight mb-1">{title}</h5>}
        <div className="text-xs leading-relaxed opacity-90">{children}</div>
      </div>

      {action && <div className="shrink-0">{action}</div>}

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 opacity-70 hover:opacity-100 transition-opacity p-0.5 cursor-pointer"
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}

export default Alert;

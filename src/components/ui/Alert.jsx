import React from 'react';
import Icon from './Icon';
import { Alert as BefAlert } from './befui-alert';

/** BefUI's alert (https://befui.vercel.app/#/components/alert), with an optional action and close button. */
export function Alert({ type = 'info', title, children, onDismiss, action, className = '' }) {
  const variant = ['info', 'success', 'warning', 'danger'].includes(type) ? type : 'info';
  const hasControls = Boolean(action || onDismiss);

  return (
    <div className={`relative ${className}`}>
      <BefAlert variant={variant} title={title} className={hasControls ? 'pr-24' : undefined}>
        {children}
      </BefAlert>
      {hasControls && (
        <div className="absolute right-3 top-3 flex items-center gap-2">
          {action}
          {onDismiss && (
            <button type="button" onClick={onDismiss} aria-label="Dismiss" className="cursor-pointer p-0.5 text-muted-foreground transition-colors hover:text-foreground">
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default Alert;

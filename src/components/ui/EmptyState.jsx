import React from 'react';
import Icon from './Icon';

/**
 * befui EmptyState component conforming to https://befui.vercel.app/
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
      className={`flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-xl bg-card/40 ${className}`}
    >
      <div className="w-10 h-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center mb-3">
        <Icon name={icon} size={20} />
      </div>
      <h4 className="text-sm font-semibold tracking-tight text-text-main">{title}</h4>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default EmptyState;

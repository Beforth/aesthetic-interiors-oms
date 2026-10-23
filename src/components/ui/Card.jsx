import React from 'react';

/**
 * befui Card component conforming to https://befui.vercel.app/
 * (Radix + Tailwind CSS variables design system)
 */
export const Card = React.forwardRef(function Card(
  {
    title,
    subtitle,
    headerAction,
    children,
    className = '',
    hoverable = false,
    ...rest
  },
  ref
) {
  const hasHeader = title || subtitle || headerAction;

  return (
    <div
      ref={ref}
      className={`rounded-xl border border-border bg-card text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.03)] overflow-hidden ${
        hoverable ? 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md' : ''
      } ${className}`}
      {...rest}
    >
      {hasHeader && (
        <div className="px-5 py-3.5 border-b border-border/80 flex items-center justify-between gap-4 bg-muted/20">
          <div>
            {title && <h3 className="text-sm font-semibold tracking-tight text-text-main leading-tight">{title}</h3>}
            {subtitle && <p className="text-[13px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
});

Card.displayName = 'Card';
export default Card;

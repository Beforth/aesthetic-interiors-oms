import React, { useState } from 'react';

/**
 * Lightweight accessible tooltip with hover and keyboard focus detection.
 *
 * @param {Object} props
 * @param {string} props.content - Tooltip text
 * @param {'top'|'bottom'|'left'|'right'} [props.placement='top']
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
export function Tooltip({
  content,
  placement = 'top',
  children,
  className = '',
}) {
  const [isVisible, setIsVisible] = useState(false);

  if (!content) return children;

  const placementClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className={`absolute z-40 px-2 py-1 text-[11px] font-medium text-popover-foreground bg-popover rounded-md border border-border shadow-md whitespace-nowrap pointer-events-none animate-in fade-in duration-100 ${
            placementClasses[placement] || placementClasses.top
          }`}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export default Tooltip;

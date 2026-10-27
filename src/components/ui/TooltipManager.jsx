import React, { useState, useEffect } from 'react';

/**
 * Delegated Tooltip Manager conforming to Standard 5.
 * Driven exclusively by elements carrying the [data-tooltip] attribute.
 * Single listener at the root level, zero overhead per icon/button.
 */
export function TooltipManager() {
  const [tooltipState, setTooltipState] = useState({
    visible: false,
    text: '',
    x: 0,
    y: 0,
    placement: 'top',
  });

  useEffect(() => {
    let activeElement = null;

    const showTooltip = (el) => {
      if (!el) return;
      const text = el.getAttribute('data-tooltip');
      if (!text || !text.trim()) return;

      activeElement = el;
      const rect = el.getBoundingClientRect();
      const margin = 6;

      // Determine placement based on viewport boundaries
      let placement = 'top';
      let x = rect.left + rect.width / 2;
      let y = rect.top - margin;

      if (rect.top < 36) {
        placement = 'bottom';
        y = rect.bottom + margin;
      }

      setTooltipState({
        visible: true,
        text,
        x,
        y,
        placement,
      });
    };

    const hideTooltip = (el) => {
      if (!activeElement || (el && activeElement !== el)) return;
      activeElement = null;
      setTooltipState((prev) => ({ ...prev, visible: false }));
    };

    const handleMouseOver = (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target) {
        showTooltip(target);
      }
    };

    const handleMouseOut = (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target) {
        hideTooltip(target);
      }
    };

    const handleFocusIn = (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target) {
        showTooltip(target);
      }
    };

    const handleFocusOut = (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target) {
        hideTooltip(target);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        hideTooltip();
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!tooltipState.visible || !tooltipState.text) return null;

  return (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: `${tooltipState.x}px`,
        top: `${tooltipState.y}px`,
        transform:
          tooltipState.placement === 'top'
            ? 'translate(-50%, -100%)'
            : 'translate(-50%, 0)',
      }}
      className="z-50 px-2 py-1 text-[11px] font-medium text-popover-foreground bg-popover border border-border rounded-md shadow-md pointer-events-none whitespace-nowrap transition-opacity animate-in fade-in duration-100"
    >
      {tooltipState.text}
    </div>
  );
}

export default TooltipManager;

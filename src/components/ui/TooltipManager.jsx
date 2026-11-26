import React, { useState, useEffect, useRef } from 'react';

/**
 * Universal Delegated Tooltip Manager conforming to BefUI standards.
 * Intercepts [data-tooltip], [title], and [aria-label] across the entire application.
 * Suppresses the browser's own tooltips and shows BefUI's tooltip design everywhere in the project.
 */
export function TooltipManager() {
  const [tooltipState, setTooltipState] = useState({
    visible: false,
    text: '',
    x: 0,
    y: 0,
    placement: 'top',
  });

  const activeElementRef = useRef(null);

  useEffect(() => {
    const showTooltip = (el) => {
      if (!el) return;

      // Explicit opt-out for controls that should not show a tooltip
      if (el.hasAttribute('data-no-tooltip')) return;

      // Sidebar collapsed items have their own inline dedicated rail tooltip
      if (el.closest('.group\\/sidebar-item')) return;

      let text = el.getAttribute('data-tooltip');

      // Strip native title to avoid native browser tooltip duplication
      if (el.hasAttribute('title')) {
        const titleText = el.getAttribute('title') || '';
        if (titleText.trim()) {
          text = titleText.trim();
          el.removeAttribute('title');
          el.setAttribute('data-tooltip', text);
        }
      }

      // If still no text, check aria-label on interactive elements (buttons, links, icon buttons)
      if (!text && (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button')) {
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.trim()) {
          // Avoid duplicating if the button already has visible text matching aria-label
          const innerText = el.innerText?.trim() || '';
          if (!innerText || innerText !== ariaLabel.trim()) {
            text = ariaLabel.trim();
            el.setAttribute('data-tooltip', text);
          }
        }
      }

      if (!text || !text.trim()) return;

      activeElementRef.current = el;
      const rect = el.getBoundingClientRect();
      const margin = 8;

      let placement = 'top';
      let x = rect.left + rect.width / 2;
      let y = rect.top - margin;

      // If near the top edge of screen, flip to bottom
      if (rect.top < 38) {
        placement = 'bottom';
        y = rect.bottom + margin;
      }

      // Clamp X position so tooltip never clips off-screen edges
      const estimatedHalfWidth = Math.min(120, text.length * 4.5);
      if (x - estimatedHalfWidth < 12) {
        x = estimatedHalfWidth + 12;
      } else if (x + estimatedHalfWidth > window.innerWidth - 12) {
        x = window.innerWidth - estimatedHalfWidth - 12;
      }

      setTooltipState({
        visible: true,
        text,
        x,
        y,
        placement,
      });
    };

    const hideTooltip = () => {
      activeElementRef.current = null;
      setTooltipState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    };

    const handleMouseOver = (e) => {
      const target = e.target.closest('[data-tooltip], [title], button[aria-label], a[aria-label], [role="button"][aria-label]');
      if (target) {
        showTooltip(target);
      }
    };

    const handleMouseOut = (e) => {
      const target = e.target.closest('[data-tooltip], [title], button[aria-label], a[aria-label], [role="button"][aria-label]');
      if (target && activeElementRef.current === target) {
        hideTooltip();
      }
    };

    const handleFocusIn = (e) => {
      // Only keyboard focus shows a tooltip. Focus that arrives from a click or from a page opening
      // (the browser or a modal moving focus) would otherwise leave a tooltip stuck on screen.
      if (!e.target.matches?.(':focus-visible')) return;
      const target = e.target.closest('[data-tooltip], [title], button[aria-label], a[aria-label], [role="button"][aria-label]');
      if (target) {
        showTooltip(target);
      }
    };

    // Clicking acts on the element, so its hint is no longer needed (and the page may change under it).
    const handlePointerDown = () => hideTooltip();

    // Drop the tooltip when the element it points at leaves the page (navigation, closed popover).
    const observer = new MutationObserver(() => {
      const active = activeElementRef.current;
      if (active && !active.isConnected) hideTooltip();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const handleFocusOut = () => {
      hideTooltip();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        hideTooltip();
      }
    };

    const handleScroll = () => {
      hideTooltip();
    };

    document.addEventListener('mouseover', handleMouseOver, { passive: true });
    document.addEventListener('mouseout', handleMouseOut, { passive: true });
    document.addEventListener('focusin', handleFocusIn, { passive: true });
    document.addEventListener('focusout', handleFocusOut, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('popstate', hideTooltip);

    return () => {
      observer.disconnect();
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('popstate', hideTooltip);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll);
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
      // BefUI's dark tooltip (https://befui.vercel.app/#/components/tooltip)
      className="pointer-events-none z-[10001] select-none whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-md"
    >
      {tooltipState.text}
    </div>
  );
}

export default TooltipManager;

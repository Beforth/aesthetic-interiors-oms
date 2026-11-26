'use client';

import * as React from 'react';

const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * Every child of `root` with `data-flip="id"` slides from its old place to its new one after a render.
 * `root` and anything between it and the items must be positioned. `from(id, point)` makes one item fly in from a point on screen.
 */
export function useFlip(root: React.RefObject<HTMLElement | null>) {
  const places = React.useRef(new Map<string, { x: number; y: number }>());
  const starts = React.useRef(new Map<string, { x: number; y: number }>());
  React.useLayoutEffect(() => {
    root.current?.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
      const id = el.dataset.flip!;
      if (!el.offsetWidth) return void places.current.delete(id); // hidden
      // layout offsets, not screen rects, so a card that is still sliding doesn't skew the next slide
      let x = 0, y = 0;
      for (let n: HTMLElement | null = el; n && n !== root.current; n = n.offsetParent as HTMLElement | null) { x += n.offsetLeft; y += n.offsetTop; }
      const was = places.current.get(id);
      places.current.set(id, { x, y });
      if (!el.animate || still()) return void starts.current.delete(id);
      const start = starts.current.get(id);
      if (start) {
        starts.current.delete(id);
        const now = el.getBoundingClientRect();
        el.animate([{ transform: `translate(${start.x - now.left}px, ${start.y - now.top}px) rotate(-2deg) scale(1.04)` }, { transform: 'none' }], { duration: 320, easing: EASE });
      } else if (was && (was.x !== x || was.y !== y)) {
        el.animate([{ transform: `translate(${was.x - x}px, ${was.y - y}px)` }, { transform: 'none' }], { duration: 260, easing: EASE });
      }
    });
  });
  return { from: (id: string, point: { x: number; y: number }) => void starts.current.set(id, point) };
}

/**
 * Drag with a mouse, pen or finger. A copy of the item lifts, tilts the way you move it and follows the pointer.
 * A finger has to rest on the item for a moment first, so swiping still scrolls; an element with `data-grip` starts at once.
 * `locate` returns where a drop at that point would land (or null), `drop` applies it. Escape cancels.
 */
export function useDragLift<S>({ locate, drop }: { locate: (x: number, y: number) => S | null; drop: (id: string, slot: S, releasedAt: { x: number; y: number }) => void }) {
  const [drag, setDrag] = React.useState<{ id: string; height: number; slot: S | null } | null>(null);
  const latest = React.useRef({ locate, drop });
  latest.current = { locate, drop };
  const stop = React.useRef<() => void>(undefined);
  React.useEffect(() => () => stop.current?.(), []);

  const start = (id: string) => (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const hit = e.target as HTMLElement;
    const grip = !!hit.closest('[data-grip]');
    // controls inside a card keep working
    if (e.button > 0 || stop.current || (!grip && hit !== el && hit.closest('a, button, input, select, textarea, label, [data-no-drag]'))) return;
    const from = { x: e.clientX, y: e.clientY };
    const touch = e.pointerType === 'touch';
    let ghost: HTMLElement | null = null;
    let origin = { x: 0, y: 0 };
    let slot: S | null = null;
    let lastX = from.x;
    let tilt = 0;

    const lift = () => {
      const r = el.getBoundingClientRect();
      origin = { x: r.left, y: r.top };
      ghost = el.cloneNode(true) as HTMLElement;
      for (const a of ['data-card', 'data-row', 'data-flip', 'id', 'tabindex']) ghost.removeAttribute(a);
      ghost.setAttribute('aria-hidden', 'true');
      ghost.setAttribute('data-drag-ghost', '');
      Object.assign(ghost.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, margin: '0', pointerEvents: 'none', zIndex: '90', boxShadow: '0 18px 40px -12px rgb(0 0 0 / 0.35)', transition: still() ? 'none' : `rotate 180ms ${EASE}, scale 180ms ${EASE}` });
      document.body.append(ghost);
      document.body.style.userSelect = 'none';
      setDrag({ id, height: r.height, slot: null });
      requestAnimationFrame(() => { if (ghost && !still()) { ghost.style.scale = '1.04'; ghost.style.rotate = '-2deg'; } });
    };
    const hold = touch && !grip ? window.setTimeout(lift, 250) : undefined;

    const move = (ev: PointerEvent) => {
      const far = Math.hypot(ev.clientX - from.x, ev.clientY - from.y);
      if (!ghost) {
        if (hold !== undefined) { if (far > 8) end(false); return; } // a swipe, not a hold
        if (far <= 5) return;
        lift();
      }
      tilt = Math.max(-7, Math.min(7, tilt * 0.8 + (ev.clientX - lastX) * 0.25));
      lastX = ev.clientX;
      ghost!.style.translate = `${ev.clientX - from.x}px ${ev.clientY - from.y}px`;
      if (!still()) ghost!.style.rotate = `${-2 + tilt}deg`;
      slot = latest.current.locate(ev.clientX, ev.clientY);
      setDrag((d) => d && { ...d, slot });
    };
    const noScroll = (ev: TouchEvent) => { if (ghost) ev.preventDefault(); };
    const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') end(false); };
    const up = () => end(true);
    const cancel = () => end(false);
    function end(keep: boolean) {
      window.clearTimeout(hold);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('touchmove', noScroll);
      window.removeEventListener('keydown', key);
      stop.current = undefined;
      if (!ghost) return;
      const at = ghost.getBoundingClientRect();
      ghost.remove();
      ghost = null;
      document.body.style.userSelect = '';
      // the release must not also count as a click on the card
      const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener('click', swallow, true);
      setTimeout(() => window.removeEventListener('click', swallow, true), 0);
      if (keep && slot !== null) latest.current.drop(id, slot, { x: at.left, y: at.top });
      setDrag(null);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('touchmove', noScroll, { passive: false });
    window.addEventListener('keydown', key);
    stop.current = () => end(false);
  };

  return { drag, start };
}

/**
 * Where to draw one highlight behind the chosen item. Its front edge leaves first and the back edge catches up, so it stretches.
 * `pick` finds the chosen element; offsets are read against the container, which must be positioned.
 * `axis` is the direction it travels: 'x' for a row (`style` holds left and right), 'y' for a menu column (top and bottom).
 */
export function useStretch(container: React.RefObject<HTMLElement | null>, pick: (root: HTMLElement) => HTMLElement | null | undefined, axis: 'x' | 'y' = 'x') {
  const [edge, setEdge] = React.useState<{ left: number; right: number; top: number; bottom: number; width: number; height: number; forward: boolean } | null>(null);
  const picker = React.useRef(pick);
  picker.current = pick;
  // BefUI set state on every render here, which React 18 turns into "Maximum update depth exceeded" when a list is
  // filtered. The last measurement is kept in a ref, and state is only set when something has really moved.
  const last = React.useRef<typeof edge>(null);
  const measure = React.useCallback(() => {
    const root = container.current;
    const el = root && picker.current(root);
    if (!root || !el) {
      if (last.current) { last.current = null; setEdge(null); }
      return;
    }
    const left = el.offsetLeft;
    const right = (root.clientWidth || root.offsetWidth) - left - el.offsetWidth;
    const top = el.offsetTop;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const bottom = (root.clientHeight || root.offsetHeight) - top - height;
    const was = last.current;
    if (was && was.left === left && was.right === right && was.top === top && was.bottom === bottom && was.height === height) return;
    const next = { left, right, top, bottom, width, height, forward: !was || (axis === 'x' ? left >= was.left : top >= was.top) };
    last.current = next;
    setEdge(next);
  }, [container, axis]);
  React.useLayoutEffect(() => { measure(); });
  React.useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    // uncontrolled tabs change an attribute without re-rendering this component
    const mo = new MutationObserver(measure);
    mo.observe(root, { subtree: true, attributes: true, attributeFilter: ['data-state', 'aria-current'] });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(root);
    return () => { mo.disconnect(); ro?.disconnect(); };
  }, [container, measure]);

  const lead = 'var(--dur-base)';
  const trail = 'var(--dur-medium)';
  const [back, front] = axis === 'x' ? (['left', 'right'] as const) : (['top', 'bottom'] as const);
  const style: React.CSSProperties | undefined = edge
    ? { [back]: edge[back], [front]: edge[front], transition: `${back} ${edge.forward ? trail : lead} var(--ease-out), ${front} ${edge.forward ? lead : trail} var(--ease-out)` }
    : undefined;
  return { edge, style };
}

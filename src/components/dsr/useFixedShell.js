import { useLayoutEffect } from 'react';

/**
 * While the page that calls this is on screen, make the app shell exactly as tall as the window.
 *
 * The shell normally grows with its tallest part, so on a short window the sidebar's menu makes the whole
 * window scroll and the sidebar moves with the page. With the height fixed, the sidebar scrolls on its own
 * and the page scrolls on its own. The previous inline styles are put back when the page closes, so other
 * pages behave exactly as before.
 */
export function useFixedShell() {
  useLayoutEffect(() => {
    const row = document.querySelector('main')?.closest('div.overflow-hidden');
    if (!row) return undefined;

    const before = { height: row.style.height, minHeight: row.style.minHeight, maxHeight: row.style.maxHeight };
    row.style.height = '100dvh';
    row.style.minHeight = '0';
    row.style.maxHeight = '100dvh';

    return () => {
      row.style.height = before.height;
      row.style.minHeight = before.minHeight;
      row.style.maxHeight = before.maxHeight;
    };
  }, []);
}

export default useFixedShell;

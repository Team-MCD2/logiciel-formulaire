'use client';

import { useEffect } from 'react';

/**
 * Custom React hook to prevent inspect operations (right-click, standard shortcuts,
 * and DevTools active detection with debugger and DOM wiping).
 */
export function useAntiScraping() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // Allow inspection in development environment
      return;
    }

    // 1. Disable right-click context menu
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 2. Intercept keyboard shortcuts (F12, Ctrl+Shift+I/J/C, Ctrl+U)
    const preventShortcuts = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('keydown', preventShortcuts);

    // 3. Active DevTools detector (runs a fast timer evaluating time taken to log a debugger statement)
    const checkDevTools = () => {
      const startTime = performance.now();
      
      // Inline debugger triggers browser breakpoint if DevTools is open.
      // If it is closed, execution passes instantly.
      // eslint-disable-next-line no-debugger
      debugger;
      
      const endTime = performance.now();
      const timeTaken = endTime - startTime;

      if (timeTaken > 100) {
        // DevTools are open or execution was paused. Wipe DOM!
        console.clear();
        const root = document.getElementById('__next') || document.body;
        if (root) {
          root.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#888;">Not Found</div>';
        }
      }
    };

    const interval = setInterval(checkDevTools, 1000);

    return () => {
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('keydown', preventShortcuts);
      clearInterval(interval);
    };
  }, []);
}

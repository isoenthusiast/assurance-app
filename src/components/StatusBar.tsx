"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * StatusBar — reads a status_message cookie set by API routes
 * and displays it as a non-intrusive bottom bar.
 * Auto-hides after 10 seconds or on click.
 */
export default function StatusBar() {
  const [state, setState] = useState<{ message: string | null; visible: boolean }>({
    message: null,
    visible: false,
  });
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readCookie = useCallback(() => {
    const match = document.cookie.match(/(?:^|;\s*)status_message=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, []);

  // Poll for cookie-based status messages
  useEffect(() => {
    const checkCookie = () => {
      const msg = readCookie();
      if (msg) {
        // Clear cookie after reading
        document.cookie = "status_message=; path=/; max-age=0";
        setState({ message: msg, visible: true });
        // Auto-hide after 10 seconds
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          setState((prev) => ({ ...prev, visible: false }));
        }, 10000);
      }
    };

    // Initial check
    checkCookie();

    // Poll for new messages every 3 seconds
    const interval = setInterval(checkCookie, 3000);
    return () => {
      clearInterval(interval);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [readCookie]);

  if (!state.visible || !state.message) return null;

  return (
    <div
      onClick={() => setState((prev) => ({ ...prev, visible: false }))}
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 bg-slate-900 text-white text-sm shadow-lg cursor-pointer"
    >
      <span className="flex items-center gap-2">
        <span className="animate-pulse">⬤</span>
        {state.message}
      </span>
      <span className="text-xs text-slate-400 ml-4 flex-shrink-0">Click to dismiss</span>
    </div>
  );
}

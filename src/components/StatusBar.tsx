"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * StatusBar — reads a status_message cookie set by API routes
 * and displays it as a non-intrusive bottom bar.
 * Auto-hides after 10 seconds or on click.
 */
export default function StatusBar() {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const readCookie = useCallback(() => {
    const match = document.cookie.match(/(?:^|;\s*)status_message=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, []);

  useEffect(() => {
    // Initial read
    const msg = readCookie();
    if (msg) {
      setMessage(msg);
      setVisible(true);
      // Clear cookie after reading
      document.cookie = "status_message=; path=/; max-age=0";
    }

    // Poll for new messages every 3 seconds
    const interval = setInterval(() => {
      const msg = readCookie();
      if (msg) {
        setMessage(msg);
        setVisible(true);
        document.cookie = "status_message=; path=/; max-age=0";
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [readCookie]);

  // Auto-hide after 10 seconds
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 10000);
    return () => clearTimeout(timer);
  }, [visible, message]);

  if (!visible || !message) return null;

  return (
    <div
      onClick={() => setVisible(false)}
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 bg-slate-900 text-white text-sm shadow-lg cursor-pointer"
    >
      <span className="flex items-center gap-2">
        <span className="animate-pulse">⬤</span>
        {message}
      </span>
      <span className="text-xs text-slate-400 ml-4 flex-shrink-0">Click to dismiss</span>
    </div>
  );
}

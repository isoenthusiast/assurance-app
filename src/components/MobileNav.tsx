"use client";

import { useState } from "react";
import Link from "next/link";

export default function MobileNav({ 
  role, children 
}: { 
  role?: string; 
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop nav (hidden on mobile) */}
      <div className="hidden md:flex items-center gap-6">
        {children}
      </div>

      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden p-2 text-slate-600 hover:text-slate-900"
        aria-label="Toggle menu"
      >
        {open ? "✕" : "☰"}
      </button>

      {/* Mobile dropdown menu */}
      {open && (
        <div className="absolute top-full left-0 right-0 bg-white border-b border-slate-200 shadow-lg z-50 md:hidden">
          <nav className="flex flex-col p-4 gap-2">
            <Link href="/fla" onClick={() => setOpen(false)} className="px-3 py-2 rounded text-sm text-slate-700 hover:bg-slate-100">
              📊 Dashboard
            </Link>
            <Link href="/setup/assessments" onClick={() => setOpen(false)} className="px-3 py-2 rounded text-sm text-slate-700 hover:bg-slate-100">
              📋 Assessments
            </Link>
            <Link href="/setup/process-areas" onClick={() => setOpen(false)} className="px-3 py-2 rounded text-sm text-slate-700 hover:bg-slate-100">
              📂 Process Area
            </Link>
            <Link href="/setup/controls" onClick={() => setOpen(false)} className="px-3 py-2 rounded text-sm text-slate-700 hover:bg-slate-100">
              🎛️ Controls
            </Link>
            {role === "Admin" && (
              <Link href="/admin" onClick={() => setOpen(false)} className="px-3 py-2 rounded text-sm text-slate-700 hover:bg-slate-100">
                ⚙️ Admin
              </Link>
            )}
          </nav>
        </div>
      )}
    </>
  );
}

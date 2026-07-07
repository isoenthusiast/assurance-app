"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-slate-600 hover:text-slate-900 hover:underline"
    >
      Sign out
    </button>
  );
}

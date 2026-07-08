import Link from "next/link";
import { auth } from "@/auth";
import SignOutButton from "./SignOutButton";

export default async function NavBar() {
  let session;
  try {
    session = await auth();
  } catch {
    // auth unavailable (e.g., missing AUTH_SECRET or DB not ready)
  }
  const role = (session?.user as { role?: string })?.role;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-slate-900">
            CONAN PROJECT
          </Link>
          {session && (
            <nav className="flex gap-4 text-sm text-slate-600">
              <Link href="/fla" className="hover:text-slate-900">
                Dashboard
              </Link>
              <Link href="/setup/assessments" className="hover:text-slate-900">
                Assessments
              </Link>
              <Link href="/setup/process-areas" className="hover:text-slate-900">
                Process Area
              </Link>
              <Link href="/setup/controls" className="hover:text-slate-900">
                Controls
              </Link>
              {role === "Admin" && (
                <Link href="/setup/badges" className="hover:text-slate-900">
                  Badges
                </Link>
              )}
              {role === "Admin" && (
                <Link href="/admin" className="hover:text-slate-900">
                  Admin
                </Link>
              )}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          {session ? (
            <>
              <span>
                {session.user?.name} ({(session.user as { role?: string })?.role})
              </span>
              <SignOutButton />
            </>
          ) : (
            <Link href="/login" className="hover:text-slate-700">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

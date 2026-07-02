import Link from "next/link";
import { auth, signOut } from "@/auth";

const navLinks = [
  { href: "/fla", label: "FLA Dashboard" },
  { href: "/setup/activity-types", label: "Activity Types" },
  { href: "/setup/process-areas", label: "Process Areas" },
  { href: "/setup/sub-processes", label: "Sub-Processes" },
  { href: "/setup/controls", label: "Controls" },
  { href: "/admin", label: "Admin" },
];

export default async function NavBar() {
  const session = await auth();
  if (!session) return null;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-slate-900">
            SEAM Assurance
          </Link>
          <nav className="flex gap-4 text-sm text-slate-600">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-slate-900">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>
            {session.user?.name} ({(session.user as { role?: string })?.role})
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="text-slate-600 hover:text-slate-900 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

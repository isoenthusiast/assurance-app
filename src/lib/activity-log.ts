import { prisma } from "@/lib/prisma";

export interface ActivityLogEntry {
  activityType: string;
  description: string;
  username: string;
  refTable?: string | null;
  refRecord?: string | null;
}

/**
 * Log a user activity. Safe to call without awaiting — fire and forget.
 */
export async function logActivity(entry: ActivityLogEntry) {
  try {
    await prisma.activityLog.create({
      data: {
        activityType: entry.activityType,
        description: entry.description,
        username: entry.username,
        refTable: entry.refTable ?? null,
        refRecord: entry.refRecord ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}

/** Extract display name from session */
export function getUsername(session: { user?: { name?: string | null } } | null): string {
  return (session?.user as { name?: string })?.name ?? "Unknown";
}

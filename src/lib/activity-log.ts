import { prisma } from "@/lib/prisma";
import type { InputJsonValue } from "@/generated/prisma/client";

export interface ActivityLogEntry {
  activityType: string;
  description: string;
  username: string;
  refTable?: string | null;
  refRecord?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
}

/**
 * Log a user activity with optional before/after snapshots.
 * Returns the created ActivityLog id for linking to PointTransaction.
 *
 * @example
 *   await logActivity({
 *     activityType: "Update Control",
 *     description: "Updated control ACME-001",
 *     username: "admin",
 *     refTable: "Control",
 *     refRecord: "ctrl_123",
 *     beforeData: { name: "Old Name", riskWeight: 1 },
 *     afterData:  { name: "New Name", riskWeight: 3 },
 *   });
 */
export async function logActivity(entry: ActivityLogEntry): Promise<string | null> {
  try {
    const log = await prisma.activityLog.create({
      data: {
        activityType: entry.activityType,
        description: entry.description,
        username: entry.username,
        refTable: entry.refTable ?? null,
        refRecord: entry.refRecord ?? null,
        beforeData: (entry.beforeData as InputJsonValue) ?? undefined,
        afterData: (entry.afterData as InputJsonValue) ?? undefined,
      },
    });
    return log.id;
  } catch (err) {
    console.error("Failed to log activity:", err);
    return null;
  }
}

/** Extract display name from session */
export function getUsername(session: { user?: { name?: string | null } } | null): string {
  return (session?.user as { name?: string })?.name ?? "Unknown";
}

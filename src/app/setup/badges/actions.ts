"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function deleteBadge(id: string) {
  const badge = await prisma.achievementBadge.findUnique({ where: { id } });
  if (!badge) throw new Error("Badge not found");

  // Delete image file if exists
  if (badge.badgeImage) {
    const path = await import("path");
    const fs = await import("fs/promises");
    const oldPath = path.join(process.cwd(), "public", badge.badgeImage);
    try { await fs.unlink(oldPath); } catch { /* ignore */ }
  }

  await prisma.achievementBadge.delete({ where: { id } });
  revalidatePath("/setup/badges");
}

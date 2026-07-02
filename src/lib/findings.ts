import { prisma } from "@/lib/prisma";

const FID_PREFIX = "FID-";
const FID_PAD = 6;

/**
 * Generates the next Finding id in the FID-XXXXXX running-number convention
 * (e.g. FID-000001, FID-000002, ...). Scans existing Finding ids for the
 * highest numeric suffix and increments it, so it stays correct even if
 * earlier findings were deleted.
 */
export async function generateFindingId(): Promise<string> {
  const existing = await prisma.finding.findMany({
    where: { id: { startsWith: FID_PREFIX } },
    select: { id: true },
  });

  let max = 0;
  for (const { id } of existing) {
    const match = id.match(/^FID-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }

  return `${FID_PREFIX}${String(max + 1).padStart(FID_PAD, "0")}`;
}

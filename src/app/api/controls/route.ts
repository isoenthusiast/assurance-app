import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Public endpoint — returns process areas, sub-processes, and controls
// for the control selection UI. No admin check needed.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const [processAreas, subProcesses, controls] = await Promise.all([
      prisma.processArea.findMany({ orderBy: { name: "asc" } }),
      prisma.subProcess.findMany({ orderBy: { name: "asc" } }),
      prisma.control.findMany({
        include: { processArea: { select: { name: true } }, subProcess: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({ processAreas, subProcesses, controls });
  } catch (error) {
    console.error("Error fetching controls data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

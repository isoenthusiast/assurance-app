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

    const [processAreas, subProcesses, controls, sampleTypes, recordSourceTypes, requirements, controlRequirements] = await Promise.all([
      prisma.processArea.findMany({ orderBy: { name: "asc" }, distinct: ["id"] }),
      prisma.subProcess.findMany({ orderBy: { name: "asc" }, distinct: ["id"] }),
      prisma.control.findMany({
        include: { processArea: { select: { name: true } }, controlSubProcesses: { include: { subProcess: { select: { id: true, name: true } } } } },
        orderBy: { name: "asc" },
      }),
      prisma.sampleType.findMany({ orderBy: { name: "asc" } }),
      prisma.recordSourceType.findMany({ orderBy: { name: "asc" } }),
      prisma.requirement.findMany({ orderBy: { requirementId: "asc" } }),
      prisma.mapControl2Requirement.findMany(),
    ]);

    return NextResponse.json({ processAreas, subProcesses, controls, sampleTypes, recordSourceTypes, requirements, controlRequirements });
  } catch (error) {
    console.error("Error fetching controls data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

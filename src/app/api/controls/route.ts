import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Public endpoint — returns process areas, sub-processes, and controls
// for the control selection UI. No admin check needed.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Read company filter from cookie
    let companyWhere: { companyId?: string } = {};
    try {
      const cookieStore = await cookies();
      const selectedCompanyId = cookieStore.get("selectedCompanyId")?.value;
      if (selectedCompanyId) companyWhere = { companyId: selectedCompanyId };
    } catch { /* ignore */ }

    const [processAreas, subProcesses, controls, sampleTypes, recordSourceTypes, requirements, controlRequirements] = await Promise.all([
      prisma.processArea.findMany({ where: companyWhere, orderBy: { name: "asc" }, distinct: ["id"] }),
      prisma.subProcess.findMany({ where: companyWhere, orderBy: { name: "asc" }, distinct: ["id"] }),
      prisma.control.findMany({
        where: companyWhere,
        include: { processArea: { select: { name: true } }, controlSubProcesses: { include: { subProcess: { select: { id: true, name: true } } } } },
        orderBy: { name: "asc" },
      }),
      prisma.sampleType.findMany({ orderBy: { name: "asc" } }),
      prisma.recordSourceType.findMany({ orderBy: { name: "asc" } }),
      prisma.requirement.findMany({ where: companyWhere, orderBy: { requirementId: "asc" } }),
      prisma.mapControl2Requirement.findMany(),
    ]);

    return NextResponse.json({ processAreas, subProcesses, controls, sampleTypes, recordSourceTypes, requirements, controlRequirements });
  } catch (error) {
    console.error("Error fetching controls data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

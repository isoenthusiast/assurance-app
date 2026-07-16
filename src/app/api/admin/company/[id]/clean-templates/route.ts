import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * POST /api/admin/company/[id]/clean-templates
 * Deletes all template data for a target company so Adopt Templates can be re-run cleanly.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetCompanyId } = await params;

  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "Admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const targetCompany = await prisma.company.findUnique({ where: { id: targetCompanyId } });
    if (!targetCompany) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    if (targetCompany.companyID === "SAMS001") {
      return NextResponse.json({ error: "Cannot clean SAMS001 (master template)" }, { status: 400 });
    }

    const results: Record<string, number> = {};

    // Delete junction tables referencing SMDS controls/templates
    for (const t of ["ControlSubProcess", "ControlAssignment", "MapControl2Requirement"]) {
      const r = await (prisma as any).$queryRawUnsafe(
        `DELETE FROM "${t}" WHERE "controlId" IN (SELECT id FROM "Control" WHERE "companyId" = $1)`,
        targetCompanyId
      );
      results[t] = r;
    }

    for (const t of ["AssessmentTemplateControlLinkage"]) {
      const r = await (prisma as any).$queryRawUnsafe(
        `DELETE FROM "${t}" WHERE "templateId" IN (SELECT id FROM "AssessmentTemplate" WHERE "companyId" = $1)`,
        targetCompanyId
      );
      results[t] = (results[t] || 0) + r;
      const r2 = await (prisma as any).$queryRawUnsafe(
        `DELETE FROM "${t}" WHERE "controlId" IN (SELECT id FROM "Control" WHERE "companyId" = $1)`,
        targetCompanyId
      );
      results[t] = (results[t] || 0) + r2;
    }

    const r3 = await (prisma as any).$queryRawUnsafe(
      `DELETE FROM "AssessmentTemplateActivityType" WHERE "templateId" IN (SELECT id FROM "AssessmentTemplate" WHERE "companyId" = $1)`,
      targetCompanyId
    );
    results["AssessmentTemplateActivityType"] = r3;

    // Delete core tables
    for (const t of ["Control", "Requirement", "SubProcess", "ProcessArea", "Standard", "AssessmentTemplate"]) {
      const r = await (prisma as any).$queryRawUnsafe(
        `DELETE FROM "${t}" WHERE "companyId" = $1`,
        targetCompanyId
      );
      results[t] = r;
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned template data for ${targetCompany.companyID}`,
      results,
    });
  } catch (error: any) {
    console.error("Clean templates error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to clean templates" },
      { status: 500 }
    );
  }
}

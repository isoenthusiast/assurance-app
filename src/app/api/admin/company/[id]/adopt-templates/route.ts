import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * POST /api/admin/company/[id]/adopt-templates
 * 
 * Duplicates all master template data from SAMS001 into the target company.
 * Copies: Standard → ProcessArea → SubProcess, Requirement, Control,
 *   AssessmentTemplate, and junction tables (ControlSubProcess, MapControl2Requirement,
 *   AssessmentTemplateControlLinkage, AssessmentTemplateActivityType).
 * 
 * Idempotent: if the target company already has Standard records, returns 409.
 * ProcessArea.name gets a [SHORTNAME] prefix to satisfy the global unique constraint.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetCompanyId } = await params;
  
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "Admin") {
      const resp = NextResponse.json({ error: "Not authorized" }, { status: 403 });
      resp.cookies.set('status_message', 'Not authorized to adopt templates', { path: '/', maxAge: 60 });
      return resp;
    }

    // Get target company info
    const targetCompany = await prisma.company.findUnique({ where: { id: targetCompanyId } });
    if (!targetCompany) {
      const resp = NextResponse.json({ error: "Company not found" }, { status: 404 });
      resp.cookies.set('status_message', 'Company not found', { path: '/', maxAge: 60 });
      return resp;
    }

    // Don't copy into SAMS001 itself
    if (targetCompany.companyID === "SAMS001") {
      const resp = NextResponse.json({ error: "Cannot adopt templates into SAMS001 (it IS the master)" }, { status: 400 });
      resp.cookies.set('status_message', 'Cannot adopt templates into SAMS001', { path: '/', maxAge: 60 });
      return resp;
    }

    // Get SAMS001 company
    const sams = await (prisma as any).$queryRawUnsafe(
      `SELECT id FROM "Company" WHERE "companyID" = 'SAMS001' LIMIT 1`
    ) as any[];
    if (!sams || sams.length === 0) {
      const resp = NextResponse.json({ error: "Master template company SAMS001 not found" }, { status: 500 });
      resp.cookies.set('status_message', 'Master template company SAMS001 not found', { path: '/', maxAge: 60 });
      return resp;
    }
    const samsId = sams[0].id;

    // Check if target already has template data (idempotency check)
    const existingStandards = await (prisma as any).$queryRawUnsafe(
      `SELECT COUNT(*)::int as cnt FROM "Standard" WHERE "companyId" = $1`,
      targetCompanyId
    ) as any[];
    if (existingStandards[0]?.cnt > 0) {
      const resp = NextResponse.json(
        { error: "Company already has template data. Delete existing records first or use a different company.", alreadyAdopted: true },
        { status: 409 }
      );
      resp.cookies.set('status_message', `${targetCompany.companyID} already has template data`, { path: '/', maxAge: 60 });
      return resp;
    }

    const shortName = (targetCompany.shortName || targetCompany.companyID).toUpperCase();
    const prefix = `[${shortName}] `;

    // Use a transaction for atomicity
    const results: Record<string, number> = {};
    
    await (prisma as any).$queryRawUnsafe(`BEGIN`);
    try {
      // ── 1. Copy Standards ──
      await (prisma as any).$queryRawUnsafe(`
        INSERT INTO "Standard" ("id", "standard", "standardDescription", "sequenceNo", "companyId", "createdAt")
        SELECT gen_random_uuid()::text, "standard", "standardDescription", "sequenceNo", $1, NOW()
        FROM "Standard" WHERE "companyId" = $2
        ON CONFLICT DO NOTHING
      `, targetCompanyId, samsId);
      results.standards = (await (prisma as any).$queryRawUnsafe(
        `SELECT COUNT(*)::int as cnt FROM "Standard" WHERE "companyId" = $1`, targetCompanyId
      ))[0].cnt;

      // Build ID maps via temp lookup (join via standard name + companyId)
      // We need old→new ID maps for every table. Use name-based matching where possible.

      // ── 2. Copy ProcessAreas ──
      await (prisma as any).$queryRawUnsafe(`
        INSERT INTO "ProcessArea" ("id", "name", "description", "pId", "standard", "StandardID", "companyId", "createdAt")
        SELECT 
          gen_random_uuid()::text,
          $3 || pa."name",
          pa."description",
          pa."pId",
          pa."standard",
          ns."id",
          $1,
          NOW()
        FROM "ProcessArea" pa
        JOIN "Standard" s ON s."id" = pa."StandardID" AND s."companyId" = $2
        JOIN "Standard" ns ON ns."standard" = s."standard" AND ns."companyId" = $1
        WHERE pa."companyId" = $2
        ON CONFLICT DO NOTHING
      `, targetCompanyId, samsId, prefix);
      results.processAreas = (await (prisma as any).$queryRawUnsafe(
        `SELECT COUNT(*)::int as cnt FROM "ProcessArea" WHERE "companyId" = $1`, targetCompanyId
      ))[0].cnt;

      // ── 3. Copy SubProcesses ──
      await (prisma as any).$queryRawUnsafe(`
        INSERT INTO "SubProcess" ("id", "name", "description", "processAreaId", "companyId", "createdAt")
        SELECT 
          gen_random_uuid()::text,
          sp."name",
          sp."description",
          npa."id",
          $1,
          NOW()
        FROM "SubProcess" sp
        JOIN "ProcessArea" opa ON opa."id" = sp."processAreaId" AND opa."companyId" = $2
        JOIN "ProcessArea" npa ON npa."name" = $3 || opa."name" AND npa."companyId" = $1
        WHERE sp."companyId" = $2
        ON CONFLICT DO NOTHING
      `, targetCompanyId, samsId, prefix);
      results.subProcesses = (await (prisma as any).$queryRawUnsafe(
        `SELECT COUNT(*)::int as cnt FROM "SubProcess" WHERE "companyId" = $1`, targetCompanyId
      ))[0].cnt;

      // ── 4. Copy Requirements (offset rId to avoid collision) ──
      const maxRId = (await (prisma as any).$queryRawUnsafe(
        `SELECT COALESCE(MAX("rID"), 0)::int as mx FROM "Requirement"`
      ))[0].mx;
      await (prisma as any).$queryRawUnsafe(`
        INSERT INTO "Requirement" ("rID", "requirementId", "clauseContent", "intentOutcome",
          "clauseApplicability", "references", "applicable", "standard", "pID", "processAreaId", "companyId", "createdAt")
        SELECT 
          r."rID" + $4,
          r."requirementId",
          r."clauseContent",
          r."intentOutcome",
          r."clauseApplicability",
          r."references",
          r."applicable",
          r."standard",
          r."pID",
          npa."id",
          $1,
          NOW()
        FROM "Requirement" r
        JOIN "ProcessArea" opa ON opa."id" = r."processAreaId" AND opa."companyId" = $2
        JOIN "ProcessArea" npa ON npa."name" = $3 || opa."name" AND npa."companyId" = $1
        WHERE r."companyId" = $2
        ON CONFLICT DO NOTHING
      `, targetCompanyId, samsId, prefix, maxRId);
      results.requirements = (await (prisma as any).$queryRawUnsafe(
        `SELECT COUNT(*)::int as cnt FROM "Requirement" WHERE "companyId" = $1`, targetCompanyId
      ))[0].cnt;

      // ── 4b. Create "Unmapped Controls" catch-all requirement per ProcessArea ──
      // Each PA needs an "Unmapped Controls" bucket for controls not yet mapped to a specific requirement.
      // This runs after regular requirement copy so it fills gaps where the JOIN may have missed them.
      await (prisma as any).$queryRawUnsafe(`
        INSERT INTO "Requirement" ("rID", "requirementId", "clauseContent", "intentOutcome",
          "clauseApplicability", "references", "applicable", "standard", "pID", "processAreaId", "companyId", "createdAt")
        SELECT
          (SELECT COALESCE(MAX("rID"), 0) FROM "Requirement") + ROW_NUMBER() OVER (ORDER BY pa."id"),
          'Unmapped Controls',
          'Controls not yet mapped to a specific requirement for this process area.',
          'These controls need to be reviewed and assigned to the correct requirement.',
          'All controls',
          '',
          true,
          pa."standard",
          pa."pId",
          pa."id",
          $1,
          NOW()
        FROM "ProcessArea" pa
        WHERE pa."companyId" = $1
          AND NOT EXISTS (
            SELECT 1 FROM "Requirement" r
            WHERE r."processAreaId" = pa."id"
              AND r."requirementId" = 'Unmapped Controls'
              AND r."companyId" = $1
          )
      `, targetCompanyId);

      // ── 5. Copy Controls ──
      await (prisma as any).$queryRawUnsafe(`
        INSERT INTO "Control" ("id", "name", "statement", "controlType", "processAreaId", "companyId",
          "isHsseCritical", "ramRating", "riskWeight", "rawHealthScore",
          "controlRef", "sourceFile", "practiceDocument", "controlTypeDetail",
          "csfWho", "csfWhat", "csfWhen", "csfWhere", "csfWhy", "csfHow", "csfEvidence",
          "keyActivities", "riskAddressed", "testingApproach", "uncertainFlags",
          "lastTestedDate", "lastTestResult", "createdAt")
        SELECT
          gen_random_uuid()::text,
          c."name", c."statement", c."controlType",
          npa."id", $1,
          c."isHsseCritical", c."ramRating", c."riskWeight", c."rawHealthScore",
          c."controlRef", c."sourceFile", c."practiceDocument", c."controlTypeDetail",
          c."csfWho", c."csfWhat", c."csfWhen", c."csfWhere", c."csfWhy", c."csfHow", c."csfEvidence",
          c."keyActivities", c."riskAddressed", c."testingApproach", c."uncertainFlags",
          c."lastTestedDate", c."lastTestResult", NOW()
        FROM "Control" c
        JOIN "ProcessArea" opa ON opa."id" = c."processAreaId" AND opa."companyId" = $2
        JOIN "ProcessArea" npa ON npa."name" = $3 || opa."name" AND npa."companyId" = $1
        WHERE c."companyId" = $2
        ON CONFLICT DO NOTHING
      `, targetCompanyId, samsId, prefix);
      results.controls = (await (prisma as any).$queryRawUnsafe(
        `SELECT COUNT(*)::int as cnt FROM "Control" WHERE "companyId" = $1`, targetCompanyId
      ))[0].cnt;

      // ── 6. Copy Junction: ControlSubProcess ──
      await (prisma as any).$queryRawUnsafe(`
        INSERT INTO "ControlSubProcess" ("id", "controlId", "subProcessId", "isPrimary", "createdAt")
        SELECT DISTINCT
          gen_random_uuid()::text,
          nc."id",
          nsp."id",
          csp."isPrimary",
          NOW()
        FROM "ControlSubProcess" csp
        JOIN "Control" oc ON oc."id" = csp."controlId" AND oc."companyId" = $2
        JOIN "SubProcess" osp ON osp."id" = csp."subProcessId" AND osp."companyId" = $2
        JOIN "Control" nc ON nc."name" = oc."name" AND nc."companyId" = $1
        JOIN "SubProcess" nsp ON nsp."name" = osp."name" AND nsp."companyId" = $1
        ON CONFLICT DO NOTHING
      `, targetCompanyId, samsId);
      results.controlSubProcesses = (await (prisma as any).$queryRawUnsafe(
        `SELECT COUNT(*)::int as cnt FROM "ControlSubProcess" csp 
         JOIN "Control" c ON c."id" = csp."controlId" WHERE c."companyId" = $1`, targetCompanyId
      ))[0].cnt;

      // ── 7. Copy Junction: MapControl2Requirement ──
      await (prisma as any).$queryRawUnsafe(`
        INSERT INTO "MapControl2Requirement" ("id", "controlId", "requirementRId", "processAreaId")
        SELECT DISTINCT
          gen_random_uuid()::text,
          nc."id",
          nr."rID",
          npa."id"
        FROM "MapControl2Requirement" m
        JOIN "Control" oc ON oc."id" = m."controlId" AND oc."companyId" = $2
        JOIN "Requirement" oreq ON oreq."rID" = m."requirementRId" AND oreq."companyId" = $2
        JOIN "ProcessArea" opa ON opa."id" = m."processAreaId" AND opa."companyId" = $2
        JOIN "Control" nc ON nc."name" = oc."name" AND nc."companyId" = $1
        JOIN "Requirement" nr ON nr."clauseContent" = oreq."clauseContent" 
          AND nr."requirementId" = oreq."requirementId" AND nr."companyId" = $1
        JOIN "ProcessArea" npa ON npa."name" = $3 || opa."name" AND npa."companyId" = $1
        ON CONFLICT DO NOTHING
      `, targetCompanyId, samsId, prefix);
      results.mapControl2Requirement = (await (prisma as any).$queryRawUnsafe(
        `SELECT COUNT(*)::int as cnt FROM "MapControl2Requirement" m
         JOIN "Control" c ON c."id" = m."controlId" WHERE c."companyId" = $1`, targetCompanyId
      ))[0].cnt;

      // ── 8. Copy AssessmentTemplates ──
      await (prisma as any).$queryRawUnsafe(`
        INSERT INTO "AssessmentTemplate" ("id", "name", "description", "companyId", "createdAt", "updatedAt")
        SELECT gen_random_uuid()::text, "name", "description", $1, NOW(), NOW()
        FROM "AssessmentTemplate" WHERE "companyId" = $2
        ON CONFLICT DO NOTHING
      `, targetCompanyId, samsId);
      results.assessmentTemplates = (await (prisma as any).$queryRawUnsafe(
        `SELECT COUNT(*)::int as cnt FROM "AssessmentTemplate" WHERE "companyId" = $1`, targetCompanyId
      ))[0].cnt;

      // ── 9. Copy Junction: AssessmentTemplateControlLinkage ──
      await (prisma as any).$queryRawUnsafe(`
        INSERT INTO "AssessmentTemplateControlLinkage" ("id", "templateId", "controlId", "createdAt")
        SELECT DISTINCT
          gen_random_uuid()::text,
          nt."id",
          nc."id",
          NOW()
        FROM "AssessmentTemplateControlLinkage" tl
        JOIN "AssessmentTemplate" ot ON ot."id" = tl."templateId" AND ot."companyId" = $2
        JOIN "Control" oc ON oc."id" = tl."controlId" AND oc."companyId" = $2
        JOIN "AssessmentTemplate" nt ON nt."name" = ot."name" AND nt."companyId" = $1
        JOIN "Control" nc ON nc."name" = oc."name" AND nc."companyId" = $1
        ON CONFLICT DO NOTHING
      `, targetCompanyId, samsId);

      // ── 10. Copy Junction: AssessmentTemplateActivityType ──
      await (prisma as any).$queryRawUnsafe(`
        INSERT INTO "AssessmentTemplateActivityType" ("id", "templateId", "activityTypeId", "createdAt")
        SELECT DISTINCT
          gen_random_uuid()::text,
          nt."id",
          ta."activityTypeId",
          NOW()
        FROM "AssessmentTemplateActivityType" ta
        JOIN "AssessmentTemplate" ot ON ot."id" = ta."templateId" AND ot."companyId" = $2
        JOIN "AssessmentTemplate" nt ON nt."name" = ot."name" AND nt."companyId" = $1
        ON CONFLICT DO NOTHING
      `, targetCompanyId, samsId);

      await (prisma as any).$queryRawUnsafe(`COMMIT`);

      const parts = [`${results.standards || 0} standards`, `${results.processAreas || 0} process areas`, `${results.controls || 0} controls`, `${results.requirements || 0} requirements`, `${results.assessmentTemplates || 0} templates`];
      const resp = NextResponse.json({
        success: true,
        message: `Adopted templates from SAMS001 into ${targetCompany.companyID}`,
        results,
      });
      resp.cookies.set('status_message', `Templates adopted for ${targetCompany.companyID}: ${parts.join(', ')}`, { path: '/', maxAge: 60 });
      return resp;
    } catch (err: any) {
      await (prisma as any).$queryRawUnsafe(`ROLLBACK`);
      throw err;
    }
  } catch (error: any) {
    console.error("Adopt templates error:", error);
    const resp = NextResponse.json(
      { error: error.message || "Failed to adopt templates" },
      { status: 500 }
    );
    resp.cookies.set('status_message', `Template adoption failed: ${error.message || 'Unknown error'}`, { path: '/', maxAge: 60 });
    return resp;
  }
}

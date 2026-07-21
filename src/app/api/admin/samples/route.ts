import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logActivity, getUsername } from "@/lib/activity-log";
import { requireAuth, hasCompanyAccess, getSelectedCompanyId } from "@/lib/authz";

async function loadAssessmentCompany(assessmentId: string) {
  return prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, companyId: true },
  });
}

export async function POST(request: Request) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;

    const {
      assessmentId,
      sampleTypeId,
      recordSourceId,
      recordReference,
      controlEffective,
      status,
      comment,
    } = await request.json();

    if (!assessmentId) {
      return NextResponse.json(
        { error: "assessmentId is required" },
        { status: 400 }
      );
    }

    const assessment = await loadAssessmentCompany(assessmentId);
    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }
    const ok = await hasCompanyAccess(session.user.id, assessment.companyId);
    if (!ok) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const sample = await prisma.sample.create({
      data: {
        assessmentId,
        sampleTypeId: sampleTypeId || null,
        recordSourceId: recordSourceId || null,
        recordReference: recordReference || null,
        controlEffective: controlEffective || false,
        status: status || "NotTested",
        comment: comment || null,
      },
      include: {
        sampleType: true,
        recordSource: true,
      },
    });

    logActivity({
      activityType: "Add Sample",
      description: `Added sample to assessment`,
      username: getUsername(session),
      refTable: "Sample",
      refRecord: sample.id,
    });

    return NextResponse.json(sample, { status: 201 });
  } catch (error) {
    console.error("Error creating sample:", error);
    return NextResponse.json(
      { error: "Failed to create sample" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get("assessmentId");

    let where: any = assessmentId ? { assessmentId } : {};

    if (session.user.role !== "Admin") {
      const selectedCompanyId = await getSelectedCompanyId();
      if (!selectedCompanyId) {
        return NextResponse.json([]);
      }
      const ok = await hasCompanyAccess(session.user.id, selectedCompanyId);
      if (!ok) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      // Scope to assessments of the selected company
      where = {
        ...where,
        assessment: { companyId: selectedCompanyId },
      };
    }

    const samples = await prisma.sample.findMany({
      where,
      include: {
        sampleType: true,
        recordSource: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(samples);
  } catch (error) {
    console.error("Error fetching samples:", error);
    return NextResponse.json(
      { error: "Failed to fetch samples" },
      { status: 500 }
    );
  }
}

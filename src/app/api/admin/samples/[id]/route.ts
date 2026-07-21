import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAuth, hasCompanyAccess } from "@/lib/authz";

async function loadSampleAssessmentCompany(sampleId: string) {
  const sample = await prisma.sample.findUnique({
    where: { id: sampleId },
    select: { assessment: { select: { id: true, companyId: true } } },
  });
  return sample?.assessment || null;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;

    const { id } = await params;
    const assessment = await loadSampleAssessmentCompany(id);
    if (!assessment) {
      return NextResponse.json({ error: "Sample not found" }, { status: 404 });
    }
    const ok = await hasCompanyAccess(session.user.id, assessment.companyId);
    if (!ok) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { sampleTypeId, recordSourceId, recordReference, controlEffective, status, comment } =
      await request.json();

    const sample = await prisma.sample.update({
      where: { id },
      data: {
        sampleTypeId: sampleTypeId || null,
        recordSourceId: recordSourceId || null,
        recordReference,
        controlEffective,
        status,
        comment: comment || null,
      },
      include: {
        sampleType: true,
        recordSource: true,
      },
    });

    return NextResponse.json(sample);
  } catch (error) {
    console.error("Error updating sample:", error);
    return NextResponse.json(
      { error: "Failed to update sample" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;

    const { id } = await params;
    const assessment = await loadSampleAssessmentCompany(id);
    if (!assessment) {
      return NextResponse.json({ error: "Sample not found" }, { status: 404 });
    }
    const ok = await hasCompanyAccess(session.user.id, assessment.companyId);
    if (!ok) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await prisma.sample.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting sample:", error);
    return NextResponse.json(
      { error: "Failed to delete sample" },
      { status: 500 }
    );
  }
}

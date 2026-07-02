import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const SEVERITIES = ["Low", "Medium", "High", "Serious"];

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const { sampleId, description, details, controlIds, risks, repeat, severity } =
      await request.json();

    if (!description || !description.trim()) {
      return NextResponse.json(
        { error: "Finding description is required" },
        { status: 400 }
      );
    }

    if (!severity || !SEVERITIES.includes(severity)) {
      return NextResponse.json(
        { error: `Severity must be one of: ${SEVERITIES.join(", ")}` },
        { status: 400 }
      );
    }

    const existing = await prisma.finding.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Finding not found" }, { status: 404 });
    }

    if (sampleId) {
      const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
      if (!sample || sample.assessmentId !== existing.assessmentId) {
        return NextResponse.json(
          { error: "Sample must belong to the same assessment" },
          { status: 400 }
        );
      }
    }

    const finding = await prisma.finding.update({
      where: { id },
      data: {
        sampleId: sampleId || null,
        description: description.trim(),
        details: details || null,
        controlIds: Array.isArray(controlIds) && controlIds.length > 0 ? controlIds.join("|") : null,
        risks: risks || null,
        repeat: !!repeat,
        severity,
      },
      include: {
        actions: { orderBy: { createdDate: "asc" } },
        sample: true,
      },
    });

    return NextResponse.json(finding);
  } catch (error) {
    console.error("Error updating finding:", error);
    return NextResponse.json(
      { error: "Failed to update finding" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    // Actions cascade-delete via the schema's onDelete: Cascade.
    await prisma.finding.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting finding:", error);
    return NextResponse.json(
      { error: "Failed to delete finding" },
      { status: 500 }
    );
  }
}

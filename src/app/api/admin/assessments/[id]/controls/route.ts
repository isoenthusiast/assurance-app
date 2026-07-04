import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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
    const { controlIds } = await request.json();

    if (!Array.isArray(controlIds)) {
      return NextResponse.json(
        { error: "controlIds must be an array" },
        { status: 400 }
      );
    }

    // Verify assessment exists
    const assessment = await prisma.assessment.findUnique({
      where: { id },
    });

    if (!assessment) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    // Verify all control IDs exist
    const controls = await prisma.control.findMany({
      where: { id: { in: controlIds } },
    });

    if (controls.length !== controlIds.length) {
      return NextResponse.json(
        { error: "One or more control IDs are invalid" },
        { status: 400 }
      );
    }

    // Get existing control assignments for this assessment
    const existingControlAssignments = await prisma.controlAssignment.findMany({
      where: { assessmentId: id },
    });

    const existingControlIds = new Set(
      existingControlAssignments.map((ca) => ca.controlId)
    );
    const newControlIds = new Set(controlIds);

    // Determine which controls to add and remove
    const controlsToAdd = controlIds.filter((cid) => !existingControlIds.has(cid));
    const controlsToRemove = Array.from(existingControlIds).filter(
      (cid) => !newControlIds.has(cid)
    );

    // Remove control assignments for removed controls
    if (controlsToRemove.length > 0) {
      await prisma.controlAssignment.deleteMany({
        where: {
          assessmentId: id,
          controlId: { in: controlsToRemove },
        },
      });
    }

    // Create control assignments for newly added controls.
    let addedCount = 0;
    if (controlsToAdd.length > 0) {
      const result = await prisma.controlAssignment.createMany({
        data: controlsToAdd.map((controlId) => ({
          assessmentId: id,
          controlId,
        })),
      });
      addedCount = result.count;
    }

    return NextResponse.json({
      success: true,
      message: `Updated controls: added ${addedCount}, removed ${controlsToRemove.length}, kept ${existingControlIds.size - controlsToRemove.length}`,
    });
  } catch (error) {
    console.error("Error updating assessment controls:", error);
    return NextResponse.json(
      { error: "Failed to update controls" },
      { status: 500 }
    );
  }
}

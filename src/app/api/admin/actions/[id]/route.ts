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
    const {
      actionDescription,
      actionDetails,
      actionTaken,
      actionParty,
      auditee,
      targetDate,
      apAgreed,
      actionClosureEffective,
      actionClosureApprovedBy,
    } = await request.json();

    if (!actionDescription || !actionDescription.trim()) {
      return NextResponse.json(
        { error: "Action description is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.action.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 });
    }

    const newTargetDate = targetDate ? new Date(targetDate) : null;
    const oldTargetTime = existing.targetDate ? existing.targetDate.getTime() : null;
    const newTargetTime = newTargetDate ? newTargetDate.getTime() : null;

    let originalTargetDate = existing.originalTargetDate;
    let numberOfExtensions = existing.numberOfExtensions;

    if (newTargetTime !== oldTargetTime) {
      if (!originalTargetDate && newTargetDate) {
        // First time a target date is ever set on this action.
        originalTargetDate = newTargetDate;
      } else if (originalTargetDate && newTargetDate) {
        // Target date is being pushed out (or pulled in) after already
        // having one — count it as an extension. originalTargetDate is
        // never overwritten once set.
        numberOfExtensions += 1;
      }
    }

    const action = await prisma.action.update({
      where: { id },
      data: {
        actionDescription: actionDescription.trim(),
        actionDetails: actionDetails || null,
        actionTaken: actionTaken || null,
        actionParty: actionParty || null,
        auditee: auditee || null,
        targetDate: newTargetDate,
        originalTargetDate,
        numberOfExtensions,
        apAgreed: !!apAgreed,
        actionClosureEffective: !!actionClosureEffective,
        actionClosureApprovedBy: actionClosureApprovedBy || null,
      },
    });

    return NextResponse.json(action);
  } catch (error) {
    console.error("Error updating action:", error);
    return NextResponse.json(
      { error: "Failed to update action" },
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

    await prisma.action.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting action:", error);
    return NextResponse.json(
      { error: "Failed to delete action" },
      { status: 500 }
    );
  }
}

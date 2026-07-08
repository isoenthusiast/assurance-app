import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logActivity, getUsername } from "@/lib/activity-log";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const {
      findingId,
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

    if (!findingId) {
      return NextResponse.json({ error: "findingId is required" }, { status: 400 });
    }

    if (!actionDescription || !actionDescription.trim()) {
      return NextResponse.json(
        { error: "Action description is required" },
        { status: 400 }
      );
    }

    const finding = await prisma.finding.findUnique({ where: { id: findingId } });
    if (!finding) {
      return NextResponse.json({ error: "Finding not found" }, { status: 400 });
    }

    const parsedTargetDate = targetDate ? new Date(targetDate) : null;

    const action = await prisma.action.create({
      data: {
        findingId,
        actionDescription: actionDescription.trim(),
        actionDetails: actionDetails || null,
        actionTaken: actionTaken || null,
        actionParty: actionParty || null,
        auditee: auditee || null,
        targetDate: parsedTargetDate,
        // First target date set on an action becomes its "original" target
        // date, which never changes afterwards.
        originalTargetDate: parsedTargetDate,
        apAgreed: !!apAgreed,
        actionClosureEffective: !!actionClosureEffective,
        actionClosureApprovedBy: actionClosureApprovedBy || null,
      },
    });

    logActivity({
      activityType: "Add Action",
      description: `Added corrective action`,
      username: getUsername(session),
      refTable: "Action",
      refRecord: action.id,
    });

    return NextResponse.json(action, { status: 201 });
  } catch (error) {
    console.error("Error creating action:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create action: ${errorMessage}` },
      { status: 500 }
    );
  }
}

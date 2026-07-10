import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const EFFECTIVENESS_VALUES = ["Effective", "NotEffective"];

async function recalcControlHealth(controlId: string) {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const stats = await prisma.$queryRawUnsafe<Array<{ total: number; effective: number }>>(`
    SELECT
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (WHERE ca."effective" = 'Effective')::int AS "effective"
    FROM "ControlAssignment" ca
    JOIN "Assessment" a ON a."id" = ca."assessmentId"
    WHERE ca."controlId" = $1 AND a."createdAt" >= $2
  `, controlId, ninetyDaysAgo);

  const total = Number(stats[0]?.total ?? 0);
  const effective = Number(stats[0]?.effective ?? 0);
  const newScore = total === 0 ? 0 : Math.round((effective / total) * 100);

  await prisma.control.update({
    where: { id: controlId },
    data: { rawHealthScore: newScore },
  });
}

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
    const body = await request.json();

    // Only touch fields the caller actually sent — an omitted field must
    // NOT be silently wiped to null.
    const data: {
      effective?: "Effective" | "NotEffective" | null;
      effectiveUpdatedAt?: Date | null;
    } = {};

    if (body.effective !== undefined) {
      if (body.effective !== null && !EFFECTIVENESS_VALUES.includes(body.effective)) {
        return NextResponse.json(
          { error: `effective must be one of: ${EFFECTIVENESS_VALUES.join(", ")}, or null` },
          { status: 400 }
        );
      }
      data.effective = body.effective || null;
      // Track when effectiveness was last set — only this field changes it.
      data.effectiveUpdatedAt = data.effective ? new Date() : null;
    }

    const updated = await prisma.controlAssignment.update({
      where: { id },
      data,
      include: { control: { select: { id: true } } },
    });

    // When effectiveness is confirmed (set to Effective or NotEffective),
    // update the parent Control's lastTestedDate and lastTestResult so
    // the control overview reflects actual testing history. A control with
    // no tested assignments shows Health = 0 and "Never Tested".
    if (body.effective !== undefined && body.effective !== null) {
      const lastTestResult = body.effective === "Effective" ? "Pass" : "Fail";
      await prisma.control.update({
        where: { id: updated.control.id },
        data: {
          lastTestedDate: new Date(),
          lastTestResult,
        },
      });

      // Recalculate rawHealthScore for this control based on last 90 days
      await recalcControlHealth(updated.control.id);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating control assignment:", error);
    return NextResponse.json(
      { error: "Failed to update control assignment" },
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

    // Get controlId before deleting
    const assignment = await prisma.controlAssignment.findUnique({
      where: { id },
      select: { controlId: true },
    });

    await prisma.controlAssignment.delete({ where: { id } });

    // Recalculate health score for the affected control
    if (assignment) {
      await recalcControlHealth(assignment.controlId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unassigning control:", error);
    return NextResponse.json(
      { error: "Failed to unassign control" },
      { status: 500 }
    );
  }
}

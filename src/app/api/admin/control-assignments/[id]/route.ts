import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const EFFECTIVENESS_VALUES = ["Effective", "NotEffective"];

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

    // Only touch fields the caller actually sent. lastTestedDate is
    // normally system-managed (synced from the assessment's end date), but
    // the generic admin table editor may still send it explicitly — either
    // way, an omitted field here must NOT be silently wiped to null.
    const data: {
      effective?: "Effective" | "NotEffective" | null;
      effectiveUpdatedAt?: Date | null;
      lastTestedDate?: Date | null;
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

    if (body.lastTestedDate !== undefined) {
      data.lastTestedDate = body.lastTestedDate ? new Date(body.lastTestedDate) : null;
    }

    const updated = await prisma.controlAssignment.update({
      where: { id },
      data,
    });

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

    await prisma.controlAssignment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unassigning control:", error);
    return NextResponse.json(
      { error: "Failed to unassign control" },
      { status: 500 }
    );
  }
}

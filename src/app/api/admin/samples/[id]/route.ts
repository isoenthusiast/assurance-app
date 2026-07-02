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
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

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

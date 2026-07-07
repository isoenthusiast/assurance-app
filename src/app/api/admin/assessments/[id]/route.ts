import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logActivity, getUsername } from "@/lib/activity-log";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        activityType: true,
        assessor: true,
        controlAssignments: { include: { control: true } },
        samples: true,
      },
    });

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    return NextResponse.json(assessment);
  } catch (error) {
    console.error("Error fetching assessment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
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
    const { name, status, endDate, assessorId, activityTypeId, startDate, loa } = await request.json();

    const assessment = await prisma.assessment.update({
      where: { id },
      data: {
        name,
        status,
        endDate: endDate ? new Date(endDate) : null,
        ...(assessorId !== undefined && { assessorId }),
        ...(activityTypeId !== undefined && { activityTypeId }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(loa !== undefined && { loa }),
      },
      include: {
        activityType: true,
        assessor: true,
        controlAssignments: { include: { control: true } },
        samples: true,
      },
    });

    logActivity({
      activityType: "Update Assessment",
      description: `Updated assessment "${name}"`,
      username: getUsername(session),
      refTable: "Assessment",
      refRecord: id,
    });

    return NextResponse.json(assessment);
  } catch (error) {
    console.error("Error updating assessment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
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

    await prisma.assessment.delete({
      where: { id },
    });

    logActivity({
      activityType: "Delete Assessment",
      description: `Deleted assessment`,
      username: getUsername(session),
      refTable: "Assessment",
      refRecord: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting assessment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logActivity, getUsername } from "@/lib/activity-log";
import { requireAuth, hasCompanyAccess } from "@/lib/authz";

async function loadAssessmentWithCompany(id: string) {
  return prisma.assessment.findUnique({
    where: { id },
    select: { id: true, companyId: true },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, response } = await requireAuth();
    if (response) return response;

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

    const ok = await hasCompanyAccess(session.user.id, assessment.companyId);
    if (!ok) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
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
    const { session, response } = await requireAuth();
    if (response) return response;

    const { id } = await params;
    const existing = await loadAssessmentWithCompany(id);
    if (!existing) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    // Only Admins or users with company access can update
    const isAdmin = session.user.role === "Admin";
    const ok = isAdmin || await hasCompanyAccess(session.user.id, existing.companyId);
    if (!ok) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

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
    const { session, response } = await requireAuth();
    if (response) return response;

    const { id } = await params;
    const existing = await loadAssessmentWithCompany(id);
    if (!existing) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    // DELETE is admin-only
    if (session.user.role !== "Admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

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

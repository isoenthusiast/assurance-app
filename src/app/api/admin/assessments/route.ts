import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { logActivity, getUsername } from "@/lib/activity-log";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Read company filter from cookie
    let companyWhere: { companyId?: string } = {};
    try {
      const cookieStore = await cookies();
      const selectedCompanyId = cookieStore.get("selectedCompanyId")?.value;
      if (selectedCompanyId) companyWhere = { companyId: selectedCompanyId };
    } catch { /* ignore */ }

    const assessments = await prisma.assessment.findMany({
      where: companyWhere,
      include: {
        activityType: true,
        assessor: { select: { id: true, name: true } },
        controlAssignments: { include: { control: true } },
        samples: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(assessments);
  } catch (error) {
    console.error("Error fetching assessments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { name, activityTypeId, startDate, controlIds } = await request.json();

    if (!name || !activityTypeId) {
      return NextResponse.json(
        { error: "Name and activity type are required" },
        { status: 400 }
      );
    }

    // Verify activity type exists
    const activityType = await prisma.assuranceActivityType.findUnique({
      where: { id: activityTypeId },
    });

    if (!activityType) {
      return NextResponse.json(
        { error: "Invalid activity type" },
        { status: 400 }
      );
    }

    // Ensure assessor ID is available and refers to a real, current User row.
    // (JWT sessions embed the user id at login time; if the User table was
    // reseeded/changed since then, session.user.id can be stale and would
    // otherwise fail as a raw FK violation on assessment.create().)
    const assessorId = session.user.id;
    if (!assessorId) {
      return NextResponse.json(
        { error: "User session invalid. Please log out and log back in." },
        { status: 401 }
      );
    }

    const assessorExists = await prisma.user.findUnique({
      where: { id: assessorId },
    });
    if (!assessorExists) {
      return NextResponse.json(
        {
          error:
            "Your session refers to a user that no longer exists in the database. Please log out and log back in.",
        },
        { status: 401 }
      );
    }

    // Verify all controls exist
    if (controlIds && controlIds.length > 0) {
      const controls = await prisma.control.findMany({
        where: { id: { in: controlIds } },
      });

      if (controls.length !== controlIds.length) {
        return NextResponse.json(
          { error: "One or more controls do not exist" },
          { status: 400 }
        );
      }
    }

    // Create assessment and assign the selected controls via ControlAssignment
    const assessment = await prisma.assessment.create({
      data: {
        name,
        activityTypeId,
        assessorId: session.user.id!,
        startDate: startDate ? new Date(startDate) : new Date(),
        loa: activityType.defaultLOA,
        status: "Planned",
        controlAssignments: {
          create: (controlIds || []).map((controlId: string) => ({
            controlId,
          })),
        },
      },
      include: {
        activityType: true,
        assessor: { select: { id: true, name: true } },
        controlAssignments: { include: { control: true } },
      },
    });

    logActivity({
      activityType: "Plan Assessment",
      description: `Planned assessment "${name}"`,
      username: getUsername(session),
      refTable: "Assessment",
      refRecord: assessment.id,
    });

    return NextResponse.json(assessment, { status: 201 });
  } catch (error) {
    console.error("Error creating assessment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create assessment: ${errorMessage}` },
      { status: 500 }
    );
  }
}

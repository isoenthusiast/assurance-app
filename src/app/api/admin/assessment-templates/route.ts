import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity, getUsername } from "@/lib/activity-log";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Read selected company from cookie
    let companyWhere = {};
    try {
      const cookieStore = await cookies();
      const selectedCompanyId = cookieStore.get("selectedCompanyId")?.value;
      if (selectedCompanyId) {
        companyWhere = { companyId: selectedCompanyId };
      }
    } catch {}

    const templates = await prisma.assessmentTemplate.findMany({
      where: companyWhere,
      include: {
        controlLinkages: {
          include: {
            control: {
              select: { id: true, name: true, processAreaId: true },
            },
          },
        },
        activityTypes: {
          include: { activityType: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
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

    const { name, description, controlIds, activityTypeIds } =
      await request.json();

    console.log("POST /api/admin/assessment-templates received:", {
      name,
      description,
      controlIds,
      activityTypeIds,
    });

    if (!name) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 }
      );
    }

    // Validate that all controlIds exist
    if (controlIds && controlIds.length > 0) {
      const controls = await prisma.control.findMany({
        where: { id: { in: controlIds } },
      });
      if (controls.length !== controlIds.length) {
        const missingIds = controlIds.filter(
          (id: string) => !controls.some((c) => c.id === id)
        );
        return NextResponse.json(
          { error: `Invalid control IDs: ${missingIds.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // Validate that all activityTypeIds exist
    if (activityTypeIds && activityTypeIds.length > 0) {
      const activityTypes = await prisma.assuranceActivityType.findMany({
        where: { id: { in: activityTypeIds } },
      });
      if (activityTypes.length !== activityTypeIds.length) {
        const missingIds = activityTypeIds.filter(
          (id: string) => !activityTypes.some((a) => a.id === id)
        );
        return NextResponse.json(
          { error: `Invalid activity type IDs: ${missingIds.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const template = await prisma.assessmentTemplate.create({
      data: {
        name,
        description: description || null,
        controlLinkages: {
          create: (controlIds || []).map((controlId: string) => ({
            controlId,
          })),
        },
        activityTypes: {
          create: (activityTypeIds || []).map((activityTypeId: string) => ({
            activityTypeId,
          })),
        },
      },
      include: {
        controlLinkages: {
          include: {
            control: {
              select: { id: true, name: true, processAreaId: true },
            },
          },
        },
        activityTypes: { include: { activityType: true } },
      },
    });

    // Log activity
    logActivity({
      activityType: "Add Assessment Template",
      description: `Added assessment template "${name}"`,
      username: getUsername(session),
      refTable: "AssessmentTemplate",
      refRecord: template.id,
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error creating template:", error);
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "object" && error !== null) {
      errorMessage = JSON.stringify(error);
    } else {
      errorMessage = String(error);
    }
    console.error("Detailed error:", errorMessage);
    return NextResponse.json(
      { error: `Failed to create template: ${errorMessage}` },
      { status: 500 }
    );
  }
}

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

    const template = await prisma.assessmentTemplate.findUnique({
      where: { id },
      include: {
        controlLinkages: {
          include: {
            control: {
              select: { id: true, name: true, processAreaId: true, controlSubProcesses: { include: { subProcess: { select: { id: true, name: true } } } } },
            },
          },
        },
        activityTypes: { include: { activityType: true } },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error fetching template:", error);
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
    const { name, description, controlIds, activityTypeIds } =
      await request.json();

    // Update template
    const template = await prisma.assessmentTemplate.update({
      where: { id },
      data: {
        name,
        description: description || null,
      },
    });

    // Update control linkages
    if (Array.isArray(controlIds)) {
      await prisma.assessmentTemplateControlLinkage.deleteMany({
        where: { templateId: id },
      });

      await prisma.assessmentTemplateControlLinkage.createMany({
        data: controlIds.map((controlId: string) => ({
          templateId: id,
          controlId,
        })),
      });
    }

    // Update activity type linkages
    if (Array.isArray(activityTypeIds)) {
      await prisma.assessmentTemplateActivityType.deleteMany({
        where: { templateId: id },
      });

      await prisma.assessmentTemplateActivityType.createMany({
        data: activityTypeIds.map((activityTypeId: string) => ({
          templateId: id,
          activityTypeId,
        })),
      });
    }

    const updated = await prisma.assessmentTemplate.findUnique({
      where: { id },
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

    logActivity({
      activityType: "Update Assessment Template",
      description: `Updated assessment template "${name}"`,
      username: getUsername(session),
      refTable: "AssessmentTemplate",
      refRecord: id,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating template:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to update template: ${errorMessage}` },
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

    await prisma.assessmentTemplate.delete({
      where: { id },
    });

    logActivity({
      activityType: "Delete Assessment Template",
      description: `Deleted assessment template`,
      username: getUsername(session),
      refTable: "AssessmentTemplate",
      refRecord: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to delete template: ${errorMessage}` },
      { status: 500 }
    );
  }
}

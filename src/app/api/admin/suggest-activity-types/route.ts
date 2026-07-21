import { requireAdmin } from "@/lib/authz";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    // Get unique control types from database
    const controls = await prisma.control.findMany({
      select: { controlType: true },
      distinct: ['controlType'],
    });

    const uniqueControlTypes = controls.map((c) => c.controlType);

    // Get existing activity types
    const existingActivityTypes = await prisma.assuranceActivityType.findMany({
      select: { name: true },
    });

    const existingNames = new Set(existingActivityTypes.map((a) => a.name));

    // Suggest activity types based on control types
    const suggestedActivityTypes = uniqueControlTypes
      .filter((type) => !existingNames.has(`${type} Control Assurance`))
      .map((type) => ({
        name: `${type} Control Assurance`,
        description: `Assurance activities for ${type} controls`,
        defaultLOA: 'FirstLine',
      }));

    return NextResponse.json({
      uniqueControlTypes,
      suggestedActivityTypes,
      existingActivityTypes: existingActivityTypes.map((a) => a.name),
    });
  } catch (error) {
    console.error('Error suggesting activity types:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { activityTypes } = await request.json();

    if (!Array.isArray(activityTypes)) {
      return NextResponse.json({ error: 'activityTypes must be an array' }, { status: 400 });
    }

    // Create new activity types
    const created = await Promise.all(
      activityTypes.map((activity) =>
        prisma.assuranceActivityType.create({
          data: {
            name: activity.name,
            description: activity.description,
            defaultLOA: activity.defaultLOA || 'FirstLine',
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      created: created.length,
      activityTypes: created,
    });
  } catch (error) {
    console.error('Error creating activity types:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

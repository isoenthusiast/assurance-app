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
      assessmentId,
      sampleTypeId,
      recordSourceId,
      recordReference,
      controlEffective,
      status,
      comment,
    } = await request.json();

    if (!assessmentId) {
      return NextResponse.json(
        { error: "assessmentId is required" },
        { status: 400 }
      );
    }

    const sample = await prisma.sample.create({
      data: {
        assessmentId,
        sampleTypeId: sampleTypeId || null,
        recordSourceId: recordSourceId || null,
        recordReference: recordReference || null,
        controlEffective: controlEffective || false,
        status: status || "NotTested",
        comment: comment || null,
      },
      include: {
        sampleType: true,
        recordSource: true,
      },
    });

    logActivity({
      activityType: "Add Sample",
      description: `Added sample to assessment`,
      username: getUsername(session),
      refTable: "Sample",
      refRecord: sample.id,
    });

    return NextResponse.json(sample, { status: 201 });
  } catch (error) {
    console.error("Error creating sample:", error);
    return NextResponse.json(
      { error: "Failed to create sample" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const samples = await prisma.sample.findMany({
      include: {
        sampleType: true,
        recordSource: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(samples);
  } catch (error) {
    console.error("Error fetching samples:", error);
    return NextResponse.json(
      { error: "Failed to fetch samples" },
      { status: 500 }
    );
  }
}

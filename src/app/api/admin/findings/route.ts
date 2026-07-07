import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateFindingId } from "@/lib/findings";
import { NextResponse } from "next/server";
import { logActivity, getUsername } from "@/lib/activity-log";

const SEVERITIES = ["Low", "Medium", "High", "Serious"];

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get("assessmentId");

    const findings = await prisma.finding.findMany({
      where: assessmentId ? { assessmentId } : undefined,
      include: {
        actions: { orderBy: { createdDate: "asc" } },
        sample: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(findings);
  } catch (error) {
    console.error("Error fetching findings:", error);
    return NextResponse.json(
      { error: "Failed to fetch findings" },
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

    const {
      assessmentId,
      sampleId,
      description,
      details,
      controlIds,
      risks,
      repeat,
      severity,
    } = await request.json();

    if (!assessmentId) {
      return NextResponse.json(
        { error: "assessmentId is required" },
        { status: 400 }
      );
    }

    if (!description || !description.trim()) {
      return NextResponse.json(
        { error: "Finding description is required" },
        { status: 400 }
      );
    }

    if (!severity || !SEVERITIES.includes(severity)) {
      return NextResponse.json(
        { error: `Severity must be one of: ${SEVERITIES.join(", ")}` },
        { status: 400 }
      );
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
    });
    if (!assessment) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 400 }
      );
    }

    if (sampleId) {
      const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
      if (!sample || sample.assessmentId !== assessmentId) {
        return NextResponse.json(
          { error: "Sample must belong to the same assessment" },
          { status: 400 }
        );
      }
    }

    const id = await generateFindingId();

    const finding = await prisma.finding.create({
      data: {
        id,
        assessmentId,
        sampleId: sampleId || null,
        description: description.trim(),
        details: details || null,
        controlIds: Array.isArray(controlIds) && controlIds.length > 0 ? controlIds.join("|") : null,
        risks: risks || null,
        repeat: !!repeat,
        severity,
      },
      include: {
        actions: true,
        sample: true,
      },
    });

    logActivity({
      activityType: "Record Finding",
      description: `Recorded finding "${description}"`,
      username: getUsername(session),
      refTable: "Finding",
      refRecord: finding.id,
    });

    return NextResponse.json(finding, { status: 201 });
  } catch (error) {
    console.error("Error creating finding:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create finding: ${errorMessage}` },
      { status: 500 }
    );
  }
}

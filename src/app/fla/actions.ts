"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  awardPoints,
  awardBadge,
  trackMilestone,
  calculatePointsFromRules,
} from "@/lib/gamification";
import { logActivity } from "@/lib/activity-log";

const assessmentSchema = z.object({
  activityTypeId: z.string().min(1),
  name: z.string().min(1, "Name is required"),
  assessorId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.string().optional(),
  loa: z.enum(["FirstLine", "SecondLine", "ThirdLine"]),
  status: z.enum(["Planned", "InProgress", "Completed", "Cancelled"]),
});

export async function createAssessment(formData: FormData) {
  const parsed = assessmentSchema.parse({
    activityTypeId: formData.get("activityTypeId")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    assessorId: formData.get("assessorId")?.toString() ?? "",
    startDate: formData.get("startDate")?.toString() ?? "",
    endDate: formData.get("endDate")?.toString() || undefined,
    loa: formData.get("loa")?.toString(),
    status: "Planned",
  });

  const assessment = await prisma.assessment.create({
    data: {
      activityTypeId: parsed.activityTypeId,
      name: parsed.name,
      assessorId: parsed.assessorId,
      startDate: parsed.startDate,
      endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
      loa: parsed.loa,
      status: parsed.status,
    },
  });

  // 🎮 Award gamification points for FLA planned
  try {
    const activityLogId = await logActivity({
      activityType: "FLA Planned",
      description: `Planned FLA: ${parsed.name}`,
      username: "system",
      refTable: "Assessment",
      refRecord: assessment.id,
    });

    const rewards = await calculatePointsFromRules("FLA Planned");
    for (const r of rewards) {
      await awardPoints(
        parsed.assessorId, r.points, "FLA Planned",
        undefined, assessment.id, undefined, 1.0,
        r.gameAttributeId, activityLogId,
      );
    }

    // Check if this is first FLA (for "Starter" badge)
    const assessmentCount = await prisma.assessment.count({
      where: { assessorId: parsed.assessorId },
    });

    if (assessmentCount === 1) {
      await awardBadge(parsed.assessorId, "Starter");
    }

    // Track FLA completion milestone
    await trackMilestone(
      parsed.assessorId,
      "flas_planned",
      "Plan FLAs",
      3
    );
  } catch (error) {
    console.error("Error awarding gamification points:", error);
    // Don't fail the assessment creation if gamification fails
  }

  revalidatePath("/fla");
  redirect(`/fla/${assessment.id}`);
}

const updateSchema = z.object({
  id: z.string().min(1),
  activityTypeId: z.string().min(1),
  name: z.string().min(1, "Name is required"),
  assessorId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.string().optional(),
  loa: z.enum(["FirstLine", "SecondLine", "ThirdLine"]),
  status: z.enum(["Planned", "InProgress", "Completed", "Cancelled"]),
});

export async function updateAssessment(formData: FormData) {
  const parsed = updateSchema.parse({
    id: formData.get("id")?.toString() ?? "",
    activityTypeId: formData.get("activityTypeId")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    assessorId: formData.get("assessorId")?.toString() ?? "",
    startDate: formData.get("startDate")?.toString() ?? "",
    endDate: formData.get("endDate")?.toString() || undefined,
    loa: formData.get("loa")?.toString(),
    status: formData.get("status")?.toString(),
  });

  // Get previous status to detect completion
  const previousAssessment = await prisma.assessment.findUnique({
    where: { id: parsed.id },
  });

  const assessment = await prisma.assessment.update({
    where: { id: parsed.id },
    data: {
      activityTypeId: parsed.activityTypeId,
      name: parsed.name,
      assessorId: parsed.assessorId,
      startDate: parsed.startDate,
      endDate: parsed.endDate ? new Date(parsed.endDate) : null,
      loa: parsed.loa,
      status: parsed.status,
    },
  });

  // 🎮 Award points if assessment was just completed
  if (previousAssessment?.status !== "Completed" && parsed.status === "Completed") {
    try {
      const activityLogId = await logActivity({
        activityType: "Complete Assessment",
        description: `Completed assessment: ${parsed.name}`,
        username: "system",
        refTable: "Assessment",
        refRecord: parsed.id,
      });

      // Count controls assigned to this assessment
      const controlAssignments = await prisma.controlAssignment.findMany({
        where: { assessmentId: parsed.id },
        include: { control: { select: { isHsseCritical: true } } },
      });
      const controlCount = controlAssignments.length;
      const hasHsseCritical = controlAssignments.some(ca => ca.control.isHsseCritical);

      // Check sample pass rate for quality score
      const samples = await prisma.sample.findMany({
        where: { assessmentId: parsed.id },
      });
      const passCount = samples.filter(s => s.conclusion === "Pass").length;
      const qualityScore = samples.length > 0 ? Math.round((passCount / samples.length) * 100) : 0;
      const allPass = samples.length > 0 && samples.every((s) => s.conclusion === "Pass");

      // Award points from rules
      const rewards = await calculatePointsFromRules("Complete Assessment", {
        controlCount,
        isHsseCritical: hasHsseCritical,
        qualityScore,
      });
      for (const r of rewards) {
        await awardPoints(
          parsed.assessorId, r.points, "Complete Assessment",
          undefined, parsed.id, undefined, 1.0,
          r.gameAttributeId, activityLogId,
        );
      }

      // Check for Perfect Assessor badge
      if (allPass && samples.length >= 5) {
        await awardBadge(parsed.assessorId, "Perfect Assessor");
      }

      // Track milestone
      await trackMilestone(
        parsed.assessorId,
        "assessments_completed",
        "Complete Assessments",
        3
      );
    } catch (error) {
      console.error("Error awarding completion points:", error);
    }
  }

  revalidatePath("/fla");
  revalidatePath(`/fla/${parsed.id}`);
}

export async function deleteAssessment(id: string) {
  await prisma.sample.deleteMany({ where: { assessmentId: id } });
  await prisma.assessment.delete({ where: { id } });
  revalidatePath("/fla");
  redirect("/fla");
}

const addSamplesSchema = z.object({
  assessmentId: z.string().min(1),
  controlIds: z.array(z.string()).min(1, "Select at least one Control"),
});

export async function addSamples(formData: FormData) {
  const assessmentId = formData.get("assessmentId")?.toString() ?? "";
  const controlIds = formData.getAll("controlIds").map((v) => v.toString());
  const parsed = addSamplesSchema.parse({ assessmentId, controlIds });

  await prisma.sample.createMany({
    data: parsed.controlIds.map((controlId) => ({
      assessmentId: parsed.assessmentId,
      controlId,
    })),
  });

  revalidatePath(`/fla/${assessmentId}`);
}

const updateSampleSchema = z.object({
  id: z.string().min(1),
  assessmentId: z.string().min(1),
  status: z.enum(["Tested", "NotTested"]),
  conclusion: z.enum(["Pass", "Fail"]).optional(),
  comment: z.string().optional(),
});

export async function updateSample(formData: FormData) {
  const conclusionRaw = formData.get("conclusion")?.toString();
  const parsed = updateSampleSchema.parse({
    id: formData.get("id")?.toString() ?? "",
    assessmentId: formData.get("assessmentId")?.toString() ?? "",
    status: formData.get("status")?.toString(),
    conclusion: conclusionRaw || undefined,
    comment: formData.get("comment")?.toString() || undefined,
  });

  // Get previous sample status
  const previousSample = await prisma.sample.findUnique({
    where: { id: parsed.id },
    include: {
      assessment: {
        include: { controlAssignments: { include: { control: true } } },
      },
    },
  });

  const sample = await prisma.sample.update({
    where: { id: parsed.id },
    data: {
      status: parsed.status,
      conclusion: parsed.status === "Tested" ? parsed.conclusion ?? null : null,
      comment: parsed.comment,
    },
  });

  // 🎮 Award points if sample was just marked as Tested
  if (
    previousSample?.status === "NotTested" &&
    parsed.status === "Tested"
  ) {
    try {
      const assessment = previousSample.assessment;

      // Check for HSSE-critical controls in this assessment
      const hasHsseCriticalControl = assessment.controlAssignments.some(
        (ca) => ca.control.isHsseCritical
      );

      // Calculate quality score (based on comment length as proxy)
      const qualityScore = parsed.comment ? Math.min(100, parsed.comment.length / 2) : 50;

      // Get assessor ID from assessment
      const assessor = await prisma.user.findUnique({
        where: { id: assessment.assessorId },
      });

      if (assessor) {
        const activityLogId = await logActivity({
          activityType: "Control Tested",
          description: `Tested sample ${parsed.id}`,
          username: assessor.name || "system",
          refTable: "Sample",
          refRecord: parsed.id,
        });

        const rewards = await calculatePointsFromRules("Control Tested", {
          controlCount: 1,
          isHsseCritical: hasHsseCriticalControl,
          qualityScore,
        });
        for (const r of rewards) {
          await awardPoints(
            assessor.id, r.points, "Control Tested",
            undefined, parsed.assessmentId, parsed.id, 1.0,
            r.gameAttributeId, activityLogId,
          );
        }

        // Check for "First Test" badge
        const sampleCount = await prisma.sample.count({
          where: { assessment: { assessorId: assessor.id }, status: "Tested" },
        });

        if (sampleCount === 1) {
          await awardBadge(assessor.id, "First Test");
        }

        // Track control testing milestone
        await trackMilestone(assessor.id, "controls_tested", "Test Controls", 10);

        // Check for Excellence badges
        if (
          parsed.comment &&
          parsed.comment.length > 200 &&
          parsed.conclusion === "Pass"
        ) {
          await awardBadge(assessor.id, "Quality Obsessed");
        }
      }
    } catch (error) {
      console.error("Error awarding control test points:", error);
      // Don't fail the sample update if gamification fails
    }
  }

  revalidatePath(`/fla/${parsed.assessmentId}`);
}

export async function deleteSample(id: string, assessmentId: string) {
  await prisma.sample.delete({ where: { id } });
  revalidatePath(`/fla/${assessmentId}`);
}

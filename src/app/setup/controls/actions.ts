"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  statement: z.string().min(1, "Control statement is required"),
  controlType: z.string(),
  processAreaId: z.string().min(1, "Process Area is required"),
  subProcessId: z.string().min(1, "Sub-Process is required"),
  isHsseCritical: z.boolean(),
  ramRating: z.string().optional(),
  riskWeight: z.coerce.number().int().min(1),
  sourceFile: z.string().optional(),
  controlRef: z.string().optional(),
  practiceDocument: z.string().optional(),
  controlTypeDetail: z.string().optional(),
  csfWho: z.string().optional(),
  csfWhat: z.string().optional(),
  csfWhen: z.string().optional(),
  csfWhere: z.string().optional(),
  csfWhy: z.string().optional(),
  csfHow: z.string().optional(),
  csfEvidence: z.string().optional(),
  keyActivities: z.string().optional(),
  riskAddressed: z.string().optional(),
  testingApproach: z.string().optional(),
  uncertainFlags: z.string().optional(),
  rawHealthScore: z.coerce.number().int().optional(),
  lastTestedDate: z.string().optional(),
  lastTestResult: z.string().optional(),
});

export async function saveControl(formData: FormData) {
  const id = formData.get("id")?.toString();
  const parsed = schema.parse({
    name: formData.get("name")?.toString() ?? "",
    statement: formData.get("statement")?.toString() ?? "",
    controlType: formData.get("controlType")?.toString(),
    processAreaId: formData.get("processAreaId")?.toString() ?? "",
    subProcessId: formData.get("subProcessId")?.toString() ?? "",
    isHsseCritical: formData.get("isHsseCritical") === "on",
    ramRating: formData.get("ramRating")?.toString() || undefined,
    riskWeight: formData.get("riskWeight")?.toString() || "1",
    sourceFile: formData.get("sourceFile")?.toString() || undefined,
    controlRef: formData.get("controlRef")?.toString() || undefined,
    practiceDocument: formData.get("practiceDocument")?.toString() || undefined,
    controlTypeDetail: formData.get("controlTypeDetail")?.toString() || undefined,
    csfWho: formData.get("csfWho")?.toString() || undefined,
    csfWhat: formData.get("csfWhat")?.toString() || undefined,
    csfWhen: formData.get("csfWhen")?.toString() || undefined,
    csfWhere: formData.get("csfWhere")?.toString() || undefined,
    csfWhy: formData.get("csfWhy")?.toString() || undefined,
    csfHow: formData.get("csfHow")?.toString() || undefined,
    csfEvidence: formData.get("csfEvidence")?.toString() || undefined,
    keyActivities: formData.get("keyActivities")?.toString() || undefined,
    riskAddressed: formData.get("riskAddressed")?.toString() || undefined,
    testingApproach: formData.get("testingApproach")?.toString() || undefined,
    uncertainFlags: formData.get("uncertainFlags")?.toString() || undefined,
    rawHealthScore: formData.get("rawHealthScore")?.toString() || undefined,
    lastTestedDate: formData.get("lastTestedDate")?.toString() || undefined,
    lastTestResult: formData.get("lastTestResult")?.toString() || undefined,
  });

  const data = {
    ...parsed,
    controlType: parsed.controlType as any,
  };

  if (id) {
    await prisma.control.update({ where: { id }, data });

    // Preserve existing ControlSubProcess junction links
    const linkedIds = formData.get("linkedSubProcessIds")?.toString();
    if (linkedIds !== undefined) {
      const subProcessIds = linkedIds ? linkedIds.split(",").filter(Boolean) : [];
      // Delete links no longer in the set
      await prisma.controlSubProcess.deleteMany({
        where: { controlId: id, subProcessId: { notIn: subProcessIds } },
      });
      // Upsert current links
      for (const spId of subProcessIds) {
        if (spId && spId !== data.subProcessId) {
          await prisma.controlSubProcess.upsert({
            where: { controlId_subProcessId: { controlId: id, subProcessId: spId } },
            create: { controlId: id, subProcessId: spId },
            update: {},
          });
        }
      }
    }
  } else {
    await prisma.control.create({ data });
  }

  revalidatePath("/setup/controls");
  redirect("/setup/controls");
}

export async function deleteControl(id: string) {
  try {
    await prisma.control.delete({ where: { id } });
  } catch {
    throw new Error("Cannot delete this Control — it still has Samples linked to it.");
  }
  revalidatePath("/setup/controls");
}

"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  defaultLOA: z.enum(["FirstLine", "SecondLine", "ThirdLine"]),
});

export async function saveActivityType(formData: FormData) {
  const id = formData.get("id")?.toString();
  const parsed = schema.parse({
    name: formData.get("name")?.toString() ?? "",
    description: formData.get("description")?.toString() || undefined,
    defaultLOA: formData.get("defaultLOA")?.toString(),
  });

  if (id) {
    await prisma.assuranceActivityType.update({ where: { id }, data: parsed });
  } else {
    await prisma.assuranceActivityType.create({ data: parsed });
  }

  revalidatePath("/setup/activity-types");
  redirect("/setup/activity-types");
}

export async function deleteActivityType(id: string) {
  try {
    await prisma.assuranceActivityType.delete({ where: { id } });
  } catch {
    throw new Error("Cannot delete this Activity Type — it still has Assessments linked to it.");
  }
  revalidatePath("/setup/activity-types");
}

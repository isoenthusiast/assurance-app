"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  processAreaId: z.string().min(1, "Process Area is required"),
});

export async function saveSubProcess(formData: FormData) {
  const id = formData.get("id")?.toString();
  const parsed = schema.parse({
    name: formData.get("name")?.toString() ?? "",
    description: formData.get("description")?.toString() || undefined,
    processAreaId: formData.get("processAreaId")?.toString() ?? "",
  });

  if (id) {
    await prisma.subProcess.update({ where: { id }, data: parsed });
  } else {
    await prisma.subProcess.create({ data: parsed });
  }

  revalidatePath("/setup/sub-processes");
  redirect("/setup/sub-processes");
}

export async function deleteSubProcess(id: string) {
  try {
    await prisma.subProcess.delete({ where: { id } });
  } catch {
    throw new Error("Cannot delete this Sub-Process — it still has Controls linked to it.");
  }
  revalidatePath("/setup/sub-processes");
}

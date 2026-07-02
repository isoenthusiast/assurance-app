"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export async function saveProcessArea(formData: FormData) {
  const id = formData.get("id")?.toString();
  const parsed = schema.parse({
    name: formData.get("name")?.toString() ?? "",
    description: formData.get("description")?.toString() || undefined,
  });

  if (id) {
    await prisma.processArea.update({ where: { id }, data: parsed });
  } else {
    await prisma.processArea.create({ data: parsed });
  }

  revalidatePath("/setup/process-areas");
  redirect("/setup/process-areas");
}

export async function deleteProcessArea(id: string) {
  try {
    await prisma.processArea.delete({ where: { id } });
  } catch {
    throw new Error(
      "Cannot delete this Process Area — it still has Sub-Processes or Controls linked to it."
    );
  }
  revalidatePath("/setup/process-areas");
}

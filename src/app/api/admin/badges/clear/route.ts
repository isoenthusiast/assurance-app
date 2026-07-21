import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";

export async function POST() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const result = await prisma.achievementBadge.deleteMany();
    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("Error clearing badges:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

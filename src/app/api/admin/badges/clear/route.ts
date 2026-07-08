import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as { role?: string }).role !== "Admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const result = await prisma.achievementBadge.deleteMany();
    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("Error clearing badges:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

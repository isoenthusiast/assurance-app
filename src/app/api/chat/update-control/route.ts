import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { name, statement, controlType, processAreaId, companyId } = body as {
      name: string;
      statement: string;
      controlType?: string;
      processAreaId: string;
      companyId?: string;
    };

    if (!name || !statement || !processAreaId) {
      return NextResponse.json({ error: "name, statement, and processAreaId are required" }, { status: 400 });
    }

    const newId = `ctrl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const username = (session.user as { name?: string }).name || "unknown";

    await prisma.$queryRawUnsafe(
      `INSERT INTO "Control" ("id", "name", "statement", "controlType", "processAreaId", "companyId", "createdAt", "rawHealthScore", "riskWeight", "isHsseCritical", "addedBy")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), 80, 1, false, $7)`,
      newId, name, statement, controlType || "Procedural", processAreaId, companyId || null, username
    );

    return NextResponse.json({
      success: true,
      controlId: newId,
      name,
    });
  } catch (error: any) {
    console.error("Update control error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

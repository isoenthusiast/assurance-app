import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Public endpoint — quick-add sample types and record source types
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { type, name } = await request.json();

    if (!name || !type) {
      return NextResponse.json({ error: "type and name required" }, { status: 400 });
    }

    let result;
    if (type === "sampleType") {
      result = await prisma.sampleType.create({ data: { name } });
    } else if (type === "recordSource") {
      result = await prisma.recordSourceType.create({ data: { name } });
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating reference type:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

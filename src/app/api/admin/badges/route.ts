import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireAdmin } from "@/lib/authz";

export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const badges = await prisma.achievementBadge.findMany({
      orderBy: { badgeName: "asc" },
    });

    return NextResponse.json(badges);
  } catch (error) {
    console.error("Error fetching badges:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const formData = await request.formData();

    const badgeName = formData.get("badgeName")?.toString() ?? "";
    const description = formData.get("description")?.toString() ?? "";
    const icon = formData.get("icon")?.toString() ?? "🏆";
    const emotionalDrive = formData.get("emotionalDrive")?.toString() ?? "Achievement";
    const rarity = formData.get("rarity")?.toString() ?? "Common";
    const pointsRequired = formData.get("pointsRequired") ? parseInt(formData.get("pointsRequired")!.toString()) : null;
    const controlsChecked = formData.get("controlsChecked") ? parseInt(formData.get("controlsChecked")!.toString()) : null;
    const streakDays = formData.get("streakDays") ? parseInt(formData.get("streakDays")!.toString()) : null;
    const achievementType = formData.get("achievementType")?.toString() ?? "";
    const level = formData.get("level")?.toString() || null;
    const processAreaId = formData.get("processAreaId")?.toString() || null;

    // Handle image upload
    let badgeImage: string | null = null;
    const imageFile = formData.get("badgeImage") as File | null;
    if (imageFile && imageFile.size > 0) {
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filename = `badge_${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const uploadDir = path.join(process.cwd(), "public", "images", "badges");
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, filename), buffer);
      badgeImage = `/images/badges/${filename}`;
    }

    const badge = await prisma.achievementBadge.create({
      data: {
        badgeName,
        description,
        icon,
        badgeImage,
        emotionalDrive: emotionalDrive as any,
        rarity: rarity as any,
        pointsRequired,
        controlsChecked,
        streakDays,
        achievementType,
        level,
        processAreaId,
      },
    });

    return NextResponse.json(badge, { status: 201 });
  } catch (error: any) {
    console.error("Error creating badge:", error);
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "A badge with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

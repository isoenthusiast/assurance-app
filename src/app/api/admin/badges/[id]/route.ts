import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as { role?: string }).role !== "Admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { id } = await params;
    const badge = await prisma.achievementBadge.findUnique({ where: { id } });
    if (!badge) {
      return NextResponse.json({ error: "Badge not found" }, { status: 404 });
    }
    return NextResponse.json(badge);
  } catch (error) {
    console.error("Error fetching badge:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as { role?: string }).role !== "Admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { id } = await params;
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

    // Handle image upload
    let badgeImage: string | null | undefined = undefined;
    const imageFile = formData.get("badgeImage") as File | null;
    const removeImage = formData.get("removeImage")?.toString() === "true";

    if (removeImage) {
      // Delete old image file
      const existing = await prisma.achievementBadge.findUnique({ where: { id } });
      if (existing?.badgeImage) {
        const oldPath = path.join(process.cwd(), "public", existing.badgeImage);
        try { await unlink(oldPath); } catch { /* ignore if file doesn't exist */ }
      }
      badgeImage = null;
    } else if (imageFile && imageFile.size > 0) {
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filename = `badge_${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const uploadDir = path.join(process.cwd(), "public", "images", "badges");
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, filename), buffer);
      badgeImage = `/images/badges/${filename}`;

      // Delete old image if exists
      const existing = await prisma.achievementBadge.findUnique({ where: { id } });
      if (existing?.badgeImage) {
        const oldPath = path.join(process.cwd(), "public", existing.badgeImage);
        try { await unlink(oldPath); } catch { /* ignore */ }
      }
    }

    const updateData: any = {
      badgeName,
      description,
      icon,
      emotionalDrive,
      rarity,
      pointsRequired,
      controlsChecked,
      streakDays,
      achievementType,
    };
    if (badgeImage !== undefined) {
      updateData.badgeImage = badgeImage;
    }

    const badge = await prisma.achievementBadge.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(badge);
  } catch (error: any) {
    console.error("Error updating badge:", error);
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "A badge with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as { role?: string }).role !== "Admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { id } = await params;

    // Delete image file if exists
    const existing = await prisma.achievementBadge.findUnique({ where: { id } });
    if (existing?.badgeImage) {
      const oldPath = path.join(process.cwd(), "public", existing.badgeImage);
      try { await unlink(oldPath); } catch { /* ignore */ }
    }

    await prisma.achievementBadge.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting badge:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

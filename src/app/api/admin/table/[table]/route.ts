import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

function generateId(): string {
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { table } = await params;
    const body = await request.json();

    // Add ID if not provided
    if (!body.id) {
      body.id = generateId();
    }

    // Add createdAt if not provided
    if (!body.createdAt) {
      body.createdAt = new Date();
    }

    try {
      let result: any;
      const camelName = table.charAt(0).toLowerCase() + table.slice(1);
      const model = (prisma as any)[camelName];

      if (!model) {
        return NextResponse.json({ error: `Unknown table: ${table}` }, { status: 404 });
      }

      // ControlAssignment: validate required fields + normalize effective
      if (table === 'ControlAssignment') {
        if (!body.assessmentId || !body.controlId) {
          return NextResponse.json(
            { error: 'assessmentId and controlId are required' },
            { status: 400 }
          );
        }
        const effectiveValue =
          body.effective === 'Effective' || body.effective === 'NotEffective'
            ? body.effective
            : null;
        result = await prisma.controlAssignment.create({
          data: {
            id: body.id,
            assessmentId: body.assessmentId,
            controlId: body.controlId,
            effective: effectiveValue,
            effectiveUpdatedAt: effectiveValue ? new Date() : null,
          },
        });
      } else {
        // User: hash password + set defaults
        if (table === "User") {
          if (body.password) {
            body.passwordHash = await bcrypt.hash(body.password, 10);
            delete body.password;
          } else {
            body.passwordHash = body.passwordHash || "";
          }
          body.name = body.name || "New User";
          body.username = body.username || `user_${Date.now()}`;
          body.role = body.role || "Assessor";
          body.totalPoints = body.totalPoints || 0;
          body.dailyPointStreak = body.dailyPointStreak || 0;
          body.confidenceInfluencer = body.confidenceInfluencer || false;
        }
        // Generic create — works for ANY Prisma model
        result = await model.create({ data: body });
      }

      return NextResponse.json(result, { status: 201 });
    } catch (dbError: any) {
      return NextResponse.json(
        { error: dbError.message || 'Database error' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error creating row:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

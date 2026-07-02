import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const isAdmin = session.user.role === "Admin" || session.user.email === "admin@example.com";

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, user: session.user.email });
  } catch (error) {
    console.error('Admin check error:', error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

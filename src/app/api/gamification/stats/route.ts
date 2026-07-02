import { NextRequest, NextResponse } from 'next/server';

/**
 * Fallback for when userId is not in the route
 * Redirects to user-specific endpoint
 */
export async function GET(req: NextRequest) {
  return NextResponse.json(
    { error: 'Please specify a userId in the URL: /api/gamification/stats/:userId' },
    { status: 400 }
  );
}

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const MASTER_COMPANY_ID = "SAMS001";

export type SessionUser = {
  id?: string;
  name?: string | null;
  role?: string;
};

/**
 * Require an authenticated admin session.
 * Returns the session or a 403 NextResponse.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    return { session: null, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  if (session.user.role !== "Admin") {
    return { session: null, response: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }
  return { session, response: null };
}

/**
 * Require an authenticated session (any role).
 * Returns the session or a 401 NextResponse.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    return { session: null, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  return { session, response: null };
}

/**
 * Return the selectedCompanyId cookie value, or null.
 */
export async function getSelectedCompanyId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get("selectedCompanyId")?.value || null;
  } catch {
    return null;
  }
}

/**
 * Check whether a user is assigned to a company via UserCompany.
 * Admins bypass this check (they can access all companies).
 */
export async function hasCompanyAccess(userId: string | undefined, companyId: string | null | undefined): Promise<boolean> {
  if (!userId || !companyId) return false;
  // Admins can access any company
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === "Admin") return true;

  const mapping = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  return !!mapping;
}

/**
 * Require that the selected company is accessible to the current user.
 * Returns the companyId or a 403 NextResponse.
 * If no company is selected, returns { companyId: null, response: null } — caller decides.
 */
export async function requireSelectedCompany(sessionUser: SessionUser) {
  const companyId = await getSelectedCompanyId();
  if (!companyId) {
    return { companyId: null, response: null };
  }
  const ok = await hasCompanyAccess(sessionUser.id, companyId);
  if (!ok) {
    return { companyId: null, response: NextResponse.json({ error: "Access denied for selected company" }, { status: 403 }) };
  }
  return { companyId, response: null };
}

/**
 * Build a Prisma WHERE clause for company-scoped tables.
 * If the user does not have access to the selected company, returns a denied response.
 */
export async function getCompanyWhere(sessionUser: SessionUser, tableField = "companyId") {
  const { companyId, response } = await requireSelectedCompany(sessionUser);
  if (response) return { where: null, response };
  if (!companyId) {
    // Non-admin users with no selected company should see nothing
    if (sessionUser.role !== "Admin") {
      return { where: { [tableField]: "__NO_ACCESS__" }, response: null };
    }
    // Admin with no selected company sees all companies
    return { where: {}, response: null };
  }
  return { where: { [tableField]: companyId }, response: null };
}

/**
 * Validate that a company ID from a request body is accessible to the user.
 */
export async function requireCompanyIdAccess(sessionUser: SessionUser, companyId: string | null | undefined) {
  if (!companyId) {
    return { response: NextResponse.json({ error: "Company ID required" }, { status: 400 }) };
  }
  const ok = await hasCompanyAccess(sessionUser.id, companyId);
  if (!ok) {
    return { response: NextResponse.json({ error: "Access denied for company" }, { status: 403 }) };
  }
  return { response: null };
}

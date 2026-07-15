/**
 * Server-side company context utilities.
 * 
 * Reads the selectedCompanyId cookie (set by CompanySelector client component)
 * and provides Prisma WHERE clauses for company-scoped queries.
 * 
 * Usage (in a server component or route handler):
 *   import { getCompanyFilter } from "@/lib/company-context";
 *   const where = { ...await getCompanyFilter(), ...otherFilters };
 *   const data = await prisma.processArea.findMany({ where });
 */

import { cookies } from "next/headers";

/** Name of the template/master company that contains baseline records */
export const MASTER_COMPANY_ID = "SAMS001";

/**
 * Returns a Prisma WHERE clause to filter by the currently selected company.
 * If no company is selected or the cookie is absent, returns an empty object
 * (no filtering — typically for admin "all companies" view).
 * 
 * @param tableField - The column name for companyId (defaults to "companyId")
 * @returns { companyId: string } | {}
 */
export async function getCompanyFilter(tableField = "companyId"): Promise<Record<string, string> | {}> {
  try {
    const cookieStore = await cookies();
    const selectedId = cookieStore.get("selectedCompanyId")?.value;
    if (selectedId) {
      return { [tableField]: selectedId };
    }
  } catch {
    // cookies() may throw in non-server contexts
  }
  return {};
}

/**
 * Returns the currently selected company ID from the cookie,
 * or null if none is selected.
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
 * Checks if a company is the master template company (SAMS001).
 * Only admin users should see/access SAMS001 data.
 */
export function isMasterCompany(companyIdOrCompanyID: string): boolean {
  return companyIdOrCompanyID === MASTER_COMPANY_ID;
}

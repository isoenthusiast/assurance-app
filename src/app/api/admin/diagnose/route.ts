import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getAllTableNames, getTableSchema } from "@/lib/schema-introspection";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const diagnostics: Record<string, any> = {
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // Check 1: Prisma client available
    try {
      diagnostics.checks.prismaClient = !!prisma;
      diagnostics.checks.prismaDmmf = !!(prisma as any)._dmmf;
    } catch (e) {
      diagnostics.checks.prismaClient = false;
      diagnostics.checks.prismaDmmf = false;
    }

    // Check 2: Get all table names
    try {
      const tables = getAllTableNames();
      diagnostics.checks.getAllTableNames = {
        success: true,
        count: tables.length,
        tables: tables.slice(0, 5), // First 5 for brevity
        allTables: tables,
      };
    } catch (e) {
      diagnostics.checks.getAllTableNames = {
        success: false,
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }

    // Check 3: Get Control schema
    try {
      const controlSchema = getTableSchema('Control');
      diagnostics.checks.controlSchema = {
        success: !!controlSchema,
        columnCount: controlSchema?.columns.length || 0,
        columnNames: controlSchema?.columns.map((c) => c.name) || [],
      };
    } catch (e) {
      diagnostics.checks.controlSchema = {
        success: false,
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }

    // Check 4: Direct DMMF access
    try {
      const dmmf = (prisma as any)._dmmf;
      diagnostics.checks.directDmmf = {
        available: !!dmmf,
        hasDatamodel: !!dmmf?.datamodel,
        modelCount: dmmf?.datamodel?.models?.length || 0,
        models: dmmf?.datamodel?.models?.map((m: any) => m.name).slice(0, 5) || [],
      };
    } catch (e) {
      diagnostics.checks.directDmmf = {
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }

    return NextResponse.json(diagnostics);
  } catch (error) {
    console.error('Diagnostic error:', error);
    return NextResponse.json(
      { error: 'Diagnostic failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

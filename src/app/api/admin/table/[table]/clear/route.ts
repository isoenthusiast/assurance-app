import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
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

    const { table: tableName } = await params;

    // Validate table name (prevent SQL injection)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return NextResponse.json(
        { error: 'Invalid table name' },
        { status: 400 }
      );
    }

    console.log(`🗑️ Starting DROP and RECREATE for table: ${tableName}`);

    // Get the CREATE TABLE DDL from sqlite_master
    let createTableSql: string;
    try {
      const result = await (prisma as any).$queryRawUnsafe(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'`
      );

      if (!result || result.length === 0) {
        return NextResponse.json(
          { error: `Table '${tableName}' not found` },
          { status: 404 }
        );
      }

      createTableSql = (result[0] as any).sql;
      if (!createTableSql) {
        return NextResponse.json(
          { error: `Could not retrieve CREATE TABLE statement for '${tableName}'` },
          { status: 500 }
        );
      }
      console.log(`✅ Retrieved CREATE TABLE DDL for ${tableName}`);
    } catch (queryError: any) {
      console.error('Failed to retrieve table schema:', queryError);
      return NextResponse.json(
        { error: 'Failed to retrieve table schema', details: queryError.message },
        { status: 500 }
      );
    }

    // Drop the table
    try {
      // Disable foreign keys, drop, and re-enable
      await (prisma as any).$executeRawUnsafe(`PRAGMA foreign_keys=OFF`);
      await (prisma as any).$executeRawUnsafe(
        `DROP TABLE IF EXISTS "${tableName}"`
      );
      await (prisma as any).$executeRawUnsafe(`PRAGMA foreign_keys=ON`);
      console.log(`✅ Dropped table ${tableName}`);
    } catch (dropError: any) {
      console.error('Failed to drop table:', dropError);
      return NextResponse.json(
        { error: 'Failed to drop table', details: dropError.message },
        { status: 500 }
      );
    }

    // Recreate the table with the same schema
    try {
      await (prisma as any).$executeRawUnsafe(createTableSql);
      console.log(`✅ Recreated table ${tableName}`);
    } catch (recreateError: any) {
      console.error('Failed to recreate table:', recreateError);
      return NextResponse.json(
        { error: 'Failed to recreate table', details: recreateError.message },
        { status: 500 }
      );
    }

    // VACUUM to reclaim space and clear cache
    try {
      await (prisma as any).$executeRawUnsafe('VACUUM');
      console.log(`✅ VACUUM completed - cache cleared`);
    } catch (vacuumError: any) {
      console.warn('⚠️ VACUUM warning (non-critical):', vacuumError.message);
      // Don't fail - VACUUM is non-critical
    }

    return NextResponse.json({
      success: true,
      message: `Table '${tableName}' cleared successfully (${0} rows)`,
      details: 'Table dropped, recreated with clean schema, and cache cleared via VACUUM',
    });
  } catch (error) {
    console.error('Error clearing table:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

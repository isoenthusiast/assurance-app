import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getTableSchema, convertToAdminFormat } from "@/lib/schema-introspection";
import { getFallbackSchema } from "@/lib/fallback-schemas";
import { exec } from "child_process";
import { promises as fs } from "fs";
import path from "path";

interface Column {
  name: string;
  type: string;
  required: boolean;
  isId: boolean;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { table } = await params;

    try {
      // Get columns from actual database (SQLite PRAGMA table_info)
      let dbColumns: any[] = [];
      try {
        const result = await (prisma as any).$queryRaw`PRAGMA table_info(${table})`;
        dbColumns = result || [];
      } catch (dbError) {
        console.warn(`Could not query database for table ${table}:`, dbError);
      }

      // Convert DB columns to our format
      let schema: Record<string, { type: string; required: boolean; isId: boolean }> = {};

      if (dbColumns.length > 0) {
        // Database is master source of truth
        schema = Object.fromEntries(
          dbColumns.map((col: any) => [
            col.name,
            {
              type: col.type.split('(')[0], // Remove length specs like "String(255)"
              required: col.notnull === 1,
              isId: col.pk === 1,
            },
          ])
        );
        console.log(`✅ Using database columns for table ${table}`);
      } else {
        // Fall back to schema if database query failed
        console.warn(`No database columns found for ${table}, using schema fallback`);

        const tableSchema = getTableSchema(table);
        if (tableSchema) {
          schema = convertToAdminFormat(tableSchema);
        } else {
          schema = await getFallbackSchema(table) || {};
        }
      }

      if (Object.keys(schema).length === 0) {
        console.warn('No schema found for table:', table);
        return NextResponse.json({ error: 'Table not found' }, { status: 404 });
      }

      const columns: Column[] = Object.entries(schema).map(([name, config]) => ({
        name,
        type: config.type,
        required: config.required,
        isId: config.isId,
      }));

      return NextResponse.json({
        name: table,
        columns: columns.sort((a, b) => {
          if (a.isId) return -1;
          if (b.isId) return 1;
          return a.name.localeCompare(b.name);
        }),
      });
    } catch (schemaError) {
      console.error('Error processing schema for table:', table, schemaError);
      return NextResponse.json(
        { error: 'Error processing table schema', table },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error fetching columns:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function execPromise(command: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
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

    const { name, type, required } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      );
    }

    // Validate column name and type
    const validTypes = ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return NextResponse.json(
        { error: 'Column name must be alphanumeric and start with letter or underscore' },
        { status: 400 }
      );
    }

    // Read the Prisma schema file
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
    let schemaContent = await fs.readFile(schemaPath, 'utf-8');

    // Find the model definition
    const modelRegex = new RegExp(`(model\\s+${table}\\s*\\{[^}]*)\\n(\\s*\\})`);
    const match = schemaContent.match(modelRegex);

    if (!match) {
      return NextResponse.json(
        { error: `Model '${table}' not found in schema` },
        { status: 404 }
      );
    }

    const modelContent = match[1];

    // Check if column already exists
    if (new RegExp(`\\n\\s+${name}\\s+`).test(modelContent)) {
      return NextResponse.json(
        { error: `Column '${name}' already exists in ${table} model` },
        { status: 400 }
      );
    }

    // Create the new column definition with proper spacing
    const nullableSuffix = required ? '' : '?';
    const newColumnDef = `  ${name}          ${type}${nullableSuffix}`;

    // Replace by inserting new column before closing brace
    const newSchemaContent = schemaContent.replace(
      modelRegex,
      `$1\n${newColumnDef}\n$2`
    );

    // Write updated schema to file
    await fs.writeFile(schemaPath, newSchemaContent, 'utf-8');
    console.log(`✅ Schema file updated: Added '${name}' to ${table} model`);

    // Update fallback schema JSON file
    try {
      const fallbackJsonPath = path.join(process.cwd(), 'src', 'lib', 'fallback-schemas.json');
      const jsonContent = await fs.readFile(fallbackJsonPath, 'utf-8');
      const schemas = JSON.parse(jsonContent);

      if (schemas[table]) {
        // Add the new column to the schema
        schemas[table][name] = {
          type: type,
          required: required,
          isId: false
        };

        // Write updated JSON file
        await fs.writeFile(
          fallbackJsonPath,
          JSON.stringify(schemas, null, 2),
          'utf-8'
        );
        console.log(`✅ Fallback schema JSON updated for ${table}`);
      } else {
        console.warn(`⚠️ Could not find table ${table} in fallback schema JSON`);
      }
    } catch (fallbackError: any) {
      console.warn(`⚠️ Could not update fallback schema: ${fallbackError.message}`);
      // Don't fail - this is not critical
    }

    // Run migration
    const migrationName = `add_${name}_to_${table.toLowerCase()}`;
    let migrationSuccess = false;
    try {
      await execPromise(`npx prisma migrate dev --name ${migrationName}`);
      migrationSuccess = true;
      console.log(`✅ Database migration completed: ${migrationName}`);
    } catch (migrationError: any) {
      // Restore both schema files on migration failure
      await fs.writeFile(schemaPath, schemaContent, 'utf-8');
      console.error('❌ Migration failed:', migrationError);
      return NextResponse.json(
        { error: `Migration failed: ${migrationError.stderr || migrationError.error?.message}` },
        { status: 500 }
      );
    }

    // Regenerate Prisma client
    try {
      await execPromise('npx prisma generate');
      console.log(`✅ Prisma client regenerated`);
    } catch (genError: any) {
      console.error('⚠️ Client generation warning:', genError);
      // Don't fail - schema is already migrated
    }

    // Verify column was added to database
    let verificationMessage = '';
    try {
      const dbCheck = await (prisma as any).$queryRaw`PRAGMA table_info(${table})`;
      const columnExists = (dbCheck as any[])?.some((col: any) => col.name === name);
      if (columnExists) {
        console.log(`✅ Verified: Column '${name}' exists in database`);
        verificationMessage = 'Column verified in database.';
      } else {
        console.warn(`⚠️ Column '${name}' not found in database after migration`);
        verificationMessage = 'Warning: Column not verified in database.';
      }
    } catch (verifyError) {
      console.warn('Could not verify column in database:', verifyError);
    }

    return NextResponse.json({
      success: true,
      message: `Column '${name}' (${type}${required ? ', required' : ''}) successfully added to ${table}!`,
      details: `Schema updated, migration applied, Prisma client regenerated. ${verificationMessage}`
    });
  } catch (error) {
    console.error('Error adding column:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    const { table } = await params;

    // Get column name from URL path
    const url = new URL(request.url);
    const columnName = url.pathname.split('/').pop();

    if (!columnName) {
      return NextResponse.json(
        { error: 'Column name is required' },
        { status: 400 }
      );
    }

    // Read the Prisma schema file
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
    let schemaContent = await fs.readFile(schemaPath, 'utf-8');

    // Find and remove the column from schema
    const columnRegex = new RegExp(`\\n\\s+${columnName}\\s+\\w+[\\w\\?]*\\s*\\n`, 'm');
    if (!columnRegex.test(schemaContent)) {
      return NextResponse.json(
        { error: `Column '${columnName}' not found in ${table} model` },
        { status: 404 }
      );
    }

    const newSchemaContent = schemaContent.replace(columnRegex, '\n');
    await fs.writeFile(schemaPath, newSchemaContent, 'utf-8');
    console.log(`✅ Schema file updated: Removed '${columnName}' from ${table} model`);

    // Update fallback schema
    try {
      const fallbackJsonPath = path.join(process.cwd(), 'src', 'lib', 'fallback-schemas.json');
      const jsonContent = await fs.readFile(fallbackJsonPath, 'utf-8');
      const schemas = JSON.parse(jsonContent);

      if (schemas[table] && schemas[table][columnName]) {
        delete schemas[table][columnName];
        await fs.writeFile(
          fallbackJsonPath,
          JSON.stringify(schemas, null, 2),
          'utf-8'
        );
        console.log(`✅ Fallback schema updated: Removed '${columnName}'`);
      }
    } catch (fallbackError: any) {
      console.warn(`⚠️ Could not update fallback schema: ${fallbackError.message}`);
    }

    // Run migration
    const migrationName = `remove_${columnName}_from_${table.toLowerCase()}`;
    try {
      await execPromise(`npx prisma migrate dev --name ${migrationName}`);
      console.log(`✅ Database migration completed: ${migrationName}`);
    } catch (migrationError: any) {
      // Restore schema on migration failure
      await fs.writeFile(schemaPath, schemaContent, 'utf-8');
      console.error('❌ Migration failed:', migrationError);
      return NextResponse.json(
        { error: `Migration failed: ${migrationError.stderr || migrationError.error?.message}` },
        { status: 500 }
      );
    }

    // Regenerate Prisma client
    try {
      await execPromise('npx prisma generate');
      console.log(`✅ Prisma client regenerated`);
    } catch (genError: any) {
      console.error('⚠️ Client generation warning:', genError);
    }

    // Verify column was removed from database
    let verificationMessage = '';
    try {
      const dbCheck = await (prisma as any).$queryRaw`PRAGMA table_info(${table})`;
      const columnExists = (dbCheck as any[])?.some((col: any) => col.name === columnName);
      if (!columnExists) {
        console.log(`✅ Verified: Column '${columnName}' removed from database`);
        verificationMessage = 'Column verified removed from database.';
      } else {
        console.warn(`⚠️ Column '${columnName}' still exists in database after migration`);
        verificationMessage = 'Warning: Column still exists in database.';
      }
    } catch (verifyError) {
      console.warn('Could not verify column removal in database:', verifyError);
    }

    return NextResponse.json({
      success: true,
      message: `Column '${columnName}' successfully removed from ${table}!`,
      details: `Schema updated, migration applied, Prisma client regenerated. ${verificationMessage}`
    });
  } catch (error) {
    console.error('Error deleting column:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

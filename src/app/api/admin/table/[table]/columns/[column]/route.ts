import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";

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

const VALID_TYPES = ["String", "Int", "Float", "Boolean", "DateTime", "Json"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ table: string; column: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "Admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { table, column } = await params;
    const body = await request.json();
    const { type } = body;

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (column === "id") {
      return NextResponse.json(
        { error: "Cannot modify primary key column" },
        { status: 400 }
      );
    }

    // Read and update the Prisma schema
    const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
    let schemaContent = await fs.readFile(schemaPath, "utf-8");

    // Find the model definition
    const modelRegex = new RegExp(`(model\\s+${table}\\s*\\{[^}]*)\\n(\\s*\\})`, "s");
    const match = schemaContent.match(modelRegex);

    if (!match) {
      return NextResponse.json(
        { error: `Model '${table}' not found in schema` },
        { status: 404 }
      );
    }

    const modelBlock = match[1];
    // Match the column line: optional whitespace + column name + whitespace + type + ?
    const colRegex = new RegExp(`(\\n\\s+${column}\\s+)\\w+(\\??)`, "g");

    if (!colRegex.test(modelBlock)) {
      return NextResponse.json(
        { error: `Column '${column}' not found in model '${table}'` },
        { status: 404 }
      );
    }

    const oldSchemaContent = schemaContent;
    schemaContent = schemaContent.replace(
      new RegExp(`(\\n\\s+${column}\\s+)\\w+(\\??)`, "g"),
      `$1${type}$2`
    );

    await fs.writeFile(schemaPath, schemaContent, "utf-8");

    // Run migration
    const migrationName = `update_${column}_type_in_${table.toLowerCase()}`;
    try {
      await execPromise(`npx prisma migrate dev --name ${migrationName}`);
    } catch (migrationError: any) {
      await fs.writeFile(schemaPath, oldSchemaContent, "utf-8");
      return NextResponse.json(
        { error: `Migration failed: ${migrationError.stderr || migrationError.error?.message}` },
        { status: 500 }
      );
    }

    // Regenerate client
    try {
      await execPromise("npx prisma generate");
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ success: true, type });
  } catch (error) {
    console.error("Error updating column:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ table: string; column: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "Admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { table, column } = await params;

    if (column === "id") {
      return NextResponse.json(
        { error: "Cannot delete primary key column" },
        { status: 400 }
      );
    }

    // Read and update the Prisma schema
    const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
    let schemaContent = await fs.readFile(schemaPath, "utf-8");

    // Remove the column line from the model
    const colRegex = new RegExp(`\\n\\s+${column}\\s+\\w+\\??\\n`, "g");
    const oldSchemaContent = schemaContent;
    schemaContent = schemaContent.replace(colRegex, "\n");

    if (schemaContent === oldSchemaContent) {
      return NextResponse.json(
        { error: `Column '${column}' not found in model '${table}'` },
        { status: 404 }
      );
    }

    await fs.writeFile(schemaPath, schemaContent, "utf-8");

    // Run migration
    const migrationName = `drop_${column}_from_${table.toLowerCase()}`;
    try {
      await execPromise(`npx prisma migrate dev --name ${migrationName}`);
    } catch (migrationError: any) {
      await fs.writeFile(schemaPath, oldSchemaContent, "utf-8");
      return NextResponse.json(
        { error: `Migration failed: ${migrationError.stderr || migrationError.error?.message}` },
        { status: 500 }
      );
    }

    // Regenerate client
    try {
      await execPromise("npx prisma generate");
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting column:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

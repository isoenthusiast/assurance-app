import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

/**
 * Get the primary key field name for a model.
 * Most models use "id", but Requirement uses "rId".
 */
function getPkField(table: string): string {
  if (table === "Requirement") return "rId";
  return "id";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "Admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const { table, id } = await params;
    const camelName = table.charAt(0).toLowerCase() + table.slice(1);
    const model = (prisma as any)[camelName];
    const pkField = getPkField(table);
    const pkValue = pkField === "rId" ? parseInt(id, 10) : id;

    let record: any = null;
    if (model) {
      const where: any = {};
      where[pkField] = pkValue;
      record = await model.findUnique({ where });
    } else {
      // Raw SQL fallback for models not accessible via Proxy
      const rows = await (prisma as any).$queryRawUnsafe(
        `SELECT * FROM "${table}" WHERE "${pkField}" = $1 LIMIT 1`,
        pkValue
      );
      record = Array.isArray(rows) ? rows[0] : null;
    }

    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(record);
  } catch (error: any) {
    console.error(`Error fetching ${table}/${id}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Check for child records that would block deletion
 */
async function checkForChildren(table: string, id: string): Promise<{ blocked: boolean; children: any[] }> {
  const children: any[] = [];

  try {
    if (table === "ProcessArea") {
      const subProcesses = await prisma.subProcess.findMany({
        where: { processAreaId: id },
        select: { id: true, name: true },
      });
      if (subProcesses.length > 0) {
        children.push({ type: "SubProcess", count: subProcesses.length, records: subProcesses });
      }

      const controls = await prisma.control.findMany({
        where: { processAreaId: id },
        select: { id: true, name: true },
      });
      if (controls.length > 0) {
        children.push({ type: "Control", count: controls.length, records: controls });
      }
    } else if (table === "SubProcess") {
      const junctionLinks = await prisma.controlSubProcess.findMany({
        where: { subProcessId: id },
        select: { id: true, controlId: true },
      });
      if (junctionLinks.length > 0) {
        children.push({ type: "Control (via junction)", count: junctionLinks.length, records: junctionLinks });
      }
    } else if (table === "Control") {
      const controlAssignments = await prisma.controlAssignment.findMany({
        where: { controlId: id },
        select: { id: true, assessmentId: true },
      });
      if (controlAssignments.length > 0) {
        children.push({ type: "ControlAssignment", count: controlAssignments.length, records: controlAssignments });
      }
      const junctionLinks = await prisma.controlSubProcess.findMany({
        where: { controlId: id },
        select: { id: true, subProcessId: true },
      });
      if (junctionLinks.length > 0) {
        children.push({ type: "ControlSubProcess (junction links)", count: junctionLinks.length, records: junctionLinks });
      }
    } else if (table === "Assessment") {
      const samples = await prisma.sample.findMany({
        where: { assessmentId: id },
        select: { id: true, recordReference: true },
      });
      if (samples.length > 0) {
        children.push({ type: "Sample", count: samples.length, records: samples });
      }

      const controlAssignments = await prisma.controlAssignment.findMany({
        where: { assessmentId: id },
        select: { id: true, controlId: true },
      });
      if (controlAssignments.length > 0) {
        children.push({ type: "ControlAssignment", count: controlAssignments.length, records: controlAssignments });
      }
    }
  } catch (err) {
    console.warn("Error checking for children:", err);
  }

  return {
    blocked: children.length > 0,
    children,
  };
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  const deleteParams = await params;
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "Admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { table, id } = deleteParams;
    const url = new URL(request.url);
    const cascade = url.searchParams.get("cascade") === "true";

    if (!id) {
      return NextResponse.json(
        { error: "Row ID is required" },
        { status: 400 }
      );
    }

    // Check for children first
    const childCheck = await checkForChildren(table, id);
    if (childCheck.blocked && !cascade) {
      return NextResponse.json(
        {
          error: "Cannot delete: row has dependent records",
          blocked: true,
          children: childCheck.children,
          message: `This ${table} has ${childCheck.children.map(c => `${c.count} ${c.type}(s)`).join(" and ")}. Delete them first?`,
        },
        { status: 409 } // Conflict status
      );
    }

    // If cascade is true, delete all children first
    if (cascade && childCheck.blocked) {
      for (const childGroup of childCheck.children) {
        for (const child of childGroup.records) {
          // Recursively delete children
          const childUrl = new URL(request.url);
          childUrl.pathname = `/api/admin/table/${childGroup.type}/${child.id}`;
          childUrl.searchParams.set("cascade", "true");

          await fetch(childUrl.toString(), {
            method: "DELETE",
            headers: request.headers,
          });
        }
      }
    }

    let result: any = null;

    // Generic delete — works for any Prisma model
    const camelName = table.charAt(0).toLowerCase() + table.slice(1);
    const model = (prisma as any)[camelName];
    if (!model) {
      return NextResponse.json(
        { error: `Table '${table}' not supported` },
        { status: 400 }
      );
    }
    result = await model.delete({ where: { id } });

    return NextResponse.json({ success: true, deleted: result });
  } catch (error: any) {
    console.error(`Error deleting from ${deleteParams.table}:`, error);
    
    // Handle specific errors
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Row not found" },
        { status: 404 }
      );
    }
    
    if (error.code === "P2003") {
      return NextResponse.json(
        { error: "Cannot delete: row is referenced by other records" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to delete row" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  const putParams = await params;
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "Admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { table, id } = putParams;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Row ID is required" },
        { status: 400 }
      );
    }

    let result: any = null;

    // Generic update — works for any Prisma model.
    // Strip computed display fields (ControlID) before passing to Prisma.
    if (table === 'ControlAssignment') {
      delete body.ControlID;
      const effectiveValue =
          body.effective === "Effective" || body.effective === "NotEffective"
            ? body.effective
            : null;
      result = await prisma.controlAssignment.update({
        where: { id },
        data: {
          ...(body.assessmentId !== undefined ? { assessmentId: body.assessmentId } : {}),
          ...(body.controlId !== undefined ? { controlId: body.controlId } : {}),
          effective: effectiveValue,
          effectiveUpdatedAt: effectiveValue ? new Date() : null,
        },
      });
    } else {
      // User: hash password before storing
      if (table === "User" && body.password) {
        body.passwordHash = await bcrypt.hash(body.password, 10);
        delete body.password;
      }
      const camelName = table.charAt(0).toLowerCase() + table.slice(1);
      const model = (prisma as any)[camelName];
      if (!model) {
        // Raw SQL fallback for models not accessible via Proxy (e.g. Requirement)
        const pkField = getPkField(table);
        // Map Prisma field names → DB column names (handles @map directives)
        const fieldToCol: Record<string, string> = {
          rId: "rID", pId: "pID",
        };
        const pkValue = pkField === "rId" ? parseInt(id, 10) : id;
        const dbPkCol = fieldToCol[pkField] || pkField;
        const setClauses: string[] = [];
        const values: any[] = [];
        let paramIdx = 1;
        for (const [key, val] of Object.entries(body)) {
          // Skip PK fields and auto-generated fields
          if (key === "rId" || key === "rID" || key === "id" || key === "createdAt") continue;
          const colName = fieldToCol[key] || key;
          setClauses.push(`"${colName}" = $${paramIdx}`);
          values.push(val);
          paramIdx++;
        }
        values.push(pkValue);
        if (setClauses.length === 0) {
          return NextResponse.json({ error: "No fields to update" }, { status: 400 });
        }
        const sql = `UPDATE "${table}" SET ${setClauses.join(", ")} WHERE "${dbPkCol}" = $${paramIdx} RETURNING *`;
        const rows = await (prisma as any).$queryRawUnsafe(sql, ...values);
        result = Array.isArray(rows) ? rows[0] : rows;
      } else {
        const pkField = getPkField(table);
        const pkValue = pkField === "rId" ? parseInt(id, 10) : id;
        const where: any = {};
        where[pkField] = pkValue;
        result = await model.update({ where, data: body });
      }
    }

    return NextResponse.json({ success: true, updated: result });
  } catch (error: any) {
    console.error(`Error updating ${putParams.table}:`, error);
    
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Row not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to update row" },
      { status: 500 }
    );
  }
}

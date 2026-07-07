import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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
      const controls = await prisma.control.findMany({
        where: { subProcessId: id },
        select: { id: true, name: true },
      });
      if (controls.length > 0) {
        children.push({ type: "Control", count: controls.length, records: controls });
      }
      const junctionLinks = await prisma.controlSubProcess.findMany({
        where: { subProcessId: id },
        select: { id: true, controlId: true },
      });
      if (junctionLinks.length > 0) {
        children.push({ type: "ControlSubProcess (junction links)", count: junctionLinks.length, records: junctionLinks });
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

    // Handle deletion by table name
    switch (table) {
      case "User":
        result = await prisma.user.delete({ where: { id } });
        break;
      case "ProcessArea":
        result = await prisma.processArea.delete({ where: { id } });
        break;
      case "SubProcess":
        result = await prisma.subProcess.delete({ where: { id } });
        break;
      case "Control":
        result = await prisma.control.delete({ where: { id } });
        break;
      case "Assessment":
        result = await prisma.assessment.delete({ where: { id } });
        break;
      case "ControlAssignment":
        result = await prisma.controlAssignment.delete({ where: { id } });
        break;
      case "Sample":
        result = await prisma.sample.delete({ where: { id } });
        break;
      case "AssuranceActivityType":
        result = await prisma.assuranceActivityType.delete({ where: { id } });
        break;
      case "SampleType":
        result = await prisma.sampleType.delete({ where: { id } });
        break;
      case "RecordSourceType":
        result = await prisma.recordSourceType.delete({ where: { id } });
        break;
      default:
        return NextResponse.json(
          { error: `Table '${table}' not supported` },
          { status: 400 }
        );
    }

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

    // Handle update by table name
    switch (table) {
      case "User":
        result = await prisma.user.update({ where: { id }, data: body });
        break;
      case "ProcessArea":
        result = await prisma.processArea.update({ where: { id }, data: body });
        break;
      case "SubProcess":
        result = await prisma.subProcess.update({ where: { id }, data: body });
        break;
      case "Control":
        result = await prisma.control.update({ where: { id }, data: body });
        break;
      case "Assessment":
        result = await prisma.assessment.update({ where: { id }, data: body });
        break;
      case "ControlAssignment": {
        // Explicit allowlist: the table viewer's row objects also carry a
        // computed "ControlID" display field (and other non-editable
        // columns) that don't exist on the model — passing the raw body
        // straight through would throw an Unknown argument error.
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
        break;
      }
      case "Sample":
        result = await prisma.sample.update({ where: { id }, data: body });
        break;
      case "AssuranceActivityType":
        result = await prisma.assuranceActivityType.update({ where: { id }, data: body });
        break;
      case "SampleType":
        result = await prisma.sampleType.update({ where: { id }, data: body });
        break;
      case "RecordSourceType":
        result = await prisma.recordSourceType.update({ where: { id }, data: body });
        break;
      default:
        return NextResponse.json(
          { error: `Table '${table}' not supported` },
          { status: 400 }
        );
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

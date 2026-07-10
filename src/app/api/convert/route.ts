import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import path from "path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

// ── .docx → Markdown ─────────────────────────────────────────────────

async function docxToMarkdown(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToMarkdown({ buffer });
  return result.value;
}

// ── .pdf → Markdown ──────────────────────────────────────────────────

async function pdfToMarkdown(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  const lines: string[] = [];

  lines.push(`# ${data.info?.Title || "PDF Document"}\n`);

  // Split into pages (pdf-parse doesn't always paginate cleanly, but
  // it adds form-feed characters for page breaks when available)
  const pages = data.text.split("\f");
  const pageCount = data.numpages || pages.length;

  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i].trim();
    if (!pageText) continue;
    if (pageCount > 1) {
      lines.push(`## Page ${i + 1}\n`);
    }
    lines.push(pageText);
  }

  return lines.join("\n\n");
}

// ── POST handler ─────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const saveToKB = formData.get("saveToKnowledgebase")?.toString() === "true";
    const remarks = formData.get("remarks")?.toString() || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (![".docx", ".pdf"].includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported format '${ext}'. Please upload .docx or .pdf files.` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Convert using Node.js (works everywhere: local, Railway, Docker)
    let markdown: string;
    try {
      if (ext === ".docx") {
        markdown = await docxToMarkdown(buffer);
      } else {
        markdown = await pdfToMarkdown(buffer);
      }
    } catch (convError: any) {
      console.error("Conversion error:", convError);
      return NextResponse.json(
        { error: "Conversion failed", details: convError.message },
        { status: 500 }
      );
    }

    if (!markdown || !markdown.trim()) {
      return NextResponse.json(
        { error: "No text content extracted. The file may be empty or scanned (OCR not yet supported)." },
        { status: 422 }
      );
    }

    const originalName = file.name.replace(ext, "");
    const mdFileName = `${originalName}.md`;

    // Optionally save to Knowledgebase
    let kbRecord = null;
    if (saveToKB) {
      const username = (session.user as { name?: string }).name || "unknown";
      kbRecord = await prisma.knowledgebase.create({
        data: {
          knowledgeName: originalName,
          knowledgeContent: markdown,
          remarks,
          addedBy: username,
        },
      });
    }

    return NextResponse.json({
      success: true,
      markdown,
      fileName: mdFileName,
      sourceFileName: file.name,
      sourceSize: file.size,
      mdLength: markdown.length,
      ...(kbRecord ? { knowledgebaseId: kbRecord.kID } : {}),
    });
  } catch (error) {
    console.error("Conversion error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

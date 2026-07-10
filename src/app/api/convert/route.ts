import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import path from "path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { createWorker } from "tesseract.js";
import { createCanvas } from "@napi-rs/canvas";

// ── .docx → Markdown ─────────────────────────────────────────────────

async function docxToMarkdown(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToMarkdown({ buffer });
  return result.value;
}

// ── PDF text extraction (fast path) ───────────────────────────────────

function formatTextPages(
  pages: string[],
  meta: { numpages: number; info?: { Title?: string } }
): string {
  const lines: string[] = [];
  lines.push(`# ${meta.info?.Title || "PDF Document"}\n`);

  for (let i = 0; i < pages.length; i++) {
    const text = pages[i].trim();
    if (!text) continue;
    if (meta.numpages > 1) {
      lines.push(`## Page ${i + 1}\n`);
    }
    lines.push(text);
  }

  return lines.join("\n\n");
}

// ── OCR path (scanned PDFs) ──────────────────────────────────────────

const OCR_TEXT_THRESHOLD = 80; // avg chars per page below which we try OCR
let _ocrAvailable: boolean | null = null;

async function isOcrAvailable(): Promise<boolean> {
  if (_ocrAvailable !== null) return _ocrAvailable;
  try {
    // Quick smoke test: can we create a canvas and OCR a tiny image?
    const canvas = createCanvas(50, 20);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 50, 20);
    ctx.fillStyle = "#000000";
    ctx.font = "12px sans-serif";
    ctx.fillText("Test", 2, 14);
    const png = canvas.toBuffer("image/png");

    const worker = await createWorker("eng");
    const { data } = await worker.recognize(png);
    await worker.terminate();

    _ocrAvailable = data.text.trim().length > 0;
  } catch {
    _ocrAvailable = false;
  }
  return _ocrAvailable;
}

async function ocrPdfToMarkdown(
  buffer: Buffer,
  textMeta: { numpages: number; info?: { Title?: string } }
): Promise<string> {
  // Check OCR availability first
  const available = await isOcrAvailable();
  if (!available) {
    throw new Error(
      "OCR is not available on this platform. Scanned/image-based PDFs require " +
        "a platform with native Canvas support (Linux/Docker/Railway). " +
        "Text-based PDFs work everywhere."
    );
  }

  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const uint8 = new Uint8Array(buffer);

  // Standard font data path for Node.js rendering
  const fontPath = path.join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "standard_fonts",
    ""
  );

  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    standardFontDataUrl: fontPath,
  });
  const doc =
    "promise" in loadingTask
      ? await (loadingTask as any).promise
      : loadingTask;

  const pageCount = doc.numPages;
  const lines: string[] = [];
  lines.push(`# ${textMeta.info?.Title || "Scanned PDF Document"}\n`);
  lines.push(`> *OCR extracted — ${pageCount} page(s)*\n`);

  const worker = await createWorker("eng");

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");

    // White background for better OCR contrast
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    try {
      await page.render({ canvasContext: ctx as any, viewport }).promise;
    } catch (renderErr: any) {
      console.warn(
        `Page ${i} render issue:`,
        renderErr.message?.slice(0, 120)
      );
      // Continue — partial render may still OCR some text
    }

    const pngBuffer = canvas.toBuffer("image/png");

    const {
      data: { text },
    } = await worker.recognize(pngBuffer);

    const pageText = text.trim();
    if (pageText) {
      if (pageCount > 1) lines.push(`## Page ${i}\n`);
      lines.push(pageText);
    }
  }

  await worker.terminate();
  return lines.join("\n\n");
}

// ── PDF → Markdown (auto-detect text vs scanned) ─────────────────────

async function pdfToMarkdown(buffer: Buffer): Promise<string> {
  // Fast path: try text extraction first
  let data: Awaited<ReturnType<typeof pdfParse>>;
  try {
    data = await pdfParse(buffer);
  } catch {
    // pdf-parse failed entirely — likely a scanned/image-only PDF
    return await ocrPdfToMarkdown(buffer, { numpages: 1 });
  }

  const pageCount = data.numpages || 1;
  const avgCharsPerPage = data.text.length / pageCount;

  // If text extraction yields enough content, it's a text PDF
  if (avgCharsPerPage >= OCR_TEXT_THRESHOLD && data.text.trim()) {
    const pages = data.text.split("\f").map((p) => p.trim()).filter(Boolean);
    return formatTextPages(pages, data);
  }

  // Low text yield → likely scanned, use OCR
  return await ocrPdfToMarkdown(buffer, data);
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
        {
          error:
            "No readable content found. The file may be empty, image-only, or heavily scanned.",
        },
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

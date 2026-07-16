import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import path from "path";
import mammoth from "mammoth";
import { createWorker } from "tesseract.js";
import { createCanvas } from "@napi-rs/canvas";

// ── .docx → Markdown ─────────────────────────────────────────────────

async function docxToMarkdown(buffer: Buffer): Promise<string> {
  // mammoth v2 types don't expose convertToMarkdown in strict mode
  const result = await (mammoth as any).convertToMarkdown({ buffer });
  return result.value;
}

// ── PDF text extraction via pdfjs-dist (pure JS, no native deps) ─────

async function getPdfjsLib() {
  return await import("pdfjs-dist/legacy/build/pdf.mjs");
}

function getFontPath(): string {
  return path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts", "");
}

async function pdfExtractText(buffer: Buffer): Promise<{
  text: string;
  numpages: number;
  title?: string;
}> {
  const pdfjsLib = await getPdfjsLib();
  const uint8 = new Uint8Array(buffer);

  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    standardFontDataUrl: getFontPath(),
  });
  const doc = "promise" in loadingTask ? await (loadingTask as any).promise : loadingTask;

  const pageCount = doc.numPages;
  const pages: string[] = [];
  let title = "";

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();

    // Extract first non-empty text as potential title
    if (!title && textContent.items.length > 0) {
      const firstItem = textContent.items.find((item: any) => item.str?.trim());
      if (firstItem) title = firstItem.str.trim();
    }

    // Build page text from text items
    const pageText = textContent.items
      .map((item: any) => item.str || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText) pages.push(pageText);
  }

  return {
    text: pages.join("\f"),
    numpages: pageCount,
    title: title || undefined,
  };
}

// ── Markdown formatting ──────────────────────────────────────────────

function formatTextPages(
  pages: string[],
  meta: { numpages: number; title?: string }
): string {
  const lines: string[] = [];
  lines.push(`# ${meta.title || "PDF Document"}\n`);

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

const OCR_TEXT_THRESHOLD = 80;
let _ocrAvailable: boolean | null = null;

async function isOcrAvailable(): Promise<boolean> {
  if (_ocrAvailable !== null) return _ocrAvailable;
  try {
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
  textMeta: { numpages: number; title?: string }
): Promise<string> {
  const available = await isOcrAvailable();
  if (!available) {
    throw new Error(
      "OCR is not available on this platform (no native Canvas). " +
        "Text-based PDFs should still work."
    );
  }

  const pdfjsLib = await getPdfjsLib();
  const uint8 = new Uint8Array(buffer);

  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    standardFontDataUrl: getFontPath(),
  });
  const doc = "promise" in loadingTask ? await (loadingTask as any).promise : loadingTask;

  const pageCount = doc.numPages;
  const lines: string[] = [];
  lines.push(`# ${textMeta.title || "Scanned PDF Document"}\n`);
  lines.push(`> *OCR extracted — ${pageCount} page(s)*\n`);

  const worker = await createWorker("eng");

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    try {
      await page.render({ canvasContext: ctx as any, viewport }).promise;
    } catch (renderErr: any) {
      console.warn(`Page ${i} render issue:`, renderErr.message?.slice(0, 120));
    }

    const pngBuffer = canvas.toBuffer("image/png");
    const { data: { text } } = await worker.recognize(pngBuffer);

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
  // Step 1: Extract text via pdfjs-dist (pure JS, works everywhere)
  let extracted: { text: string; numpages: number; title?: string };
  try {
    extracted = await pdfExtractText(buffer);
  } catch (extractErr: any) {
    console.error("PDF text extraction failed:", extractErr.message);
    // Last resort: try OCR directly
    try {
      return await ocrPdfToMarkdown(buffer, { numpages: 1 });
    } catch (ocrErr: any) {
      throw new Error(
        `Cannot read this PDF. Text extraction failed: ${extractErr.message}. ` +
          `OCR also failed: ${ocrErr.message}`
      );
    }
  }

  const pages = extracted.text.split("\f").map((p) => p.trim()).filter(Boolean);
  const avgCharsPerPage = extracted.text.length / Math.max(extracted.numpages, 1);

  // Good text yield → use it directly
  if (avgCharsPerPage >= OCR_TEXT_THRESHOLD && pages.length > 0) {
    return formatTextPages(pages, { numpages: extracted.numpages, title: extracted.title });
  }

  // Low text — try OCR fallback
  try {
    return await ocrPdfToMarkdown(buffer, extracted);
  } catch (ocrErr: any) {
    console.error("OCR fallback failed:", ocrErr.message);
    // Return whatever text we extracted, with a warning
    if (pages.length > 0) {
      return (
        `> ⚠️ *OCR unavailable — showing partial text extraction only.*\n\n` +
        formatTextPages(pages, { numpages: extracted.numpages, title: extracted.title })
      );
    }
    throw new Error(
      `Cannot read this PDF. No text found and OCR unavailable. OCR error: ${ocrErr.message}`
    );
  }
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
    const ALLOWED = [".docx", ".pdf", ".txt", ".md", ".csv"];
    if (!ALLOWED.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported format '${ext}'. Please upload ${ALLOWED.join(" or ")} files.` },
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
      } else if (ext === ".pdf") {
        markdown = await pdfToMarkdown(buffer);
      } else if (ext === ".md") {
        markdown = buffer.toString("utf-8");
      } else if (ext === ".csv") {
        // Convert CSV to Markdown table
        const csvText = buffer.toString("utf-8");
        const lines = csvText.trim().split(/\r?\n/);
        if (lines.length === 0) { markdown = csvText; }
        else {
          const rows = lines.map(line => line.split(",").map(cell => cell.trim()));
          const header = rows[0];
          markdown = "| " + header.join(" | ") + " |\n";
          markdown += "| " + header.map(() => "---").join(" | ") + " |\n";
          for (let i = 1; i < rows.length; i++) {
            markdown += "| " + rows[i].join(" | ") + " |\n";
          }
        }
      } else {
        // .txt — wrap in markdown code block to preserve formatting
        markdown = "```\n" + buffer.toString("utf-8") + "\n```";
      }
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
      // Use explicit companyId/processAreaId from formData, fall back to cookie
      let companyId: string | null = formData.get("companyId")?.toString() || null;
      if (!companyId) {
        try {
          const cookieStore = await cookies();
          companyId = cookieStore.get("selectedCompanyId")?.value || null;
        } catch { /* cookies() may throw */ }
      }
      const processAreaId: string | null = formData.get("processAreaId")?.toString() || null;
      kbRecord = await prisma.knowledgebase.create({
        data: {
          knowledgeName: originalName,
          knowledgeContent: markdown,
          remarks,
          addedBy: username,
          companyId,
          processAreaId,
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

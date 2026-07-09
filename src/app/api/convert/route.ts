import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { execFile } from "child_process";
import path from "path";
import os from "os";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const SCRIPT = path.join(process.cwd(), "scripts", "convert_to_md.py");

function getPythonCommand(): string {
  // Railway production
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY === "true") {
    return process.env.PYTHON_PATH || "python3";
  }
  // Local dev: prefer .venv
  const venvPython = path.join(process.cwd(), "..", ".venv", "Scripts", "python.exe");
  if (existsSync(venvPython)) return venvPython;
  // Fallback: system Python (Windows paths)
  const systemPython = "C:/Users/edwar/AppData/Local/Microsoft/WindowsApps/python3.13.exe";
  if (existsSync(systemPython)) return systemPython;
  return "python";
}

// POST — upload a .docx or .pdf and get Markdown back
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

    // Save temp file
    const tmpDir = path.join(os.tmpdir(), "seam-convert");
    await mkdir(tmpDir, { recursive: true });
    const tmpPath = path.join(tmpDir, `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`);

    const bytes = await file.arrayBuffer();
    await writeFile(tmpPath, Buffer.from(bytes));

    // Run Python converter
    const pythonCmd = getPythonCommand();
    let stdout: string;
    let stderr: string;

    try {
      const result = await execFileAsync(pythonCmd, [SCRIPT, tmpPath], {
        timeout: 60_000, // 60 second timeout
        maxBuffer: 10 * 1024 * 1024, // 10 MB
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (execError: any) {
      // Clean up temp file on error
      await unlink(tmpPath).catch(() => {});
      console.error("Python conversion error:", execError.stderr || execError.message);
      return NextResponse.json(
        {
          error: "Conversion failed",
          details: execError.stderr || execError.message,
        },
        { status: 500 }
      );
    }

    // Clean up temp file
    await unlink(tmpPath).catch(() => {});

    // Return the Markdown
    const originalName = file.name.replace(ext, "");
    const mdFileName = `${originalName}.md`;

    // Optionally save to Knowledgebase
    let kbRecord = null;
    if (saveToKB) {
      const username = (session.user as { name?: string }).name || "unknown";
      kbRecord = await prisma.knowledgebase.create({
        data: {
          knowledgeName: originalName,
          knowledgeContent: stdout,
          remarks,
          addedBy: username,
        },
      });
    }

    return NextResponse.json({
      success: true,
      markdown: stdout,
      fileName: mdFileName,
      sourceFileName: file.name,
      sourceSize: file.size,
      mdLength: stdout.length,
      ...(kbRecord ? { knowledgebaseId: kbRecord.kID } : {}),
    });
  } catch (error) {
    console.error("Conversion error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

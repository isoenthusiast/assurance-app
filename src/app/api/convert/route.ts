import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
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
  // Local dev: prefer .venv, fall back to system Python
  const venvPython = path.join(process.cwd(), "..", ".venv", "Scripts", "python.exe");
  try {
    const { existsSync } = require("fs");
    if (existsSync(venvPython)) return venvPython;
  } catch {}
  return "python3";
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
      const result = await execFileAsync(pythonCmd, [SCRIPT, tmpPath, "--output", "-"], {
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

    return NextResponse.json({
      success: true,
      markdown: stdout,
      fileName: mdFileName,
      sourceFileName: file.name,
      sourceSize: file.size,
      mdLength: stdout.length,
    });
  } catch (error) {
    console.error("Conversion error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

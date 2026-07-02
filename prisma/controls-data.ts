import * as fs from "fs";
import * as path from "path";

/**
 * Shared loader for Combined_Controls.csv. Used by both the incremental
 * seeder (seed-controls.ts) and the full reset+reseed (reset-seed.ts).
 */

// The Prisma ControlType enum supports three categories. The CSV uses a richer
// taxonomy, so we collapse it for the enum column but keep the original verbatim
// value in Control.controlTypeDetail.
//   Engineering            -> Engineering
//   Behavioral/Behavioural -> Behavioural
//   everything else        -> Procedural   (Administrative, Analytical,
//                                            Informational, Procedural)
export type DbControlType = "Engineering" | "Procedural" | "Behavioural";

export function mapControlType(raw: string): DbControlType {
  const t = (raw || "").trim().toLowerCase();
  if (t === "engineering") return "Engineering";
  if (t === "behavioural" || t === "behavioral") return "Behavioural";
  return "Procedural";
}

export interface ControlRow {
  controlRef: string; // CSV controlId
  sourceFile: string;
  practiceDocument: string;
  processArea: string;
  subProcess: string;
  controlName: string;
  controlStatement: string;
  controlType: string; // verbatim CSV value
  isHSSECritical: boolean;
  csfWho: string;
  csfWhat: string;
  csfWhen: string;
  csfWhere: string;
  csfWhy: string;
  csfHow: string;
  csfEvidence: string;
  keyActivities: string; // raw pipe-delimited
  riskAddressed: string;
  testingApproach: string;
  uncertainFlags: string;
}

/**
 * RFC 4180 compliant CSV parser. Handles quoted fields containing commas,
 * escaped double-quotes ("") and embedded newlines, plus CRLF line endings
 * and a leading UTF-8 BOM.
 */
export function parseCSV(input: string): string[][] {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
        // ignore — handled by the following \n
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function resolveCsvPath(): string {
  const candidates = [
    process.env.CONTROLS_CSV,
    path.join(__dirname, "Combined_Controls.csv"),
    path.join(__dirname, "../Combined_Controls.csv"),
    path.join(__dirname, "../../Combined_Controls.csv"),
    path.join(process.cwd(), "Combined_Controls.csv"),
    path.join(process.cwd(), "../Combined_Controls.csv"),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  console.error("❌ Combined_Controls.csv not found. Looked in:");
  candidates.forEach((p) => console.error(`   - ${p}`));
  console.error("   Set CONTROLS_CSV=/path/to/Combined_Controls.csv to override.");
  process.exit(1);
}

export function loadControls(): ControlRow[] {
  const csvPath = resolveCsvPath();
  console.log(`📄 Reading controls from: ${csvPath}\n`);

  const rows = parseCSV(fs.readFileSync(csvPath, "utf-8"));
  if (rows.length < 2) {
    console.error("❌ CSV contained no data rows.");
    process.exit(1);
  }

  const header = rows[0].map((h) => h.trim());
  const col: Record<string, number> = {};
  header.forEach((h, i) => (col[h] = i));

  const required = [
    "controlId",
    "processArea",
    "subProcess",
    "controlName",
    "controlStatement",
    "controlType",
    "isHSSECritical",
  ];
  for (const r of required) {
    if (!(r in col)) {
      console.error(`❌ CSV is missing required column: ${r}`);
      process.exit(1);
    }
  }

  const get = (r: string[], name: string) =>
    col[name] !== undefined ? (r[col[name]] ?? "").trim() : "";

  const controls: ControlRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length <= 1 && !r.some((c) => c.trim() !== "")) continue; // blank line
    if (!get(r, "controlName")) continue;

    controls.push({
      controlRef: get(r, "controlId"),
      sourceFile: get(r, "sourceFile"),
      practiceDocument: get(r, "practiceDocument"),
      processArea: get(r, "processArea"),
      subProcess: get(r, "subProcess"),
      controlName: get(r, "controlName"),
      controlStatement: get(r, "controlStatement"),
      controlType: get(r, "controlType"),
      isHSSECritical: get(r, "isHSSECritical").toUpperCase() === "TRUE",
      csfWho: get(r, "csf_who"),
      csfWhat: get(r, "csf_what"),
      csfWhen: get(r, "csf_when"),
      csfWhere: get(r, "csf_where"),
      csfWhy: get(r, "csf_why"),
      csfHow: get(r, "csf_how"),
      csfEvidence: get(r, "csf_evidence"),
      keyActivities: get(r, "keyActivities"),
      riskAddressed: get(r, "riskAddressed"),
      testingApproach: get(r, "testingApproach"),
      uncertainFlags: get(r, "uncertainFlags"),
    });
  }
  return controls;
}

/** Builds the Prisma Control create/update payload (minus relation ids). */
export function controlData(c: ControlRow) {
  return {
    name: c.controlName,
    statement: c.controlStatement,
    controlType: mapControlType(c.controlType),
    isHsseCritical: c.isHSSECritical,
    riskWeight: c.isHSSECritical ? 3 : 1,
    rawHealthScore: 80,
    // imported CSV fields
    controlRef: c.controlRef || null,
    sourceFile: c.sourceFile || null,
    practiceDocument: c.practiceDocument || null,
    controlTypeDetail: c.controlType || null,
    csfWho: c.csfWho || null,
    csfWhat: c.csfWhat || null,
    csfWhen: c.csfWhen || null,
    csfWhere: c.csfWhere || null,
    csfWhy: c.csfWhy || null,
    csfHow: c.csfHow || null,
    csfEvidence: c.csfEvidence || null,
    keyActivities: c.keyActivities || null,
    riskAddressed: c.riskAddressed || null,
    testingApproach: c.testingApproach || null,
    uncertainFlags: c.uncertainFlags || null,
  };
}

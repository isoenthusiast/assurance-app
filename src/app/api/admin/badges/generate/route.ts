import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const LEVELS = ["Bronze", "Silver", "Gold", "Platinum", "Black"] as const;

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  Bronze: "Starting level — after initiation of process activation",
  Silver: "Having performed certain missions to justify XP in the process attribute",
  Gold: "Demonstrated mastery with consistent process delivery and quality",
  Platinum: "Elite performance with measurable impact across multiple assessments",
  Black: "Legendary — the highest tier of process excellence recognition",
};

const POINTS_PER_LEVEL: Record<string, number> = {
  Bronze: 100,
  Silver: 500,
  Gold: 1500,
  Platinum: 5000,
  Black: 15000,
};

const LEVEL_COLORS: Record<string, { bg: string; accent: string; glow: string; text: string }> = {
  Bronze: { bg: "#1a1410", accent: "#CD7F32", glow: "rgba(205,127,50,0.4)", text: "#E8C27A" },
  Silver: { bg: "#111318", accent: "#A8B4C0", glow: "rgba(168,180,192,0.4)", text: "#D0D8E0" },
  Gold:    { bg: "#1a1608", accent: "#FFD700", glow: "rgba(255,215,0,0.5)", text: "#FFE44D" },
  Platinum: { bg: "#0a1418", accent: "#00CED1", glow: "rgba(0,206,209,0.5)", text: "#5CFFFF" },
  Black:   { bg: "#0a0a0f", accent: "#E5E5E5", glow: "rgba(180,160,255,0.3)", text: "#C8B8F0" },
};

function generateBadgeSVG(badgeName: string, level: string): string {
  const c = LEVEL_COLORS[level] || LEVEL_COLORS.Bronze;
  const W = 400, H = 400;

  // XML-escape the badge name for SVG text elements
  const safeName = badgeName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // Scale font size based on name length
  const maxChars = 30;
  const fontSize = Math.max(18, 44 - Math.max(0, badgeName.length - 8) * 1.6);
  const lineHeight = fontSize * 1.25;

  // Split long names into multiple lines
  const words = safeName.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > maxChars && current) {
      lines.push(current.trim());
      current = w;
    } else {
      current += " " + w;
    }
  }
  if (current.trim()) lines.push(current.trim());
  if (lines.length > 4) lines.splice(4); // max 4 lines

  const totalTextHeight = lines.length * lineHeight;
  const startY = H / 2 - totalTextHeight / 2 + 10;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="${c.accent}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${c.bg}" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c.accent}" stop-opacity="0.8"/>
      <stop offset="50%" stop-color="${c.accent}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${c.accent}" stop-opacity="0.8"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" rx="20" fill="${c.bg}"/>
  <rect width="${W}" height="${H}" rx="20" fill="url(#bgGrad)"/>

  <!-- Hexagonal pattern -->
  <g opacity="0.08" stroke="${c.accent}" stroke-width="0.5" fill="none">
    <polygon points="200,60 260,95 260,165 200,200 140,165 140,95"/>
    <polygon points="200,120 230,138 230,172 200,190 170,172 170,138"/>
    <line x1="80" y1="30" x2="320" y2="30"/>
    <line x1="50" y1="370" x2="350" y2="370"/>
  </g>

  <!-- Corner accents -->
  <g stroke="${c.accent}" stroke-width="1.5" opacity="0.5" fill="none">
    <path d="M16,50 L16,16 L50,16"/>
    <path d="M${W-50},16 L${W-16},16 L${W-16},50"/>
    <path d="M${W-16},${H-50} L${W-16},${H-16} L${W-50},${H-16}"/>
    <path d="M50,${H-16} L16,${H-16} L16,${H-50}"/>
  </g>

  <!-- Central hexagon decoration -->
  <polygon points="200,${startY-30} 240,${startY-15} 240,${startY+totalTextHeight+15} 200,${startY+totalTextHeight+30} 160,${startY+totalTextHeight+15} 160,${startY-15}"
    fill="none" stroke="${c.accent}" stroke-width="1" opacity="0.25"/>

  <!-- SMDS label -->
  <text x="${W/2}" y="38" text-anchor="middle" fill="${c.accent}" font-family="monospace" font-size="12" font-weight="600" letter-spacing="8" opacity="0.7">SMDS</text>

  <!-- Level dot indicators at top -->
  <g fill="${c.accent}" opacity="0.6">
    ${Array.from({length: LEVELS.indexOf(level as typeof LEVELS[number])+1}, (_,i) =>
      `<circle cx="${W/2 - (LEVELS.indexOf(level as typeof LEVELS[number]))*10 + i*20}" cy="58" r="4"/>`
    ).join('')}
  </g>

  <!-- Badge Name -->
  <g fill="${c.text}" font-family="'Segoe UI',Arial,sans-serif" text-anchor="middle">
    ${lines.map((line, i) =>
      `<text x="${W/2}" y="${startY + i * lineHeight}" font-size="${fontSize}" font-weight="700" letter-spacing="2">${line}</text>`
    ).join('\n    ')}
  </g>

  <!-- Level badge pill -->
  <rect x="${W/2-50}" y="${H-55}" width="100" height="26" rx="13"
    fill="${c.accent}" fill-opacity="0.15" stroke="${c.accent}" stroke-width="1" stroke-opacity="0.5"/>
  <text x="${W/2}" y="${H-38}" text-anchor="middle" fill="${c.accent}" font-family="monospace" font-size="13" font-weight="700" letter-spacing="3">${level.toUpperCase()}</text>

  <!-- Bottom decorative line -->
  <line x1="${W/2-80}" y1="${H-18}" x2="${W/2+80}" y2="${H-18}" stroke="${c.accent}" stroke-width="0.5" opacity="0.3"/>
</svg>`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").substring(0, 60);
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as { role?: string }).role !== "Admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const processAreas = await prisma.processArea.findMany({
      orderBy: { name: "asc" },
    });

    const uploadDir = path.join(process.cwd(), "public", "images", "badges");
    await mkdir(uploadDir, { recursive: true });

    let created = 0;
    let skipped = 0;

    for (const pa of processAreas) {
      for (const level of LEVELS) {
        const badgeName = `SMDS ${pa.name}`;

        // Skip if badge with same name+level already exists
        const existing = await prisma.achievementBadge.findFirst({
          where: { badgeName, level },
        });

        if (existing) {
          skipped++;
          continue;
        }

        const description =
          `Badge of Process Excellence Recognition for ${pa.standard ? pa.standard + " - " : ""}${pa.name}.\n` +
          `${level} - ${LEVEL_DESCRIPTIONS[level]}`;

        // Generate and save SVG badge image
        const svg = generateBadgeSVG(badgeName, level);
        const imageFilename = `badge_${sanitizeFilename(badgeName)}_${level.toLowerCase()}.svg`;
        await writeFile(path.join(uploadDir, imageFilename), svg);
        const badgeImage = `/images/badges/${imageFilename}`;

        await prisma.achievementBadge.create({
          data: {
            badgeName,
            description,
            icon: "🔍",
            badgeImage,
            emotionalDrive: "Achievement",
            rarity: level === "Black" ? "Legendary" : level === "Platinum" ? "Epic" : level === "Gold" ? "Rare" : "Uncommon",
            level,
            processAreaId: pa.id,
            pointsRequired: POINTS_PER_LEVEL[level],
            achievementType: "milestone_master",
          },
        });

        created++;
      }
    }

    return NextResponse.json({
      created,
      skipped,
      total: processAreas.length * LEVELS.length,
    });
  } catch (error) {
    console.error("Error generating process badges:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

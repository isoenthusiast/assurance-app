// Direct SQL schema sync using Prisma client's raw query (CommonJS)
const { PrismaClient } = require("../src/generated/prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config({ path: ".env.local" });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Connected to database. Running schema sync...\n");

  // 1. Add actionTaken column to Action table
  console.log("1. Adding actionTaken to Action...");
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Action" ADD COLUMN IF NOT EXISTS "actionTaken" TEXT`);
    console.log("   ✓ actionTaken column ready.");
  } catch (e) {
    if (e.message && (e.message.includes("already exists") || e.message.includes("duplicate"))) {
      console.log("   - actionTaken column already exists.");
    } else {
      console.log("   ⚠ actionTaken:", e.message);
    }
  }

  // 2. Create Attachment table
  console.log("2. Creating Attachment table...");
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Attachment" (
        "id" TEXT PRIMARY KEY,
        "description" TEXT,
        "fileName" TEXT NOT NULL,
        "filePath" TEXT NOT NULL,
        "fileSize" INTEGER,
        "uploadedBy" TEXT NOT NULL,
        "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("   ✓ Attachment table ready.");
  } catch (e) {
    if (e.message && (e.message.includes("already exists") || e.message.includes("duplicate"))) {
      console.log("   - Attachment table already exists.");
    } else {
      console.log("   ⚠ Attachment:", e.message);
    }
  }

  // 3. Create AttachmentMapping table
  console.log("3. Creating AttachmentMapping table...");
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AttachmentMapping" (
        "id" TEXT PRIMARY KEY,
        "attachmentId" TEXT NOT NULL REFERENCES "Attachment"("id") ON DELETE CASCADE,
        "destTable" TEXT NOT NULL,
        "recId" TEXT NOT NULL
      )
    `);
    console.log("   ✓ AttachmentMapping table ready.");
  } catch (e) {
    if (e.message && (e.message.includes("already exists") || e.message.includes("duplicate"))) {
      console.log("   - AttachmentMapping table already exists.");
    } else {
      console.log("   ⚠ AttachmentMapping:", e.message);
    }
  }

  // 4. Create indexes
  console.log("4. Creating indexes...");
  try {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AttachmentMapping_destTable_recId_idx" 
        ON "AttachmentMapping" ("destTable", "recId")
    `);
    console.log("   ✓ destTable+recId index ready.");
  } catch (e) {
    console.log("   ⚠ destTable+recId index:", e.message);
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AttachmentMapping_attachmentId_idx" 
        ON "AttachmentMapping" ("attachmentId")
    `);
    console.log("   ✓ attachmentId index ready.");
  } catch (e) {
    console.log("   ⚠ attachmentId index:", e.message);
  }

  console.log("\n✅ Schema sync complete!");
}

main()
  .catch((e) => {
    console.error("❌ Fatal error:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

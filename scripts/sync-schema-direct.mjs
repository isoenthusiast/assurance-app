// Direct SQL schema sync to bypass prisma db push P2002 error
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config({ path: ".env.local" });

async function main() {
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const client = await pool.connect();
  try {
    console.log("Connected to database.");

    // 1. Add actionTaken column to Action table (if not exists)
    console.log("Adding actionTaken to Action...");
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Action' AND column_name = 'actionTaken'
        ) THEN
          ALTER TABLE "Action" ADD COLUMN "actionTaken" TEXT;
        END IF;
      END $$;
    `);
    console.log("  ✓ actionTaken column ready.");

    // 2. Create Attachment table (if not exists)
    console.log("Creating Attachment table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Attachment" (
        "id" TEXT PRIMARY KEY,
        "description" TEXT,
        "fileName" TEXT NOT NULL,
        "filePath" TEXT NOT NULL,
        "fileSize" INTEGER,
        "uploadedBy" TEXT NOT NULL,
        "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("  ✓ Attachment table ready.");

    // 3. Create AttachmentMapping table (if not exists)
    console.log("Creating AttachmentMapping table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "AttachmentMapping" (
        "id" TEXT PRIMARY KEY,
        "attachmentId" TEXT NOT NULL REFERENCES "Attachment"("id") ON DELETE CASCADE,
        "destTable" TEXT NOT NULL,
        "recId" TEXT NOT NULL
      );
    `);
    console.log("  ✓ AttachmentMapping table ready.");

    // 4. Create indexes for AttachmentMapping
    console.log("Creating indexes...");
    await client.query(`
      CREATE INDEX IF NOT EXISTS "AttachmentMapping_destTable_recId_idx" 
        ON "AttachmentMapping" ("destTable", "recId");
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "AttachmentMapping_attachmentId_idx" 
        ON "AttachmentMapping" ("attachmentId");
    `);
    console.log("  ✓ Indexes ready.");

    console.log("\n✅ Schema sync complete!");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});

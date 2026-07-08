-- Add actionTaken column to Action table
ALTER TABLE "Action" ADD COLUMN IF NOT EXISTS "actionTaken" TEXT;

-- Create Attachment table
CREATE TABLE IF NOT EXISTS "Attachment" (
  "id" TEXT PRIMARY KEY,
  "description" TEXT,
  "fileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileSize" INTEGER,
  "uploadedBy" TEXT NOT NULL,
  "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create AttachmentMapping table
CREATE TABLE IF NOT EXISTS "AttachmentMapping" (
  "id" TEXT PRIMARY KEY,
  "attachmentId" TEXT NOT NULL REFERENCES "Attachment"("id") ON DELETE CASCADE,
  "destTable" TEXT NOT NULL,
  "recId" TEXT NOT NULL
);

-- Create indexes for AttachmentMapping
CREATE INDEX IF NOT EXISTS "AttachmentMapping_destTable_recId_idx" 
  ON "AttachmentMapping" ("destTable", "recId");

CREATE INDEX IF NOT EXISTS "AttachmentMapping_attachmentId_idx" 
  ON "AttachmentMapping" ("attachmentId");

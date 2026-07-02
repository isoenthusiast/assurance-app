-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "controlId" TEXT,
    "sampleTypeId" TEXT,
    "recordSourceId" TEXT,
    "recordReference" TEXT,
    "controlEffective" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NotTested',
    "conclusion" TEXT,
    "evidenceUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sample_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Sample_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sample_sampleTypeId_fkey" FOREIGN KEY ("sampleTypeId") REFERENCES "SampleType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sample_recordSourceId_fkey" FOREIGN KEY ("recordSourceId") REFERENCES "RecordSourceType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Sample" ("assessmentId", "comment", "conclusion", "controlEffective", "controlId", "createdAt", "evidenceUrl", "id", "recordReference", "recordSourceId", "sampleTypeId", "status") SELECT "assessmentId", "comment", "conclusion", "controlEffective", "controlId", "createdAt", "evidenceUrl", "id", "recordReference", "recordSourceId", "sampleTypeId", "status" FROM "Sample";
DROP TABLE "Sample";
ALTER TABLE "new_Sample" RENAME TO "Sample";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

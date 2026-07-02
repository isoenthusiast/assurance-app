-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AssessmentControl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AssessmentControl" ("assessmentId", "controlId", "createdAt", "id") SELECT "assessmentId", "controlId", "createdAt", "id" FROM "AssessmentControl";
DROP TABLE "AssessmentControl";
ALTER TABLE "new_AssessmentControl" RENAME TO "AssessmentControl";
CREATE UNIQUE INDEX "AssessmentControl_assessmentId_controlId_key" ON "AssessmentControl"("assessmentId" ASC, "controlId" ASC);
CREATE INDEX "AssessmentControl_controlId_idx" ON "AssessmentControl"("controlId" ASC);
CREATE INDEX "AssessmentControl_assessmentId_idx" ON "AssessmentControl"("assessmentId" ASC);
CREATE TABLE "new_Sample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "sampleTypeId" TEXT,
    "recordSourceId" TEXT,
    "recordReference" TEXT,
    "controlEffective" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NotTested',
    "conclusion" TEXT,
    "evidenceUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("recordSourceId") REFERENCES "RecordSourceType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("sampleTypeId") REFERENCES "SampleType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Sample" ("assessmentId", "comment", "conclusion", "controlEffective", "createdAt", "evidenceUrl", "id", "recordReference", "recordSourceId", "sampleTypeId", "status") SELECT "assessmentId", "comment", "conclusion", "controlEffective", "createdAt", "evidenceUrl", "id", "recordReference", "recordSourceId", "sampleTypeId", "status" FROM "Sample";
DROP TABLE "Sample";
ALTER TABLE "new_Sample" RENAME TO "Sample";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


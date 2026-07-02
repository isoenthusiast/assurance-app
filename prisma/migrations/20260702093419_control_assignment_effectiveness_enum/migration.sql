-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ControlAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "lastTestedDate" DATETIME,
    "effective" TEXT,
    "effectiveUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ControlAssignment_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ControlAssignment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ControlAssignment" ("assessmentId", "controlId", "createdAt", "effective", "id", "lastTestedDate") SELECT "assessmentId", "controlId", "createdAt", "effective", "id", "lastTestedDate" FROM "ControlAssignment";
DROP TABLE "ControlAssignment";
ALTER TABLE "new_ControlAssignment" RENAME TO "ControlAssignment";
CREATE INDEX "ControlAssignment_assessmentId_idx" ON "ControlAssignment"("assessmentId");
CREATE INDEX "ControlAssignment_controlId_idx" ON "ControlAssignment"("controlId");
CREATE UNIQUE INDEX "ControlAssignment_assessmentId_controlId_key" ON "ControlAssignment"("assessmentId", "controlId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

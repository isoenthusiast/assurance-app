-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "sampleId" TEXT,
    "description" TEXT NOT NULL,
    "details" TEXT,
    "controlIds" TEXT,
    "risks" TEXT,
    "repeat" BOOLEAN NOT NULL DEFAULT false,
    "severity" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Finding_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Finding_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "findingId" TEXT NOT NULL,
    "actionDescription" TEXT NOT NULL,
    "actionDetails" TEXT,
    "actionParty" TEXT,
    "auditee" TEXT,
    "createdDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetDate" DATETIME,
    "apAgreed" BOOLEAN NOT NULL DEFAULT false,
    "originalTargetDate" DATETIME,
    "numberOfExtensions" INTEGER NOT NULL DEFAULT 0,
    "actionClosureEffective" BOOLEAN NOT NULL DEFAULT false,
    "actionClosureApprovedBy" TEXT,
    CONSTRAINT "Action_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Finding_assessmentId_idx" ON "Finding"("assessmentId");

-- CreateIndex
CREATE INDEX "Finding_sampleId_idx" ON "Finding"("sampleId");

-- CreateIndex
CREATE INDEX "Action_findingId_idx" ON "Action"("findingId");

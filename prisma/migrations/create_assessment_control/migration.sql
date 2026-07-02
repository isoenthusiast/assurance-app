-- CreateTable AssessmentControl
CREATE TABLE "AssessmentControl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentControl_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE,
    CONSTRAINT "AssessmentControl_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentControl_assessmentId_controlId_key" ON "AssessmentControl"("assessmentId", "controlId");
CREATE INDEX "AssessmentControl_assessmentId_idx" ON "AssessmentControl"("assessmentId");
CREATE INDEX "AssessmentControl_controlId_idx" ON "AssessmentControl"("controlId");

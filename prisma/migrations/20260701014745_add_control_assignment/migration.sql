-- CreateTable
CREATE TABLE "ControlAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ControlAssignment_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ControlAssignment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ControlAssignment_assessmentId_idx" ON "ControlAssignment"("assessmentId");

-- CreateIndex
CREATE INDEX "ControlAssignment_controlId_idx" ON "ControlAssignment"("controlId");

-- CreateIndex
CREATE UNIQUE INDEX "ControlAssignment_assessmentId_controlId_key" ON "ControlAssignment"("assessmentId", "controlId");

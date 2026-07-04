-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Assessor',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "dailyPointStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActivityDate" DATETIME,
    "confidenceInfluencer" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "AssuranceActivityType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultLOA" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProcessArea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pId" TEXT,
    "standard" TEXT
);

-- CreateTable
CREATE TABLE "SubProcess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "processAreaId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubProcess_processAreaId_fkey" FOREIGN KEY ("processAreaId") REFERENCES "ProcessArea" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Control" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "controlType" TEXT NOT NULL,
    "processAreaId" TEXT NOT NULL,
    "subProcessId" TEXT NOT NULL,
    "isHsseCritical" BOOLEAN NOT NULL DEFAULT false,
    "ramRating" TEXT,
    "riskWeight" INTEGER NOT NULL DEFAULT 1,
    "rawHealthScore" INTEGER NOT NULL DEFAULT 80,
    "lastTestedDate" DATETIME,
    "lastTestResult" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "controlRef" TEXT,
    "sourceFile" TEXT,
    "practiceDocument" TEXT,
    "controlTypeDetail" TEXT,
    "csfWho" TEXT,
    "csfWhat" TEXT,
    "csfWhen" TEXT,
    "csfWhere" TEXT,
    "csfWhy" TEXT,
    "csfHow" TEXT,
    "csfEvidence" TEXT,
    "keyActivities" TEXT,
    "riskAddressed" TEXT,
    "testingApproach" TEXT,
    "uncertainFlags" TEXT,
    "standard" TEXT,
    "pId" TEXT,
    "Requirements" TEXT,
    CONSTRAINT "Control_subProcessId_fkey" FOREIGN KEY ("subProcessId") REFERENCES "SubProcess" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Control_processAreaId_fkey" FOREIGN KEY ("processAreaId") REFERENCES "ProcessArea" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AssessmentTemplateControlLinkage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentTemplateControlLinkage_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssessmentTemplateControlLinkage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssessmentTemplateActivityType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "activityTypeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentTemplateActivityType_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "AssuranceActivityType" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssessmentTemplateActivityType_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assessorId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "loa" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Planned',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assessment_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assessment_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "AssuranceActivityType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ControlAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "effective" TEXT,
    "effectiveUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ControlAssignment_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ControlAssignment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SampleType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RecordSourceType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Sample" (
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
    CONSTRAINT "Sample_recordSourceId_fkey" FOREIGN KEY ("recordSourceId") REFERENCES "RecordSourceType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sample_sampleTypeId_fkey" FOREIGN KEY ("sampleTypeId") REFERENCES "SampleType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sample_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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

-- CreateTable
CREATE TABLE "AchievementBadge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "emotionalDrive" TEXT NOT NULL,
    "rarity" TEXT NOT NULL DEFAULT 'Uncommon',
    "pointsRequired" INTEGER,
    "controlsChecked" INTEGER,
    "streakDays" INTEGER,
    "achievementType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAchievement_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "AchievementBadge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PointTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "assessmentId" TEXT,
    "sampleId" TEXT,
    "emotionalDrive" TEXT,
    "multiplier" REAL NOT NULL DEFAULT 1.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BehaviorMeasurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "plansMade" INTEGER NOT NULL DEFAULT 0,
    "controlsTested" INTEGER NOT NULL DEFAULT 0,
    "evidenceDocumented" INTEGER NOT NULL DEFAULT 0,
    "teamEngagement" BOOLEAN NOT NULL DEFAULT false,
    "qualityScore" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BehaviorMeasurement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmotionalDriveMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "period" DATETIME NOT NULL,
    "diversity" INTEGER NOT NULL DEFAULT 0,
    "belonging" INTEGER NOT NULL DEFAULT 0,
    "recognition" INTEGER NOT NULL DEFAULT 0,
    "achievement" INTEGER NOT NULL DEFAULT 0,
    "excellence" INTEGER NOT NULL DEFAULT 0,
    "growth" INTEGER NOT NULL DEFAULT 0,
    "contribution" INTEGER NOT NULL DEFAULT 0,
    "security" INTEGER NOT NULL DEFAULT 0,
    "overallEngagement" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmotionalDriveMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetValue" INTEGER NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Milestone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AssuranceActivityType_name_key" ON "AssuranceActivityType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessArea_name_key" ON "ProcessArea"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SubProcess_processAreaId_name_key" ON "SubProcess"("processAreaId", "name");

-- CreateIndex
CREATE INDEX "Control_controlRef_idx" ON "Control"("controlRef");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentTemplate_name_key" ON "AssessmentTemplate"("name");

-- CreateIndex
CREATE INDEX "AssessmentTemplateControlLinkage_templateId_idx" ON "AssessmentTemplateControlLinkage"("templateId");

-- CreateIndex
CREATE INDEX "AssessmentTemplateControlLinkage_controlId_idx" ON "AssessmentTemplateControlLinkage"("controlId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentTemplateControlLinkage_templateId_controlId_key" ON "AssessmentTemplateControlLinkage"("templateId", "controlId");

-- CreateIndex
CREATE INDEX "AssessmentTemplateActivityType_templateId_idx" ON "AssessmentTemplateActivityType"("templateId");

-- CreateIndex
CREATE INDEX "AssessmentTemplateActivityType_activityTypeId_idx" ON "AssessmentTemplateActivityType"("activityTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentTemplateActivityType_templateId_activityTypeId_key" ON "AssessmentTemplateActivityType"("templateId", "activityTypeId");

-- CreateIndex
CREATE INDEX "ControlAssignment_assessmentId_idx" ON "ControlAssignment"("assessmentId");

-- CreateIndex
CREATE INDEX "ControlAssignment_controlId_idx" ON "ControlAssignment"("controlId");

-- CreateIndex
CREATE UNIQUE INDEX "ControlAssignment_assessmentId_controlId_key" ON "ControlAssignment"("assessmentId", "controlId");

-- CreateIndex
CREATE UNIQUE INDEX "SampleType_name_key" ON "SampleType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RecordSourceType_name_key" ON "RecordSourceType"("name");

-- CreateIndex
CREATE INDEX "Finding_assessmentId_idx" ON "Finding"("assessmentId");

-- CreateIndex
CREATE INDEX "Finding_sampleId_idx" ON "Finding"("sampleId");

-- CreateIndex
CREATE INDEX "Action_findingId_idx" ON "Action"("findingId");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementBadge_name_key" ON "AchievementBadge"("name");

-- CreateIndex
CREATE INDEX "AchievementBadge_emotionalDrive_idx" ON "AchievementBadge"("emotionalDrive");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_badgeId_key" ON "UserAchievement"("userId", "badgeId");

-- CreateIndex
CREATE INDEX "PointTransaction_userId_idx" ON "PointTransaction"("userId");

-- CreateIndex
CREATE INDEX "PointTransaction_createdAt_idx" ON "PointTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "BehaviorMeasurement_userId_idx" ON "BehaviorMeasurement"("userId");

-- CreateIndex
CREATE INDEX "BehaviorMeasurement_date_idx" ON "BehaviorMeasurement"("date");

-- CreateIndex
CREATE UNIQUE INDEX "BehaviorMeasurement_userId_date_key" ON "BehaviorMeasurement"("userId", "date");

-- CreateIndex
CREATE INDEX "EmotionalDriveMetric_userId_idx" ON "EmotionalDriveMetric"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmotionalDriveMetric_userId_period_key" ON "EmotionalDriveMetric"("userId", "period");

-- CreateIndex
CREATE INDEX "Milestone_userId_idx" ON "Milestone"("userId");

-- CreateIndex
CREATE INDEX "Milestone_completedAt_idx" ON "Milestone"("completedAt");


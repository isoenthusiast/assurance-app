# SEAM Assurance App - Complete Design & Architecture Documentation

**Last Updated:** July 4, 2026 (v1.11.0)  
**Status:** Production Ready with Data Management  
**Database Version:** 1.11.0 (SQLite with Prisma ORM)

> **What's new in v1.11.0 (2026-07-04):** Added `ControlSubProcess` many-to-many junction model (§3.3). Controls can now belong to multiple sub-processes (e.g. across different ISO standards) without duplication. The Process Details page (Tab 2) shows junction-linked controls, and the Edit Control modal includes a "Linked Sub-Processes" multi-select (§5.3). The Process Areas page control counts include junction links.

> **What's new in v1.10.0 (2026-07-04):** Removed the legacy `AssessmentControl` junction table (v1.8.0) from the schema, database, and this document — `ControlAssignment` (v1.9.0) is now the sole Assessment↔Control junction (§16.5). Also rebaselined `prisma/migrations/` to a single clean `init` migration, replacing 17 mixed/out-of-order folders (§16.6).
>
> **What's new in v1.9.0 (doc reconciled with code on 2026-07-04):** The schema and app grew several subsystems the v1.8.0 doc did not cover. Added the **Control Effectiveness** subsystem (`ControlAssignment` model + `Effectiveness` enum), the **Findings & Actions** subsystem (`Finding` + `Action` models, `FindingSeverity` enum, human-readable `FID-XXXXXX` finding ids), and a CSV-driven **seed / reset pipeline** (`prisma/controls-data.ts`, `seed-controls.ts`, `reset-seed.ts`, plus `db:seed-controls` / `db:reset-seed` scripts). Also corrected the Prisma client output path, technology versions, and the enum count. See §3.2–3.3, §5.7, §6.10 and the changelog in §16.

---

## 1. Executive Summary

The **SEAM Assurance App** is a gamified internal control testing platform designed for oil & gas operations. It enables assessors to:

- **Manage Controls:** Create, categorize, and maintain 28-field control definitions with CSF framework alignment
- **Plan Assessments:** Build assessments from reusable templates or create custom ones with cascading filters
- **Execute Tests:** Record samples and evidence for control effectiveness validation
- **Track Engagement:** Leverage 8 emotional drives through badge system, milestones, and behavior metrics
- **Backup & Restore:** Automatically export/restore critical tables without re-importing from CSV

**Core Design Principle:** Decouple controls from samples—assessments have independent relationships to both, allowing flexible test data management without affecting control selection.

---

## 2. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | Next.js | 16.2.9 | App Router, server actions, hybrid rendering |
| **Language** | TypeScript | 5.x | Type-safe development |
| **Database** | SQLite | 3.x | Self-contained, file-based, no external server |
| **DB Driver** | better-sqlite3 | 12.x | Synchronous SQLite driver used via Prisma driver adapter |
| **ORM** | Prisma | 7.x | Type-safe data access, migrations, driver adapters (`@prisma/adapter-better-sqlite3`) |
| **Auth** | NextAuth.js (Auth.js) | 5.x (beta) | Session-based authentication with JWT |
| **UI** | React | 19.x | Component library, hooks |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS framework |
| **Validation** | Zod | 4.x | Server-action / API input validation |
| **Seeding** | tsx scripts | — | CSV-driven control loader + full reset/reseed |
| **Backup** | Node.js Scripts | CommonJS | Export/restore JSON-based data |

---

## 3. Database Schema (Complete)

### 3.1 Configuration

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
}
```

**Key Points (v1.9.0):**
- The Prisma client is now generated to **`src/generated/prisma`** (imported as `../src/generated/prisma`). Application code imports the client from there via `src/lib/prisma.ts`. (A legacy `prisma/.prisma/client/` directory may still exist from an earlier generation but is not the active output.)
- The `datasource` has **no inline `url`**; the connection is supplied at runtime through the **better-sqlite3 driver adapter** (`@prisma/adapter-better-sqlite3`) using `DATABASE_URL` from `.env` (`file:./dev.db`, resolved at the app root, not `prisma/`).
- Seed/reset scripts (`prisma/seed*.ts`, `reset-seed.ts`) instantiate `PrismaClient` with `new PrismaBetterSqlite3({ url: process.env.DATABASE_URL })`.

---

### 3.2 Enumerations (10 types)

#### **Role**
```
Admin | Assessor
```
Controls access to admin pages and sensitive operations.

#### **LOA (Line of Assurance)**
```
FirstLine | SecondLine | ThirdLine
```
Organizational levels for assurance activities (operational, management, executive).

#### **ControlType** (6 types)
```
Administrative | Procedural | Analytical | Behavioral | Informational | Engineering
```
Classification system for control mechanisms. Used in CSV import, control management, and template filters.

#### **AssessmentStatus**
```
Planned | InProgress | Completed | Cancelled
```
Workflow states for assessments.

#### **SampleStatus**
```
Tested | NotTested
```
Evidence documentation status.

#### **SampleConclusion**
```
Pass | Fail
```
Test result outcome.

#### **EmotionalDrive** (8 drives)
```
Diversity | Belonging | Recognition | Achievement | Excellence | Growth | Contribution | Security
```
Gamification motivators tied to badge earning and point transactions.

#### **BadgeRarity**
```
Common | Uncommon | Rare | Epic | Legendary
```
Achievement badge tiers.

#### **Effectiveness** ⭐ NEW (v1.9.0)
```
Effective | NotEffective
```
Result of assessing a control's effectiveness within an assessment. Stored on `ControlAssignment.effective`; `null` means "Select One" / not yet assessed.

#### **FindingSeverity** ⭐ NEW (v1.9.0)
```
Low | Medium | High | Serious
```
Severity classification for a Finding raised during an assessment.

---

### 3.3 Core Data Models

#### **User** (Authentication & Gamification)
```prisma
model User {
  id                   String    @id @default(cuid())
  name                 String
  username             String    @unique
  passwordHash         String
  role                 Role      @default(Assessor)
  createdAt            DateTime  @default(now())
  
  // Gamification
  totalPoints          Int       @default(0)
  dailyPointStreak     Int       @default(0)
  lastActivityDate     DateTime?
  confidenceInfluencer Boolean   @default(false)
  
  // Relations
  assessments          Assessment[]
  behaviors            BehaviorMeasurement[]
  emotionalDrives      EmotionalDriveMetric[]
  milestones           Milestone[]
  points               PointTransaction[]
  achievements         UserAchievement[]
}
```

**Purpose:** User account with gamification profile. `confidenceInfluencer` flag enables confidence-building feedback for low-assurance users.

---

#### **ProcessArea** (Control Taxonomy - Level 1)
```prisma
model ProcessArea {
  id           String    @id @default(cuid())
  name         String    @unique
  description  String?
  pId          String?           // Process Identifier
  standard     String?           // e.g., "ISO 27001", "SOC 2"
  createdAt    DateTime  @default(now())
  
  // Relations
  controls     Control[]
  subProcesses SubProcess[]
}
```

**Purpose:** Top-level grouping for control hierarchies. Fields `pId` and `standard` support compliance framework alignment.

---

#### **SubProcess** (Control Taxonomy - Level 2)
```prisma
model SubProcess {
  id            String      @id @default(cuid())
  name          String
  description   String?
  processAreaId String      (FK)
  createdAt     DateTime    @default(now())
  
  // Relations
  processArea   ProcessArea @relation(fields: [processAreaId], references: [id])
  controls      Control[]
  
  // Constraint
  @@unique([processAreaId, name])
}
```

**Purpose:** Mid-level grouping under ProcessArea. Enforces unique names per parent.

---

#### **ControlSubProcess** (Many-to-Many Junction) ⭐ NEW (v1.11.0)
```prisma
model ControlSubProcess {
  id           String      @id @default(cuid())
  controlId    String (FK)
  subProcessId String (FK)
  createdAt    DateTime    @default(now())
  
  // Relations
  control      Control     @relation(..., onDelete: Cascade)
  subProcess   SubProcess  @relation(..., onDelete: Cascade)
  
  @@unique([controlId, subProcessId])
  @@index([controlId])
  @@index([subProcessId])
}
```

**Purpose:** Enables a Control to belong to multiple SubProcesses without duplicating the control record. The `Control.subProcessId` field remains the required "primary" home; this junction adds secondary linkages (e.g. the same control applies across ISO 9001, ISO 14001, and ISO 45001). Used in the Process Details page (Tab 2 edit modal) and counted in Process Areas page totals.

---

#### **Control** (28 Fields - Core Control Definition)
```prisma
model Control {
  id                 String @id @default(cuid())
  
  // Basic Info
  name               String
  statement          String
  controlType        ControlType
  
  // Classification
  processAreaId      String (FK)
  subProcessId       String (FK)
  pId                String?
  standard           String?
  
  // Risk Profile
  isHsseCritical     Boolean   @default(false)
  ramRating          String?
  riskWeight         Int       @default(1)
  rawHealthScore     Int       @default(80)
  
  // Testing History
  lastTestedDate     DateTime?
  lastTestResult     String?
  
  // Documentation
  controlRef         String?
  sourceFile         String?
  practiceDocument   String?
  controlTypeDetail  String?
  
  // CSF Framework (7 fields)
  csfWho             String?
  csfWhat            String?
  csfWhen            String?
  csfWhere           String?
  csfWhy             String?
  csfHow             String?
  csfEvidence        String?
  
  // Additional Details
  keyActivities      String?
  riskAddressed      String?
  testingApproach    String?
  uncertainFlags     String?
  Requirements       String?
  
  createdAt          DateTime  @default(now())
  
  // Relations (DECOUPLED v1.8.0)
  controlAssignments ControlAssignment[]                 // controls assigned + effectiveness
  templateLinkages   AssessmentTemplateControlLinkage[]
  subProcess         SubProcess @relation(...)
  processArea        ProcessArea @relation(...)
  
  @@index([controlRef])
}
```

**Purpose:** Comprehensive control definition with 28 fields. Supports CSV import/export. See section 5.2 for full field documentation.

**Key Change (v1.10.0):** Now links to assessments exclusively via the `ControlAssignment` junction table (not via samples). The earlier `AssessmentControl` junction table (v1.8.0) has been removed — see §16.5.

---

#### **AssuranceActivityType** (Activity Classification)
```prisma
model AssuranceActivityType {
  id               String @id @default(cuid())
  name             String @unique
  description      String?
  defaultLOA       LOA
  createdAt        DateTime @default(now())
  
  // Relations
  assessments      Assessment[]
  templateLinkages AssessmentTemplateActivityType[]
}
```

**Purpose:** Lookup table for assessment activity types (e.g., "Internal Audit", "Management Review").

---

#### **Assessment** (Assessment Instance)
```prisma
model Assessment {
  id                 String @id @default(cuid())
  name               String
  activityTypeId     String (FK)
  assessorId         String (FK)
  startDate          DateTime
  endDate            DateTime?
  loa                LOA
  status             AssessmentStatus @default(Planned)
  createdAt          DateTime @default(now())
  
  // Relations
  assessor           User @relation("AssessmentAssessor", ...)
  activityType       AssuranceActivityType @relation(...)
  controlAssignments ControlAssignment[]   // controls assigned + effectiveness
  samples            Sample[]
  findings           Finding[]             // ⭐ NEW v1.9.0
}
```

**Purpose:** Represents a single assessment instance with assigned controls and test samples.

**Architecture (v1.8.0, junction consolidated in v1.10.0):**
- `controlAssignments` → controls assigned to this assessment (+ effectiveness conclusion)
- `samples` → evidence/test data collected independently
- **Decoupled:** Changing controls doesn't delete samples

---

#### **ControlAssignment** — Control ↔ Assessment with Effectiveness
```prisma
model ControlAssignment {
  id                 String         @id @default(cuid())
  assessmentId       String (FK)
  controlId          String (FK)
  effective          Effectiveness? // null = "Select One" (not yet assessed)
  effectiveUpdatedAt DateTime?      // set only when `effective` changes
  createdAt          DateTime       @default(now())

  // Relations
  control            Control    @relation(..., onDelete: Cascade)
  assessment         Assessment @relation(..., onDelete: Cascade)

  @@unique([assessmentId, controlId])
  @@index([assessmentId])
  @@index([controlId])
}
```

**Purpose:** Assigns Controls to an Assessment from the FLA detail screen and records the assessor's **effectiveness conclusion** per control (`Effective` / `NotEffective`, or unset). `effectiveUpdatedAt` is stamped only when `effective` is changed, giving an audit point for when the conclusion was reached.

**Behaviour:**
- Adding/removing controls in the FLA UI creates/deletes `ControlAssignment` rows.
- Editing the "Effective" dropdown calls `PUT /api/admin/control-assignments/[id]` (sets `effective` + `effectiveUpdatedAt`); an omitted field is never silently nulled.
- Unassigning calls `DELETE /api/admin/control-assignments/[id]`.

---

#### **Sample** (Test Evidence)
```prisma
model Sample {
  id               String @id @default(cuid())
  assessmentId     String (FK)
  sampleTypeId     String? (FK)
  recordSourceId   String? (FK)
  recordReference  String?
  controlEffective Boolean @default(false)
  comment          String?
  status           SampleStatus @default(NotTested)
  conclusion       SampleConclusion?
  evidenceUrl      String?
  createdAt        DateTime @default(now())
  
  // Relations
  assessment       Assessment @relation(..., onDelete: Cascade)
  sampleType       SampleType? @relation(...)
  recordSource     RecordSourceType? @relation(...)
}
```

**Purpose:** Evidence/test record for an assessment. Completely decoupled from control selection.

**Change (v1.8.0):** Removed `controlId` field. Control associations managed via the assessment↔control junction (`ControlAssignment` as of v1.10.0).

**Change (v1.9.0):** A Sample can now be the source of one or more `Finding` records (`findings Finding[]`).

---

#### **Finding** ⭐ NEW (v1.9.0) — Assessment Finding
```prisma
model Finding {
  id           String          @id           // human-readable "FID-XXXXXX" (not a cuid)
  assessmentId String (FK)                    // required
  sampleId     String? (FK)                   // optional — the sample it was observed from
  description  String
  details      String?
  controlIds   String?                        // controls implicated (delimited string)
  risks        String?
  repeat       Boolean         @default(false) // repeat finding?
  severity     FindingSeverity
  createdAt    DateTime        @default(now())

  // Relations
  assessment   Assessment @relation(..., onDelete: Cascade)
  sample       Sample?    @relation(..., onDelete: SetNull)
  actions      Action[]

  @@index([assessmentId])
  @@index([sampleId])
}
```

**Purpose:** A finding raised during an assessment. Uses a **running human-readable id** in the `FID-XXXXXX` convention (e.g. `FID-000001`) generated in application code (`src/lib/findings.ts` → `generateFindingId()`), which scans existing ids for the highest suffix and increments — remaining correct even if earlier findings were deleted. A finding is always tied to an Assessment and optionally to the specific Sample it came from (deleting that sample sets `sampleId` to null rather than cascading).

---

#### **Action** ⭐ NEW (v1.9.0) — Remediation Action
```prisma
model Action {
  id                      String    @id @default(cuid())
  findingId               String (FK)
  actionDescription       String
  actionDetails           String?
  actionParty             String?           // who is responsible
  auditee                 String?
  createdDate             DateTime  @default(now())
  targetDate              DateTime?
  apAgreed                Boolean   @default(false)  // action party agreed?
  originalTargetDate      DateTime?
  numberOfExtensions      Int       @default(0)
  actionClosureEffective  Boolean   @default(false)
  actionClosureApprovedBy String?
  finding                 Finding   @relation(..., onDelete: Cascade)

  @@index([findingId])
}
```

**Purpose:** A remediation item tied to exactly one Finding. Tracks ownership (`actionParty`, `auditee`), agreement (`apAgreed`), scheduling with extension history (`targetDate`, `originalTargetDate`, `numberOfExtensions`), and closure (`actionClosureEffective`, `actionClosureApprovedBy`). Deleting a Finding cascades to its Actions.

---

#### **AssessmentTemplate** (Reusable Blueprint)
```prisma
model AssessmentTemplate {
  id              String @id @default(cuid())
  name            String @unique
  description     String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relations
  controlLinkages AssessmentTemplateControlLinkage[]
  activityTypes   AssessmentTemplateActivityType[]
}
```

**Purpose:** Reusable assessment blueprint pre-selecting controls and activity types.

---

#### **AssessmentTemplateControlLinkage** (Template ↔ Control)
```prisma
model AssessmentTemplateControlLinkage {
  id         String @id @default(cuid())
  templateId String (FK)
  controlId  String (FK)
  createdAt  DateTime @default(now())
  
  // Relations
  template   AssessmentTemplate @relation(..., onDelete: Cascade)
  control    Control @relation(..., onDelete: Cascade)
  
  // Constraint
  @@unique([templateId, controlId])
  @@index([templateId])
  @@index([controlId])
}
```

---

#### **AssessmentTemplateActivityType** (Template ↔ Activity Type)
```prisma
model AssessmentTemplateActivityType {
  id             String @id @default(cuid())
  templateId     String (FK)
  activityTypeId String (FK)
  createdAt      DateTime @default(now())
  
  // Relations
  template       AssessmentTemplate @relation(..., onDelete: Cascade)
  activityType   AssuranceActivityType @relation(..., onDelete: Cascade)
  
  // Constraint
  @@unique([templateId, activityTypeId])
  @@index([templateId])
  @@index([activityTypeId])
}
```

---

#### **SampleType & RecordSourceType** (Lookup Tables)
```prisma
model SampleType {
  id        String @id @default(cuid())
  name      String @unique
  createdAt DateTime @default(now())
  samples   Sample[]
}

model RecordSourceType {
  id        String @id @default(cuid())
  name      String @unique
  createdAt DateTime @default(now())
  samples   Sample[]
}
```

**Purpose:** Dynamic lookup tables allowing users to add custom sample types and record sources on-the-fly.

---

### 3.4 Gamification Models

#### **AchievementBadge** (Badge Definition)
```prisma
model AchievementBadge {
  id               String @id @default(cuid())
  name             String @unique
  description      String
  icon             String
  emotionalDrive   EmotionalDrive
  rarity           BadgeRarity @default(Uncommon)
  pointsRequired   Int?
  controlsChecked  Int?
  streakDays       Int?
  achievementType  String
  createdAt        DateTime @default(now())
  userAchievements UserAchievement[]
  
  @@index([emotionalDrive])
}
```

**Purpose:** Definition of badges tied to emotional drives. Earning criteria: points, control count, or streak.

---

#### **UserAchievement** (Badge Instance)
```prisma
model UserAchievement {
  id       String @id @default(cuid())
  userId   String (FK)
  badgeId  String (FK)
  earnedAt DateTime @default(now())
  
  // Relations
  user     User @relation(..., onDelete: Cascade)
  badge    AchievementBadge @relation(...)
  
  // Constraint
  @@unique([userId, badgeId])
  @@index([userId])
}
```

---

#### **PointTransaction** (Point Activity Log)
```prisma
model PointTransaction {
  id             String @id @default(cuid())
  userId         String (FK)
  points         Int
  reason         String
  assessmentId   String?
  sampleId       String?
  emotionalDrive EmotionalDrive?
  multiplier     Float @default(1.0)
  createdAt      DateTime @default(now())
  
  // Relations
  user           User @relation(..., onDelete: Cascade)
  
  @@index([userId])
  @@index([createdAt])
}
```

**Purpose:** Audit trail of point awards tied to actions (control tested, sample recorded, etc.).

---

#### **BehaviorMeasurement** (Daily Tracking)
```prisma
model BehaviorMeasurement {
  id                 String @id @default(cuid())
  userId             String (FK)
  date               DateTime
  plansMade          Int @default(0)
  controlsTested     Int @default(0)
  evidenceDocumented Int @default(0)
  teamEngagement     Boolean @default(false)
  qualityScore       Float @default(0)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  
  // Relations
  user               User @relation(..., onDelete: Cascade)
  
  // Constraint
  @@unique([userId, date])
  @@index([userId])
  @@index([date])
}
```

**Purpose:** Daily snapshot of user behavior and engagement metrics.

---

#### **EmotionalDriveMetric** (Weekly/Monthly Rollup)
```prisma
model EmotionalDriveMetric {
  id                String @id @default(cuid())
  userId            String (FK)
  period            DateTime
  
  // 8 Emotional Drives (0-100 scale)
  diversity         Int @default(0)
  belonging         Int @default(0)
  recognition       Int @default(0)
  achievement       Int @default(0)
  excellence        Int @default(0)
  growth            Int @default(0)
  contribution      Int @default(0)
  security          Int @default(0)
  
  // Summary
  overallEngagement Float @default(0)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  user              User @relation(..., onDelete: Cascade)
  
  // Constraint
  @@unique([userId, period])
  @@index([userId])
}
```

**Purpose:** Aggregated emotional drive scores for a user in a given period (week/month).

---

#### **Milestone** (Progress Goals)
```prisma
model Milestone {
  id           String @id @default(cuid())
  userId       String (FK)
  title        String
  description  String?
  type         String
  targetValue  Int
  currentValue Int @default(0)
  completedAt  DateTime?
  createdAt    DateTime @default(now())
  
  // Relations
  user         User @relation(..., onDelete: Cascade)
  
  // Constraint
  @@index([userId])
  @@index([completedAt])
}
```

**Purpose:** Progress tracking toward goals (e.g., "Test 50 Controls", "Earn 1000 Points").

---

### 3.5 Database Relationships (Complete Map)

```
User
  ├─ Assessment[] (assessor)
  ├─ BehaviorMeasurement[]
  ├─ EmotionalDriveMetric[]
  ├─ Milestone[]
  ├─ PointTransaction[]
  └─ UserAchievement[]

Assessment
  ├─ User (assessor)
  ├─ AssuranceActivityType
  ├─ ControlAssignment[]   (control + effectiveness; sole assessment↔control junction as of v1.10.0)
  │   └─ Control
  ├─ Sample[] (independent)
  └─ Finding[] ← NEW (v1.9.0)
      ├─ Sample? (optional source)
      └─ Action[] ← NEW (v1.9.0)

Control
  ├─ ProcessArea
  ├─ SubProcess
  ├─ ControlAssignment[]
  └─ AssessmentTemplateControlLinkage[]

AssessmentTemplate
  ├─ AssessmentTemplateControlLinkage[]
  └─ AssessmentTemplateActivityType[]

Sample (DECOUPLED v1.8.0)
  ├─ Assessment (only link to control selection)
  ├─ SampleType?
  ├─ RecordSourceType?
  └─ Finding[] ← NEW (v1.9.0, optional back-reference)

Finding ← NEW (v1.9.0)
  ├─ Assessment (required)
  ├─ Sample? (optional)
  └─ Action[]

Action ← NEW (v1.9.0)
  └─ Finding (parent)
```

---

## 4. Architecture & Project Structure

```
seam-assurance-app/
├── prisma/
│   ├── schema.prisma                  # Complete Prisma data model
│   ├── .prisma/client/               # Generated Prisma client
│   └── migrations/                    # Database migration history
│
├── src/
│   ├── auth.ts                        # NextAuth configuration
│   ├── auth.config.ts                 # Auth callbacks & JWT handling
│   ├── middleware.ts                  # Next.js middleware for auth
│   ├── lib/
│   │   ├── prisma.ts                  # Prisma singleton instance
│   │   ├── schema-introspection.ts    # Dynamic DMMF schema loader
│   │   └── fallback-schemas.json      # Backup schema (JSON)
│   │
│   ├── app/
│   │   ├── layout.tsx                 # Root layout + navigation
│   │   ├── page.tsx                   # Dashboard home
│   │   ├── login/page.tsx             # Login form
│   │   │
│   │   ├── fla/                       # Assessment management
│   │   │   ├── page.tsx               # Assessment list (FLA Dashboard)
│   │   │   ├── new/page.tsx           # Create new assessment
│   │   │   └── [id]/
│   │   │       ├── page.tsx           # Assessment detail (controls + samples)
│   │   │       ├── ControlsSelector.tsx        # Multi-select control picker
│   │   │       ├── ControlsSelectorWrapper.tsx # Auto-save wrapper
│   │   │       ├── SamplesTable.tsx           # Paginated samples (10 items/page)
│   │   │       ├── SampleRow.tsx              # Sample row (view/edit mode)
│   │   │       └── AddSamplesForm.tsx         # Add sample modal
│   │   │
│   │   ├── setup/                     # Data management
│   │   │   ├── process-areas/
│   │   │   │   ├── page.tsx           # Process Areas list + pagination
│   │   │   │   ├── ProcessAreasTable.tsx     # Table with Standard filter
│   │   │   │   └── ProcessAreaForm.tsx       # Add/edit form
│   │   │   ├── processdetails/[id]/
│   │   │   │   ├── page.tsx           # Process Details (3-tab drill-down)
│   │   │   │   └── ProcessDetailsClient.tsx  # Tabs: Overview, Sub-process & Controls, Assessments
│   │   │   ├── sub-processes/
│   │   │   │   ├── page.tsx           # Sub-Processes list
│   │   │   │   └── SubProcessesTable.tsx    # Paginated table
│   │   │   ├── activity-types/
│   │   │   │   ├── page.tsx           # Activity Types list
│   │   │   │   └── ActivityTypesTable.tsx  # Paginated table
│   │   │   └── controls/
│   │   │       ├── page.tsx           # Controls list (30 items/page default)
│   │   │       ├── ControlForm.tsx    # Create/edit form (28 fields)
│   │   │       ├── ControlsTable.tsx  # Table with sorting
│   │   │       └── actions.ts         # Server actions (save/delete)
│   │   │
│   │   ├── admin/
│   │   │   ├── page.tsx               # Admin dashboard (tiles)
│   │   │   ├── columns/page.tsx       # Column management UI
│   │   │   ├── database-management/page.tsx  # Database management module
│   │   │   ├── import-csv/page.tsx    # CSV import with validation
│   │   │   ├── export-data/page.tsx   # Export all tables
│   │   │   ├── templates/
│   │   │   │   ├── page.tsx           # Assessment Templates list
│   │   │   │   └── [id]/page.tsx      # Template create/edit form
│   │   │   ├── assessments/
│   │   │   │   ├── page.tsx           # Assessment list (admin view)
│   │   │   │   ├── create/page.tsx    # Create from scratch
│   │   │   │   └── from-template/[templateId]/page.tsx
│   │   │   └── table/[table]/page.tsx # Generic table editor with SQL executor
│   │   │
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       └── admin/
│   │           ├── check/route.ts     # Admin auth check
│   │           ├── assessments/[id]/controls/route.ts  # Control selection (PUT)
│   │           ├── database/
│   │           │   ├── tables/route.ts           # List/create tables
│   │           │   ├── tables/[name]/route.ts    # Drop table
│   │           │   └── sync-check/route.ts       # Schema sync verification
│   │           ├── samples/route.ts   # Sample CRUD (GET/POST)
│   │           ├── samples/[id]/route.ts  # Sample detail (PUT/DELETE)
│   │           ├── validate-csv/route.ts  # CSV validation engine
│   │           ├── import-csv/route.ts    # CSV bulk import
│   │           ├── table/[table]/columns/route.ts        # Column mgmt
│   │           ├── table/[table]/columns/[columnName]/route.ts
│   │           ├── table/[table]/data/route.ts   # Row CRUD
│   │           ├── table/[table]/[id]/route.ts   # Row detail
│   │           ├── table/[table]/clear/route.ts  # Clear table (DROP/RECREATE)
│   │           ├── execute-sql/route.ts  # Direct SQL execution (admin-only)
│   │           ├── assessment-templates/route.ts
│   │           └── assessment-templates/[id]/route.ts
│   │
│   └── styles/
│       └── globals.css                # Tailwind directives
│
├── scripts/
│   ├── export-data.js                 # Backup 4 critical tables → JSON
│   └── restore-data.js                # Restore from JSON → Database
│
├── data/                              # JSON backup files (created on export)
│   ├── ProcessAreas.json
│   ├── SubProcesses.json
│   ├── Controls.json
│   ├── ActivityTypes.json
│   └── BACKUP_METADATA.json
│
├── dbBackup/                          # Schema backups (manual)
│   └── APP_DESIGNbackup_[datetime].md
│
├── package.json
├── tsconfig.json
├── .env.local                         # Environment config
├── next.config.js
└── dev.db                             # SQLite database file
```

---

## 5. Key Features & Pages

### 5.1 Authentication & Authorization

**NextAuth.js Setup:**
- Session-based JWT authentication
- Password hashing (bcrypt-compatible)
- Admin role verification on sensitive endpoints
- Middleware protection for `/admin`, `/setup`, `/fla` routes

**Access Control:**
- **Admin Only:** Admin dashboard, table management, CSV import, column management, SQL executor, database management
- **Assessor+:** Create/manage assessments, test controls, view dashboards
- **Public:** Only login page (all others protected)

---

### 5.2 Assessment Management (`/fla`)

#### Dashboard (`/fla`)
- List of all assessments with status badges (Planned/InProgress/Completed/Cancelled)
- Action buttons: View, Edit, Delete
- Filters: Status, Assessor, Activity Type
- Create button for new assessment

#### Create Assessment (`/fla/new`)
- **Form Fields:**
  - Assessment Name (required)
  - Activity Type (dropdown, required)
  - Assessor (dropdown, defaults to current user)
  - Start Date (date picker)
  - End Date (date picker, optional)
  - Line of Assurance (dropdown: FirstLine/SecondLine/ThirdLine)
  - Status (dropdown, defaults to "Planned")
  
- **Control Selection:**
  - Cascading filters: Process Area → Sub-Process → Wildcard Search
  - Multi-select checkboxes for control assignment
  - Selection counter: "Selected: X / 1048"
  - "Select All" / "Deselect All" buttons
  
- **Submit:** Immediately creates assessment and controls linkage

#### Assessment Detail (`/fla/[id]`)

**Section 1: Assessment Info**
- Editable fields: Name, Activity Type, Assessor, Start/End Date, LOA, Status
- Save button persists changes

**Section 2: Assigned Controls**
- Display box showing all currently assigned controls
- Format: Checkmark + Control Name + Process Area / Sub-Process
- Auto-updates when controls are added/removed

**Section 3: Control Selection**
- Same cascading filter interface as create
- Filter by: Process Area, Sub-Process, Wildcard Search
- Multi-select checkboxes
- **Auto-Save on Change:** Calls PUT `/api/admin/assessments/[id]/controls`
- Success/Error feedback with auto-dismiss

**Section 4: Samples**
- Paginated table (10 items per page)
- **Columns:** Sample Type | Record Source | Record Reference | Effective | Status | Comment | Edit/Delete
- **View Mode:** Displays data, comments truncated
- **Edit Mode:** Inline form with textarea for comments
- **Add Sample Button:** Opens modal with form:
  - Sample Type (dropdown + "Add New" link for dynamic creation)
  - Record Source (dropdown + "Add New" link)
  - Record Reference (text)
  - Control Effective (checkbox)
  - Status (dropdown: Tested/NotTested)
  - Comment (textarea, 3 rows)
  - Buttons: Add Sample | Cancel

---

### 5.3 Setup & Management (`/setup`)

#### Process Areas (`/setup/process-areas`)
- **Filter:** Standard (alphabetical dropdown)
- **Pagination:** 30 items/page with compact pagination
- **Table Columns:** pId | Name | Description | Standard | Sub-Process Count | Control Count | Actions
- **Create/Edit Form:**
  - Name (required, unique)
  - Description (textarea)
  - pId (optional, Process Identifier)
  - Standard (optional, e.g., "ISO 27001", "SOC 2")
- **Actions:** Edit, Delete (with cascading confirmation if children exist)
- **Process Area Name Link:** Clickable, navigates to `/setup/processdetails/[id]` for detailed drill-down

#### Process Details (`/setup/processdetails/[id]`)
- **Page Title:** "Process Details"
- **Breadcrumb:** ← Process Areas (back to list)
- **3-Tab Layout:**

**Tab 1 — Process Overview:**
- Summary stat cards: Total Controls, Total Assessments, Total Findings, Total Actions
- **Process Health** section with health bars:
  - Control Effectiveness (Effective / Not Effective / Not Yet Assessed)
  - Assessment Activity (Planned / In Progress + Completed)
  - Sample Testing (Tested / Failed)
- **Outstanding Actions from Findings** — lists findings with actions, severity badges, links to assessment
- **Sub-Process Summary** — grid of sub-process cards

**Tab 2 — Sub-process & Controls:**
- Grouped by sub-process (expandable sections)
- Controls table per sub-process: Control Name | Type | Health Score | Risk | Last Tested | Result | Assignments
- Control names are **clickable** → opens inline edit modal (Name, Statement, Control Type, Risk Weight, RAM Rating, Health Score, HSSE Critical, **Linked Sub-Processes** multi-select)
  - Linked Sub-Processes section shows all sub-processes in this process area with checkboxes
  - Primary sub-process is marked "(primary)" and cannot be unchecked
  - Changes to links are saved when the modal's Save button is clicked
- "+Add Control" button in the action column header → opens inline modal (Control Name, Statement, Control Type)
- "Edit | Delete" action links per row (replaces assignment count column)
  - Edit opens the same inline edit modal with prepopulated fields
  - Delete shows a confirmation dialog with Cancel/Delete buttons

**Tab 3 — Assessments:**
- Lists all assessments with controls from this process area
- Table: Name | Activity Type | Assessor | Status | Start Date | Findings | Actions | Controls
- **"+Add Assessment" button:**
  - Opens modal with Name, Start Date, and Control Selection
  - All process controls are pre-selected by default
  - User can toggle individual controls or Select All / Deselect All
  - Creates assessment via `POST /api/admin/assessments` with `controlIds` → redirects to `/fla/[id]`

#### Sub-Processes (`/setup/sub-processes`)
- **Filter:** Process Area (required dropdown)
- **Pagination:** 30 items/page
- **Table Columns:** Process Area | Name | Description | Control Count | Actions
- **Create/Edit Form:**
  - Name (required)
  - Description (optional)
  - Constraint: unique(ProcessAreaId, Name)

#### Activity Types (`/setup/activity-types`)
- **Pagination:** 30 items/page
- **Table Columns:** Name | Default LOA | Description | Assessment Count | Actions
- **Create/Edit Form:**
  - Name (required, unique)
  - Default LOA (dropdown: FirstLine/SecondLine/ThirdLine)
  - Description (optional)

#### Controls (`/setup/controls`)
- **Pagination:** 30 items/page (options: 10, 30, 50, 100)
- **Column Sorting:** Click header to sort (↑ ascending, ↓ descending)
- **Table Columns:** Name | Statement | Control Type | Process Area | Sub-Process | HSSE Critical | Last Tested | Status | Actions
- **Create/Edit Form (28 Fields):**

| Category | Fields |
|----------|--------|
| **Basic** | Name, Statement |
| **Classification** | Control Type, Process Area, Sub-Process, pId, Standard |
| **Risk Profile** | HSSE Critical (checkbox), RAM Rating, Risk Weight, Raw Health Score |
| **History** | Last Tested Date, Last Test Result |
| **Documentation** | Control Ref, Source File, Practice Document, Control Type Detail |
| **CSF Framework** | Who, What, When, Where, Why, How, Evidence |
| **Details** | Key Activities, Risk Addressed, Testing Approach, Uncertain Flags, Requirements |

---

### 5.4 Assessment Templates (`/admin/templates`)

#### Templates List
- Card view of all templates
- Shows: Name, Description, Control Count, Activity Type Name, Creation Date
- First 3 controls displayed; "+N more" badge if additional
- **Actions:** Edit, Delete buttons

#### Create/Edit Template (`/admin/templates/[id]`)
- **Form Fields:**
  - Template Name (required, unique)
  - Description (textarea)
  - **Controls Section:**
    - Filter by Process Area (dropdown)
    - Filter by Sub-Process (cascades based on PA)
    - Multi-select checkboxes for controls
    - Selection counter: "Selected: X / Y"
  - **Activity Types Section:**
    - Filter by Line of Assurance (dropdown)
    - **Radio buttons (single select only)**
    - Only one activity type per template
- **Buttons:** Save, Cancel

---

### 5.5 Admin Console (`/admin`)

#### Dashboard
- Quick access tiles:
  - 📋 Assessment Templates
  - ⚙️ Manage Columns
  - 📤 Import CSV
  - 📊 Database Management
- Table browser (10+ tables with icons)
- Warning banner about backups

#### CSV Import (`/admin/import-csv`)
- **File Upload:** Drag-and-drop or click-to-upload
- **Real-Time Validation:**
  - Shows: Total rows, valid rows, invalid rows
  - Error/warning summary grouped by row
  - Expandable row details with field-level errors
  - Download full report button
- **Import Button:** Disabled until validation passes
- **Validation Checks:**
  - Required fields present
  - Enum values valid
  - Foreign keys exist
  - Date formats correct
  - Empty row filtering

#### Column Management (`/admin/columns`)
- **Table Selector:** Dropdown of all tables
- **Current Columns Display:**
  - Name | Data Type | Required | Primary Key | Actions
  - List all columns for selected table
- **Add New Column Form:**
  - Column Name (alphanumeric, starts with letter/underscore)
  - Data Type (dropdown: String, Int, Float, Boolean, DateTime, Json)
  - Required (checkbox)
  - Add Column button
- **Process:**
  1. Updates `prisma/schema.prisma`
  2. Runs migration: `npx prisma migrate dev`
  3. Regenerates Prisma client
  4. Updates `fallback-schemas.json`

#### Database Management (`/admin/database-management`)
- **Table List:** All tables with column count, row count
- **Create Table Form:** New table name, basic schema
- **Drop Table:** Confirmation dialog, prevents dropping system tables
- **Column Management:** Add/remove columns for selected table
- **Check Sync:** Verify database and schema are synchronized

#### Table Editor (`/admin/table/[table]`)
- **Features:**
  - Dynamic column discovery (from database or schema)
  - Multi-select rows with "select all" checkbox
  - "Delete Selected" button
  - "Clear Entire Table" button (DROP & RECREATE)
  - **Column Sorting:** Click headers to sort (↑/↓ indicators)
  - **Sort Status:** Display below table with "[Clear Sort]" button
  - Horizontal/vertical scrolling
  - Fixed height container (500px)
  - Shows all records (no pagination limit)

#### SQL Query Executor (`/admin/table/[table]` footer)
- **Admin-Only Feature**
- **Query Input:** Text area with placeholder example
- **Safety Warning Modal:**
  - Lists critical risks
  - Shows query preview
  - Requires explicit "Execute at Own Risk" confirmation
- **Results Display:**
  - Number of rows returned/affected
  - Formatted table (first 100 rows)
  - NULL values shown as "∅"
  - Long values truncated to 50 chars
- **Error Handling:** Red error box with details
- **Blocked Operations:**
  - DROP DATABASE
  - DELETE FROM sqlite_master
  - PRAGMA database_list

---

### 5.6 Data Backup & Restoration

#### Export Script (`scripts/export-data.js`)
- **Usage:** `node scripts/export-data.js`
- **Exports 4 critical tables to JSON:**
  - ProcessAreas.json
  - SubProcesses.json
  - Controls.json (all 28 fields)
  - ActivityTypes.json
- **Output Directory:** `data/`
- **Metadata:** `BACKUP_METADATA.json` with export timestamps and row counts
- **Preserves:** Original IDs and relationships

#### Restore Script (`scripts/restore-data.js`)
- **Usage:** `node scripts/restore-data.js`
- **Prerequisites:**
  - Database schema exists (run migrations first)
  - JSON backup files present in `data/` directory
- **Process:**
  1. Reads JSON backup files
  2. Creates records with original IDs
  3. Preserves all relationships
  4. Restores all 28 Control fields
- **Output:** Summary of restored records

#### Backup Workflow
```bash
# 1. Before making changes, backup data
node scripts/export-data.js

# 2. Make changes (reset database, migrate, etc.)
npx prisma migrate reset

# 3. Restore your data
node scripts/restore-data.js

# 4. Verify data is restored
npm run dev
```

---

### 5.7 Control Effectiveness, Findings & Actions (FLA Detail) ⭐ NEW (v1.9.0)

The FLA assessment detail page (`/fla/[id]`) is now the hub for the full first-line-assurance workflow. `src/app/fla/[id]/page.tsx` loads the assessment with its `controlAssignments` (+ control/processArea/subProcess), `samples` (+ sampleType), and `findings` (+ actions and optional sample), and orchestrates several client components.

**Workflow on the page:**

1. **Assess Info** — editable Name, Activity Type, Assessor, Start/End Date, LOA, Status (server action `updateAssessment`).
2. **Controls (assignment + effectiveness)**
   - `ControlsSelectorWrapper` / `ControlsSelector` — filter (Process Area → Sub-Process → search) and multi-select controls to assign. Assigning creates `ControlAssignment` rows.
   - `AssignedControlsTable` — lists assigned controls with an inline **Effective** dropdown (`Effective` / `NotEffective` / unset) and an **Unassign** action. Editing effectiveness calls `PUT /api/admin/control-assignments/[id]`; unassign calls `DELETE`.
   - The page derives an `assignmentsKey` from each assignment's id + effectiveness + `effectiveUpdatedAt` so the client components remount and pick up fresh data after changes.
3. **Evidence, Samples & Findings** — `EvidenceSection` renders:
   - `SamplesTable` / `SampleRow` / `AddSamplesForm` — collect evidence samples (Sample Type, Record Source, Record Reference, Control Effective, Status, Comment). Sample/Record types are dynamic lookup tables (`SampleType`, `RecordSourceType`) with "Add New".
   - `FindingsTable` — raise **Findings** against the assessment (and optionally a specific sample): description, details, implicated control ids, risks, repeat flag, and **severity** (`Low`/`Medium`/`High`/`Serious`). New findings get an `FID-XXXXXX` id.
   - `ActionsPanel` — for each finding, manage **Actions**: description/details, action party, auditee, target date (with original target + extension count), action-party-agreed flag, and closure (effective + approved-by).

**Supporting API:** `/api/admin/control-assignments/[id]` (PUT/DELETE), `/api/admin/samples` (+`/[id]`), `/api/admin/findings` (+`/[id]`), `/api/admin/actions` (+`/[id]`). See §6.10.

---

## 6. API Routes (Complete Reference)

### 6.1 Assessment Management

**PUT** `/api/admin/assessments/[id]/controls`
- **Body:** `{ controlIds: string[] }`
- **Purpose:** Bulk set the assigned control set for an assessment via the `ControlAssignment` junction table (add/remove controls)
- **Operation:**
  1. Validates assessment exists
  2. Validates all control IDs
  3. Diffs against existing `ControlAssignment` rows for the assessment
  4. Deletes assignments for removed controls, creates assignments for newly added controls
- **Response:** `{ success: true, message: "Updated controls: added X, removed Y, kept Z" }`

---

### 6.2 Sample Management

**GET** `/api/admin/samples`
- Returns all samples with relations
- Query params: `assessmentId`, `page`, `limit`

**POST** `/api/admin/samples`
- Create new sample
- Body: `{ assessmentId, sampleTypeId?, recordSourceId?, recordReference?, controlEffective, status, comment }`

**PUT** `/api/admin/samples/[id]`
- Update sample fields and relationships
- Body: Any sample fields

**DELETE** `/api/admin/samples/[id]`
- Delete sample by ID

---

### 6.3 Assessment Templates

**GET** `/api/admin/assessment-templates`
- List all templates with relations (controls, activity types)

**POST** `/api/admin/assessment-templates`
- Create new template
- Body: `{ name, description?, controlIds: [], activityTypeIds: [] }`
- Validates control and activity type IDs exist

**GET** `/api/admin/assessment-templates/[id]`
- Fetch single template with relations

**PUT** `/api/admin/assessment-templates/[id]`
- Update template and sync linkages
- Body: `{ name?, description?, controlIds: [], activityTypeIds: [] }`

**DELETE** `/api/admin/assessment-templates/[id]`
- Delete template (cascade deletes linkages)

---

### 6.4 CSV Management

**POST** `/api/admin/validate-csv`
- Validate CSV file before import
- Multipart form: `file` (CSV file)
- Returns: `{ totalRows, validRows, invalidRows, errors[], warnings[] }`

**POST** `/api/admin/import-csv`
- Bulk import CSV to table
- Body: `{ table, csvData, skipExisting? }`
- Handles: Boolean parsing, enum validation, FK checks, date formats

**GET** `/api/admin/template/[table]`
- Download CSV template with headers
- For Control: includes sample ProcessArea/SubProcess IDs

---

### 6.5 Table Management

**GET** `/api/admin/table/[table]/data`
- Fetch all rows from table (no pagination limit)

**POST** `/api/admin/table/[table]/data`
- Create new row
- Body: Field values

**PUT** `/api/admin/table/[table]/[id]`
- Update single row

**DELETE** `/api/admin/table/[table]/[id]`
- Delete single row
- Returns 409 Conflict if children exist (with dependent records list)
- Query param: `?cascade=true` to delete children first

**DELETE** `/api/admin/table/[table]/clear`
- Drop and recreate table (single operation)
- Process: Retrieve CREATE DDL → DROP → RECREATE → VACUUM
- Returns empty table

---

### 6.6 Column Management

**GET** `/api/admin/table/[table]/columns`
- List all columns for table
- Queries database first (master source), falls back to schema
- Returns: Column name, data type, required, primary key flags

**POST** `/api/admin/table/[table]/columns`
- Add new column
- Body: `{ columnName, dataType, required? }`
- Process: Update schema → Migration → Prisma generate → Update fallback

**DELETE** `/api/admin/table/[table]/columns/[columnName]`
- Remove column
- Process: Update schema → Migration → Prisma generate → Update fallback

---

### 6.7 Database Management

**GET** `/api/admin/database/tables`
- List all tables with metadata (column count, row count)
- Uses SQLite PRAGMA commands

**POST** `/api/admin/database/tables`
- Create new table with basic schema (id, createdAt)

**DELETE** `/api/admin/database/tables/[name]`
- Drop specified table
- Prevents dropping system tables
- Runs VACUUM after drop

**GET** `/api/admin/database/sync-check`
- Verify database and schema are synchronized
- Lists existing and missing tables
- Provides migration guidance

---

### 6.8 SQL Query Executor

**POST** `/api/admin/execute-sql`
- Execute arbitrary SQL (admin-only, returns 403 if not admin)
- Body: `{ sql: "SELECT ..." }`
- Returns: `{ success, result: {...}, message: "..." }`
- **Blocked Operations:**
  - DROP DATABASE
  - DELETE FROM sqlite_master
  - PRAGMA database_list
- Uses Prisma `$queryRawUnsafe`

---

### 6.9 Authentication

**GET** `/api/auth/[...nextauth]`
- NextAuth.js provider routes
- Supports: Credentials provider (username/password)

**GET** `/api/admin/check`
- Verify user is admin
- Returns: `{ isAdmin: true/false }`

---

### 6.10 New Routes (v1.9.0)

**Control Assignments**
- **PUT** `/api/admin/control-assignments/[id]` — set a control's effectiveness. Body: `{ effective: "Effective" | "NotEffective" | null }`. Also stamps `effectiveUpdatedAt` (only when `effective` changes). Omitted fields are not touched. Auth required.
- **DELETE** `/api/admin/control-assignments/[id]` — unassign the control from the assessment.
- **PUT** `/api/admin/assessments/[id]/controls` — bulk set the assigned control set for an assessment (creates/removes `ControlAssignment` rows).

**Assessments (admin)**
- **GET / POST** `/api/admin/assessments` — list / create assessments.
- **GET / PUT / DELETE** `/api/admin/assessments/[id]` — read / update / delete an assessment.

**Findings**
- **GET / POST** `/api/admin/findings` — list / create findings (server assigns the `FID-XXXXXX` id). Body includes `assessmentId`, optional `sampleId`, `description`, `details?`, `controlIds?`, `risks?`, `repeat?`, `severity`.
- **GET / PUT / DELETE** `/api/admin/findings/[id]` — read / update / delete a finding (delete cascades to its actions).

**Actions**
- **GET / POST** `/api/admin/actions` — list / create remediation actions for a finding.
- **GET / PUT / DELETE** `/api/admin/actions/[id]` — read / update (agreement, target dates, extensions, closure) / delete an action.

**Samples**
- **GET / POST** `/api/admin/samples`, **PUT / DELETE** `/api/admin/samples/[id]` — sample CRUD (also referenced in §6.2).

**Gamification**
- **POST** `/api/gamification/award` — award points/badges for an action.
- **GET** `/api/gamification/stats` and `/api/gamification/stats/[userId]` — engagement stats for the current or a specific user.
- **GET** `/api/gamification/leaderboard` — ranked users (recognition drive).

**Admin / Database utilities**
- **GET** `/api/admin/tables` and `/api/admin/table/[table]/stats` — table listing and per-table stats.
- **GET** `/api/admin/table/[table]/export` and `/api/admin/export-all-tables` — export a table / all tables.
- **GET** `/api/admin/table/[table]/template` — download a CSV template for a table.
- **GET** `/api/admin/diagnose` — environment/schema diagnostics.
- **GET/POST** `/api/admin/suggest-activity-types` — activity-type suggestions (supports the `admin/add-activity-types` page).

---

## 7. CSV Import Reference

### Required Tables Order
1. **ProcessArea** (no dependencies)
2. **SubProcess** (depends on ProcessArea)
3. **Control** (depends on both)

### Control CSV Format (28 columns)

| Column | Type | Required | Valid Values |
|--------|------|----------|--------------|
| name | String | Yes | Any text |
| statement | String | Yes | Any text |
| controlType | Enum | Yes | Administrative, Procedural, Analytical, Behavioral, Informational, Engineering |
| processAreaId | String | Yes | Valid ProcessArea ID |
| subProcessId | String | Yes | Valid SubProcess ID |
| isHsseCritical | Boolean | No | TRUE, true, True, 1, yes, YES |
| ramRating | String | No | "Red", "Yellow", etc. |
| riskWeight | Int | No | 1-100 (default: 1) |
| rawHealthScore | Int | No | 0-100 (default: 80) |
| lastTestedDate | DateTime | No | ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ) |
| lastTestResult | String | No | "Pass", "Fail" |
| controlRef | String | No | External reference ID |
| sourceFile | String | No | Document name |
| practiceDocument | String | No | Document reference |
| controlTypeDetail | String | No | Full taxonomy description |
| csfWho | String | No | CSF Who field |
| csfWhat | String | No | CSF What field |
| csfWhen | String | No | CSF When field |
| csfWhere | String | No | CSF Where field |
| csfWhy | String | No | CSF Why field |
| csfHow | String | No | CSF How field |
| csfEvidence | String | No | CSF Evidence field |
| keyActivities | String | No | Pipe-delimited list |
| riskAddressed | String | No | Risk categories |
| testingApproach | String | No | Audit methodology |
| uncertainFlags | String | No | Data quality notes |
| pId | String | No | Process Identifier |
| standard | String | No | Compliance standard |
| Requirements | String | No | Additional requirements |

---

## 8. Gamification System

### Emotional Drives (8 Core Motivators)
1. **Diversity** — Exposure to varied control types and processes
2. **Belonging** — Team participation and collaboration metrics
3. **Recognition** — Achievement badges and public leaderboards
4. **Achievement** — Milestone completions and goal progress
5. **Excellence** — High-quality evidence and perfect test results
6. **Growth** — Skill development and progression through levels
7. **Contribution** — Impact on team assurance and risk reduction
8. **Security** — Trust, confidence, and no-blame culture

### Badge System
- **Badge Definition:** AchievementBadge model with name, description, icon, rarity
- **Earning Criteria:**
  - Points-based: "Earn 1000 points" → Common badge
  - Control-based: "Test 50 controls" → Rare badge
  - Streak-based: "7-day streak" → Epic badge
- **Rarity Tiers:** Common, Uncommon, Rare, Epic, Legendary
- **Tied to Drives:** Each badge maps to one emotional drive

### Point System
- **PointTransaction Model:** Audit trail of all point awards
- **Actions Generating Points:**
  - Control planned: +10 points (Achievement drive)
  - Control tested: +25 points (Excellence drive)
  - Evidence documented: +15 points (Contribution drive)
  - Perfect quality: 1.5x multiplier
- **Negative Points:** Possible for incomplete actions or rule violations
- **Context Tracking:** Assessment ID, Sample ID, Emotional Drive, Multiplier

### Daily Behavior Tracking
- **BehaviorMeasurement Model:** Daily snapshot
- **Tracked Metrics:**
  - Plans Made (assessments planned)
  - Controls Tested (samples created/updated)
  - Evidence Documented (complete test evidence)
  - Team Engagement (collaboration flag)
  - Quality Score (0-100 assessment)
- **Constraint:** One record per user per day

### Weekly/Monthly Metrics Rollup
- **EmotionalDriveMetric Model:** Aggregated drive scores
- **Calculation:** Sum of daily behaviors + badge earnings mapped to drives
- **Drive Scores:** 0-100 scale for each of 8 drives
- **Overall Engagement:** Weighted average of all drives
- **Period:** Flexible (week, month, quarter)

### Confidence Influencer Concept
- **Flag:** `User.confidenceInfluencer`
- **Activation:** When true, system provides supportive feedback for low-confidence actions
- **Purpose:** Build trust and lower fear tolerance threshold
- **Linked to:** Fear Tolerance Scale framework (security drive)

### Milestone System
- **Milestone Model:** Goal tracking with progress
- **Example Milestones:**
  - "Test 50 Controls" (type: control_count, target: 50)
  - "Earn 1000 Points" (type: point_total, target: 1000)
  - "7-Day Streak" (type: daily_streak, target: 7)
- **Progress:** Current value tracked and updated on user actions
- **Completion:** Records `completedAt` timestamp when target reached

### Engagement Loop (Typical Workflow)
```
1. User logs in daily
   → BehaviorMeasurement created
   → EmotionalDriveMetric updated

2. User plans FLA
   → PointTransaction (+10 Achievement)
   → Milestone progress updated

3. User tests control
   → PointTransaction (+25 Excellence)
   → Sample created
   → Milestone progress checked

4. User earns badge
   → UserAchievement record
   → PointTransaction logged
   → Email notification sent

5. Weekly summary
   → EmotionalDriveMetric aggregated
   → Drive scores calculated (0-100)
   → Overall engagement computed
   → Leaderboard updated
```

---

## 9. Authentication & Security

### NextAuth.js Configuration
- **Provider:** Credentials (username/password)
- **JWT Token:** Session stored in HTTP-only cookie
- **Callbacks:**
  - `jwt()`: Add `id` to token for user context
  - `session()`: Return user object with `id` and `role`
- **Middleware:** Protects `/admin`, `/setup`, `/fla` routes

### Password Management
- **Hashing:** bcryptjs (or similar) for password storage
- **Comparison:** Bcrypt verification on login
- **Reset:** Not yet implemented (future feature)

### Role-Based Access Control (RBAC)
- **Admin Role:** Access to admin pages, CSV import, column management, SQL executor
- **Assessor Role:** Create/manage assessments, test controls, view own dashboards
- **Checks:**
  - API endpoints verify role via session
  - Pages redirect to login if not authenticated
  - Admin endpoints return 403 (Forbidden) if not admin

### Data Isolation
- **Assessment:** User owns assessments they create
- **Samples:** Visible via assessment (no direct user isolation yet)
- **Future:** Multi-tenant support with organization-level data isolation

---

## 10. Development & Deployment

### Environment Setup
```bash
# Install dependencies
npm install

# Create .env.local
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"

# Initialize database
npx prisma migrate dev --name init

# Start dev server
npm run dev
```

### Database Initialization
```bash
# Run all migrations
npx prisma migrate deploy

# Or (creates new migrations)
npx prisma migrate dev

# Reset entirely (dangerous!)
npx prisma migrate reset
```

### Prisma Client Generation
```bash
# Regenerate after schema changes
npx prisma generate

# View schema changes
npx prisma schema validate

# Introspect existing database
npx prisma db pull
```

### Data Management
```bash
# Backup critical tables to JSON
node scripts/export-data.js

# Restore from JSON backup
node scripts/restore-data.js

# Verify database & schema sync
curl http://localhost:3000/api/admin/database/sync-check
```

### Production Deployment
- **Database:** SQLite file (e.g., `/var/lib/app/dev.db`) or attach mounted volume
- **Backups:** Regular `node scripts/export-data.js` runs via cron job
- **Environment:** Set `NEXTAUTH_URL` to production domain
- **Security:** Set strong `NEXTAUTH_SECRET` (min 32 characters)

---

## 11. Known Limitations & Workarounds

| Limitation | Impact | Workaround |
|-----------|--------|-----------|
| SQLite Enums | Stored as strings, no type validation in DB | Prisma ORM handles translation at app layer |
| Cascading Deletes | Some relationships auto-delete children | Show confirmation dialog before delete |
| No Transactions | Serverless functions can't use transactions | Manual multi-step validation & rollback |
| 1000+ Controls | Pagination UI slow without indexes | Added indexes on common queries |
| No Full-Text Search | Wildcard search is substring match | Case-insensitive, supports * as wildcard |
| Multi-Tenancy | Single org per instance | Migrate to org_id column for multi-org |

---

## 12. Future Roadmap

- [ ] **Assessment Execution UI** — Test controls with real-time feedback
- [ ] **Gamification Dashboard** — Badges, milestones, drive graphs visualization
- [ ] **Leaderboard System** — Recognize top performers (recognition drive)
- [ ] **Bulk Milestone Updates** — Daily scheduler for batch metric rollups
- [ ] **Export Assessment Reports** — PDF generation of completed assessments
- [ ] **Multi-User Collaboration** — Template sharing and group testing
- [ ] **Historical Analytics** — Trend analysis on control health scores
- [ ] **Password Reset** — Self-service password recovery
- [ ] **Multi-Tenant Support** — Organization/department isolation
- [ ] **Real-Time Notifications** — Email/push for badge earning and team events
- [ ] **Audit Log** — Comprehensive change tracking for compliance

---

## 13. File Quick Reference

| File | Purpose | Type |
|------|---------|------|
| `prisma/schema.prisma` | Complete data model & enums | Prisma |
| `prisma/migrations/` | Migration history | SQL |
| `src/lib/prisma.ts` | Prisma singleton for queries | TypeScript |
| `src/lib/schema-introspection.ts` | Dynamic DMMF schema loader | TypeScript |
| `src/lib/fallback-schemas.json` | Backup schema (database master) | JSON |
| `src/app/fla/page.tsx` | Assessment list/dashboard | React |
| `src/app/fla/[id]/page.tsx` | Assessment detail (controls + samples) | React |
| `src/app/setup/controls/page.tsx` | Controls list with pagination | React |
| `src/app/setup/process-areas/page.tsx` | Process areas with Standard filter | React |
| `src/app/setup/processdetails/[id]/page.tsx` | Process Details server page (data fetching) | React |
| `src/app/setup/processdetails/[id]/ProcessDetailsClient.tsx` | Process Details 3-tab client component | React |
| `src/app/admin/templates/[id]/page.tsx` | Assessment template form | React |
| `src/app/admin/table/[table]/page.tsx` | Generic table editor + SQL executor | React |
| `src/app/api/admin/assessments/[id]/controls/route.ts` | Control selection API | Next.js API |
| `src/app/api/admin/samples/route.ts` | Sample CRUD | Next.js API |
| `src/app/api/admin/table/[table]/columns/route.ts` | Column management | Next.js API |
| `src/app/api/admin/execute-sql/route.ts` | SQL query execution | Next.js API |
| `src/auth.ts` | NextAuth configuration | TypeScript |
| `scripts/export-data.js` | Backup 4 critical tables | Node.js |
| `scripts/restore-data.js` | Restore from JSON backup | Node.js |

---

## 14. Support & Troubleshooting

### Common Issues

**Issue:** CSV import fails with "Foreign key constraint violated"
- **Cause:** ProcessArea/SubProcess doesn't exist
- **Fix:** Import ProcessArea first, then SubProcess, then Control

**Issue:** Prisma client not found after schema update
- **Cause:** Forgot to run `npx prisma generate`
- **Fix:** Run generation command

**Issue:** Database out of sync with schema
- **Cause:** Migrations not applied
- **Fix:** Run `npx prisma migrate deploy` or `npx prisma migrate dev`

**Issue:** "Can't find module '../src/generated/prisma'"
- **Cause:** Custom output path not set or client not generated
- **Fix:** Check generator output in schema.prisma, run `npx prisma generate`

**Issue:** Assessment controls deleted when updating control selection
- **Cause:** Old code deleted samples on control update
- **Fix:** Upgraded to v1.8.0 with a decoupled assessment↔control junction table (`ControlAssignment` as of v1.10.0)

---

## 15. Contact & Documentation

- **Schema Questions:** Review Prisma model comments and field definitions
- **API Documentation:** Each route documented in section 6
- **Data Backup:** See section 5.6 and `scripts/` directory
- **Gamification:** See section 8 for detailed emotional drive mappings

---

## 16. Changelog & Reconciliation Notes (v1.9.0 — 2026-07-04)

This update reconciles the document with the actual code after a full re-read.

### 16.1 Schema additions since v1.8.0
- **`ControlAssignment`** model + **`Effectiveness`** enum (`Effective` / `NotEffective`) — control assignment with per-control effectiveness, used by the FLA detail UI.
- **`Finding`** model + **`FindingSeverity`** enum (`Low`/`Medium`/`High`/`Serious`) — assessment findings with `FID-XXXXXX` ids.
- **`Action`** model — remediation actions tied to a finding (ownership, agreement, target/extension tracking, closure).
- New relations: `Assessment.controlAssignments`, `Assessment.findings`, `Control.controlAssignments`, `Sample.findings`.
- Enum count is now **10** (was documented as 8).

### 16.2 New / newly-documented files
- **FLA components** (`src/app/fla/[id]/`): `ControlsSelector`, `ControlsSelectorWrapper`, `AssignedControlsTable`, `EvidenceSection`, `SamplesTable`, `SampleRow`, `AddSamplesForm`, `FindingsTable`, `ActionsPanel`.
- **Admin pages**: `admin/assessments/{page,new,create,[id],from-template/[templateId]}`, `admin/add-activity-types`, plus existing templates / import-csv / export-data / columns / database-management / table editor.
- **Setup**: `setup/process-areas/ProcessAreaForm`, `setup/sub-processes`, `setup/activity-types`, `setup/controls`.
- **API**: `api/admin/{findings,actions,control-assignments,assessments,samples}` (+ `[id]`), `api/admin/table/[table]/{stats,export,template,columns,clear,data}`, `api/admin/{tables,export-all-tables,diagnose,suggest-activity-types,validate-csv,import-csv,execute-sql,check}`, `api/admin/database/*`, `api/gamification/{award,stats,stats/[userId],leaderboard}`.
- **lib**: `prisma.ts`, `findings.ts` (FID generator), `gamification.ts`, `schema-introspection.ts`, `fallback-schemas.ts`.
- **prisma seeds/utilities**: `seed.ts` (admin), `seed-controls.ts`, `controls-data.ts` (shared CSV loader), `reset-seed.ts` (full clear + admin + reseed), `gamification-seed.ts`, `reset-admin-password.ts/.js`, `list-users.ts`.
- **scripts**: `export-data.js`, `restore-data.js`, `export-database.js`, `export-critical-data.ts`, `restore-critical-data.ts`, `validate-csv.ts`.

### 16.3 Data & seed pipeline
Controls are sourced from `Combined_Controls.csv` (1,048 controls / 38 process areas / 340 sub-processes). `prisma/controls-data.ts` parses it (RFC-4180) and both seeders build records from it:
```bash
npx prisma db push          # apply schema (adds columns) without migration-ordering issues
npm run db:reset-seed       # clear all tables, recreate admin, reseed PA/SubProcess/Control
# or, non-destructive:
npm run db:seed-controls    # upsert controls only
npm run db:seed             # (re)create admin user
```

### 16.4 Known inconsistencies to address (follow-ups)
1. **ControlType mapping vs enum:** the enum now supports all 6 CSV values, but `controls-data.ts` `mapControlType()` still collapses `Administrative/Analytical/Informational → Procedural` and `Behavioral → Behavioural`, keeping the original only in `controlTypeDetail`. Now that the enum is complete, the loader could store the CSV value directly (and `controlTypeDetail` becomes redundant).
2. ~~Two Assessment↔Control junctions~~ — **resolved in v1.10.0**, see §16.5.
3. **Prisma client output:** now `src/generated/prisma`; the legacy `prisma/.prisma/client/` directory may be stale and can be removed.
4. ~~Mixed/non-timestamped migration history~~ — **resolved in v1.10.0**, see §16.6.

### 16.5 v1.10.0 — Removed `AssessmentControl` junction table (2026-07-04)

The legacy `AssessmentControl` model (v1.8.0) was removed from the schema, database, and this document. It held no data (0 rows) at removal time; `ControlAssignment` (v1.9.0) is now the **sole** Assessment↔Control junction, used for both control assignment and effectiveness tracking.

- **Schema:** Removed `model AssessmentControl` and the `Control.assessmentControls` / `Assessment.assessmentControls` relation fields from `prisma/schema.prisma`.
- **Database:** Applied via `npx prisma db push` (dropped the `AssessmentControl` table) + `npx prisma generate`.
- **Code:** Removed `AssessmentControl` references from `src/app/api/admin/table/[table]/[id]/route.ts` (child-record check on Control delete), `src/app/api/admin/database/tables/[name]/route.ts` (system-table guard list), and `src/app/api/admin/database/sync-check/route.ts` (critical-table check), replacing/keeping `ControlAssignment` in each.

### 16.6 v1.10.0 — Rebaselined migration history (2026-07-04)

`prisma/migrations/` previously mixed 15 properly timestamped migration folders with two non-timestamped ones (`create_assessment_control`, `reconcile_missing_decouple_history`) that had been applied out of Prisma's expected lexicographic folder order — a risk for a future fresh `prisma migrate deploy`, and no longer worth preserving now that the `AssessmentControl` table they created is gone (§16.5).

- **All prior migration folders were deleted** (still recoverable from git history if ever needed) and replaced with a single **`20260704064114_init`** migration generated from the current `schema.prisma` via `prisma migrate diff --from-empty --to-schema` — its SQL matches the live `dev.db` exactly (21 tables, no `AssessmentControl`).
- The `_prisma_migrations` bookkeeping table was cleared and re-seeded with just this one entry via `prisma migrate resolve --applied`, **without re-running any SQL** — `dev.db` already had this exact structure, so no tables were dropped/recreated and no data was touched (verified: 1048 Controls, 60 ProcessAreas, 403 SubProcesses, 4 Assessments, 23 ControlAssignments, 10 Samples, 4 Findings, 3 Actions all unchanged before/after).
- `prisma migrate status` now reports a single migration, database up to date.
- The stray `catchup.sql` at the repo root (an old, already-applied one-off script, not part of `prisma/migrations/`) was left as-is — historical record, not live schema.

---

**End of Documentation**

**Next Update:** When new major features are added or schema significantly changes.

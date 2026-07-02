# SEAM Assurance App - Complete Design & Architecture Documentation

**Last Updated:** June 30, 2026 (v1.8.0)  
**Status:** Production Ready with Data Management  
**Database Version:** 1.8.0 (SQLite with Prisma ORM)

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
| **Framework** | Next.js | 14+ | App Router, server actions, hybrid rendering |
| **Language** | TypeScript | Latest | Type-safe development |
| **Database** | SQLite | 3.x | Self-contained, file-based, no external server |
| **ORM** | Prisma | 5.x | Type-safe data access, migrations, introspection |
| **Auth** | NextAuth.js | Latest | Session-based authentication with JWT |
| **UI** | React 18+ | Latest | Component library, hooks |
| **Styling** | Tailwind CSS | Latest | Utility-first CSS framework |
| **Backup** | Node.js Scripts | CommonJS | Export/restore JSON-based data |

---

## 3. Database Schema (Complete)

### 3.1 Configuration

```prisma
generator client {
  provider = "prisma-client"
  output   = ".prisma/client"
}

datasource db {
  provider = "sqlite"
}
```

**Key Point:** Prisma generates client to custom directory `.prisma/client`. Backup/restore scripts import from this path.

---

### 3.2 Enumerations (8 types)

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
  assessmentControls AssessmentControl[]
  templateLinkages   AssessmentTemplateControlLinkage[]
  subProcess         SubProcess @relation(...)
  processArea        ProcessArea @relation(...)
  
  @@index([controlRef])
}
```

**Purpose:** Comprehensive control definition with 28 fields. Supports CSV import/export. See section 5.2 for full field documentation.

**Key Change (v1.8.0):** Now links to assessments via `AssessmentControl` junction table (not via samples).

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
  assessmentControls AssessmentControl[]
  samples            Sample[]
}
```

**Purpose:** Represents a single assessment instance with assigned controls and test samples.

**Architecture (v1.8.0):**
- `assessmentControls` → controls assigned to this assessment
- `samples` → evidence/test data collected independently
- **Decoupled:** Changing controls doesn't delete samples

---

#### **AssessmentControl** ⭐ Junction Table (v1.8.0)
```prisma
model AssessmentControl {
  id           String @id @default(cuid())
  assessmentId String (FK)
  controlId    String (FK)
  createdAt    DateTime @default(now())
  
  // Relations
  assessment   Assessment @relation(..., onDelete: Cascade)
  control      Control @relation(..., onDelete: Cascade)
  
  // Constraint
  @@unique([assessmentId, controlId])
  @@index([assessmentId])
  @@index([controlId])
}
```

**Purpose:** Many-to-many relationship between Assessment and Control. Replaces direct `Sample.controlId` linking.

**Key Benefits:**
- ✅ Controls can belong to multiple assessments
- ✅ Samples are independent (no cascading delete when controls change)
- ✅ Supports flexible testing scenarios (multiple samples per assessment)
- ✅ Clean separation of concerns

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

**Change (v1.8.0):** Removed `controlId` field. Control associations managed via `AssessmentControl`.

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
  ├─ AssessmentControl[] ← NEW (v1.8.0)
  │   └─ Control
  └─ Sample[] (now independent)

Control
  ├─ ProcessArea
  ├─ SubProcess
  ├─ AssessmentControl[] ← NEW (v1.8.0)
  └─ AssessmentTemplateControlLinkage[]

AssessmentTemplate
  ├─ AssessmentTemplateControlLinkage[]
  └─ AssessmentTemplateActivityType[]

Sample (DECOUPLED v1.8.0)
  ├─ Assessment (only link to control selection)
  ├─ SampleType?
  └─ RecordSourceType?
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
│   │   │   │   └── ProcessAreasTable.tsx     # Table with Standard filter
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

## 6. API Routes (Complete Reference)

### 6.1 Assessment Management

**PUT** `/api/admin/assessments/[id]/controls`
- **Body:** `{ controlIds: string[] }`
- **Purpose:** Manage AssessmentControl junction table (add/remove controls)
- **Operation:**
  1. Validates assessment exists
  2. Validates all control IDs
  3. Deletes old AssessmentControl records
  4. Creates new records for selected controls
- **Response:** `{ success: true, message: "Created X controls for assessment" }`

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
- **Fix:** Upgraded to v1.8.0 with AssessmentControl junction table

---

## 15. Contact & Documentation

- **Schema Questions:** Review Prisma model comments and field definitions
- **API Documentation:** Each route documented in section 6
- **Data Backup:** See section 5.6 and `scripts/` directory
- **Gamification:** See section 8 for detailed emotional drive mappings

---

**End of Documentation**

**Next Update:** When new major features are added or schema significantly changes.

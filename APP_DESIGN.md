# SEAM Assurance App — Complete Design & Architecture Documentation

**Last Updated:** July 13, 2026 (v2.4.5)  
**Status:** Production — Deployed on Railway (PostgreSQL)  
**Code Name:** "CONAN PROJECT"

> **v2.4.5 — Requirement Admin UI:** Renamed `MRequirement` → `Requirement` (model + DB table). Added Manage Requirements admin panel with 2-panel layout: left panel has hierarchical filter (Standard → Process Area → SubProcess), right panel lists requirements in a table (Process Area, Requirement ID, clauseContent truncated to 100 chars). Click any row to expand an inline full-form editor for all columns. Uses generic `/api/admin/table/Requirement` endpoints.
>
> **v2.4.4 — Requirement Table:** Added `Requirement` model (696 rows) from `frontline library/mRequirement.csv` — SMDS ICOP statutory requirements with rID as primary key. Includes standard, pID, requirementId, clauseContent, intentOutcome, clauseApplicability, references, and applicable fields. Import script at `scripts/import_mrequirements.py`.
>
> **v2.4.3 — Schema Audit:** Verified 41 models / 10 enums in sync between Prisma schema and live DB. Fixed model count (was 37). Added missing Document Ingestion models: `DocumentExtract`, `ControlFromDocument`, `ControlFDSubProcess`. Documented manual `sync-schema.ts` sync mechanism (no Prisma Migrate).
>
> **v2.4.2 — Design Doc Audit & Cleanup:** Fixed stale document-conversion tech description (Python→mammoth/pdfjs-dist/tesseract.js). Added Known Architectural Debt section (§11) documenting three parallel assessment surfaces, `/api/admin/execute-sql` blast-radius risk, `/api/admin/check` inconsistent authorization, and `generate_testing_kri.py` rule-based heuristic engine.
>
> **v2.4.0 — Process Health & Control Scoring:** Added Process Health Dashboard on `/fla` main panel showing average control health scores per process area, grouped by Standard with collapsible sections and traffic-light indicators (🟢>80 Healthy, 🟡50-80 Tolerable, 🔴<50 Not Tolerable). `Control.rawHealthScore` now auto-recalculates on every effectiveness change or unassign via 90-day window (`Effective/Total × 100`). Batch script `scripts/recalc_control_health.py` for bulk recalculation. Leaderboard excludes only username "admin", shows top-3 + user's own position with gaps.
>
> **v2.3.0 — User Roles, Company & Favorites:** Added `UserRole`, `UserRoleMapping`, `Company` tables. User model extended with `position` and `companyId`. Admin pages: Manage Roles (role CRUD + user↔role mapping), Manage Company (company CRUD + user↔company assignment). `UserFavorite` table for generic entity favoriting (ProcessArea, SubProcess, Control). Assessment detail page restructured into 2-panel tabbed layout (Overview, Control Assignment, Sample Selection, Finding & Actions, Assessment Activities). Assessment Activities panel with activity CRUD, user assignment, and control mapping via `Aact`/`AActUsers`/`AActControls` tables.
>
> **v2.2.0 — Knowledgebase & Document Conversion:** Added Knowledgebase model for storing converted documents. New `POST /api/convert` endpoint converts .docx/.pdf to Markdown via mammoth (docx→markdown) and pdfjs-dist + tesseract.js (PDF with OCR fallback) and optionally saves to Knowledgebase. Knowledgebase page at `/admin/knowledgebase` with drag-and-drop upload, preview, search, and download. `MapArt2Know` table for artifact-to-knowledge mapping.
>
> **v2.1.0 — Attachment System:** Added Attachment & AttachmentMapping models with reusable AttachmentList component. Actions now support `actionTaken` field and file attachments. Attachments can be linked to any table (Action, Finding, Sample) via the mapping table.

## 1. Executive Summary

The **SEAM Assurance App** ("CONAN PROJECT") is a gamified internal control testing platform for oil & gas operations. It enables:

- Manage Controls, Plan Assessments, Execute Tests via samples/findings/actions
- Gamification with 8 emotional drives, badges, and points-based leaderboard
- Activity Logging with 31 event types across all user actions
- Process Health Monitoring via auto-calculated control effectiveness scores
- Role-based user management with company assignments and favorites

**Core Design Principle:** Decouple controls from samples — assessments have independent relationships to both.

## 2. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.2.9 |
| Database | PostgreSQL | 16 (local) / 18 (Railway) |
| ORM | Prisma + @prisma/adapter-pg | 7.8.0 |
| Auth | NextAuth.js (Auth.js) | 5.x beta |
| UI | React + Tailwind CSS | 19.2.4 / 4.x |
| Deployment | Railway | Docker + PG Plugin |

## 3. Database Schema (42 Models, 10 Enums)

### Enums
Role (Admin/Assessor), LOA (FirstLine/SecondLine/ThirdLine), ControlType (6 types), AssessmentStatus (Planned/InProgress/Completed/Cancelled), SampleStatus/Conclusion, Effectiveness, FindingSeverity, EmotionalDrive (8 drives), BadgeRarity

### Core Models
- **User** — accounts with gamification stats (totalPoints, dailyPointStreak, position, companyId)
- **ActivityLog** — audit trail (timestamp, description, activityType, username, refTable, refRecord)
- **ActivityLogType** — catalog of 31 valid activity types

### User Management Models
- **UserRole** — role definitions (uRoleName, uRoleDescription, uRolePositions, uRoleReportingLine)
- **UserRoleMapping** — M2M: User ⟷ UserRole with remarks and createdDate
- **Company** — company definitions (companyID, companyName, referenceID, shortName)
  - User.companyId links to Company.id via Manage Company admin page
- **UserFavorite** — generic favoriting (userId, entityType, entityId)
  - entityType: "ProcessArea" | "SubProcess" | "Control"
  - Unique per (userId, entityType, entityId)

### Setup Models
- **ProcessArea** — name (unique), pId, standard
- **SubProcess** — name, processAreaId
- **Control** — 28 fields (CSF framework, risk, testing approach, rawHealthScore auto-calculated)
- **ControlSubProcess** — M2M: Control ⟷ SubProcess
- **AssuranceActivityType** — name (unique), defaultLOA
- **AssessmentActType** — activity type definitions (assacttypeid, assacttypeName, description)
  - Seeded with: Interview (ACT-001), DocumentReview (ACT-002), Site Visit (ACT-003)

### Assessment Models
- **Assessment** — activityTypeId, assessorId, dates, loa, status
- **ControlAssignment** — M2M: Assessment ⟷ Control + effectiveness tracking
  - Effectiveness changes auto-trigger `rawHealthScore` recalculation on parent Control
- **Sample** — evidence records (sampleTypeId, recordSourceId, status, conclusion)
- **SampleType / RecordSourceType** — dynamic lookup tables

### Assessment Activity Models
- **Aact** — assurance activities tied to assessments (aaID, assuranceID, assacttypeid, activityName, activityDate, startTime, endTime, duration, description)
- **AActControls** — M2M: Aact ⟷ Control (maps controls being tested in an activity)
- **AActUsers** — M2M: Aact ⟷ User with userRoles and assignmentRemarks
- **AActDetails** — activity detail text, summary, checklists (long text), activity notes (long text) (aactDetID, aaId, detail, summaryAgainstControls, checklists, activityNotes)

### Findings & Actions
- **Finding** — FID-XXXXXX IDs, severity, risks, controls
- **Action** — remediation per finding (ownership, dates, extensions, closure, actionTaken)

### Attachment System
- **Attachment** — file metadata (fileName, filePath, fileSize, description, uploadedBy, uploadDate)
- **AttachmentMapping** — polymorphic M2M: Attachment → any table (destTable, recId)

### Knowledge Management
- **Knowledgebase** — converted documents (kID, knowledgeName, knowledgeContent, remarks, createdDate, addedBy)
  - Fed by `POST /api/convert` which uses **mammoth** (docx→markdown) and **pdfjs-dist + tesseract.js** (PDF text extraction with OCR fallback for scanned pages) — pure Node/JS, no Python dependency
  - Rendered as direct component in admin page (not iframe) with drag-and-drop upload, full-text preview, search, .md download
- **MapArt2Know** — artifact-to-knowledge mapping (mapA2KID, artName, artID, kID, whyToMap)

### Favorites System
- **UserFavorite** — generic favoriting for any entity (userId, entityType, entityId, createdAt)
  - `entityType`: "ProcessArea" | "SubProcess" | "Control"
  - Unique constraint on (userId, entityType, entityId) — cannot favorite the same entity twice
  - Enables personalized views: "Show only my favorite processes/controls"

### Document Ingestion Pipeline
- **DocumentExtract** — ingested document metadata + extracted text (docNo, documentType, custodian, authorizer, Status workflow field, extractedText)
  - Fed by `POST /api/convert` (mammoth/pdfjs-dist/tesseract.js)
  - Source for `scripts/extract_controls.py` to mine control statements
- **ControlFromDocument** — controls extracted from documents (mirrors Control fields: statement, controlType, CSF fields, isHsseCritical, riskAddressed; adds `keyRiskIndicator`)
  - Populated by `scripts/extract_controls.py` from DocumentExtract text
  - `scripts/generate_testing_kri.py` generates testingApproach + keyRiskIndicator via rule-based heuristics
- **ControlFDSubProcess** — M2M: ControlFromDocument ⟷ SubProcess (mirrors ControlSubProcess for document-extracted controls)
  - Unique on (controlFromDocumentId, subProcessId) with isPrimary flag

### SMDS ICOP Statutory Requirements
- **Requirement** — 696 statutory/regulatory requirements from SMDS ICOP framework (rID as PK, standard, pID, requirementId, clauseContent, intentOutcome, clauseApplicability, references, applicable)
  - Imported from `frontline library/mRequirement.csv` via `scripts/import_mrequirements.py`
  - Admin UI at `/admin` → "📋 Requirements" with hierarchical filter (Standard → Process Area → SubProcess) and inline full-form editor

### Template Models
- **AssessmentTemplate** — reusable templates
- **AssessmentTemplateControlLinkage / AssessmentTemplateActivityType** — M2M junctions

### Gamification Models
- **PointTransaction** — points with emotional drive and multiplier
- **EmotionalDriveMetric** — weekly 8-drive rollup with overall engagement
- **Milestone** — tracked achievements (title, targetValue, currentValue, type)
- **AchievementBadge** — badges across 8 drives with rarity levels
- **UserAchievement** — M2M: User ⟷ Badge
- **GameAttribute** — game attribute definitions (attributeName, status)
- **GameAttributeRule** — per-activity-type scoring rules (basePoints, perControlPoints, hsseBonus, qualityBonus, multiplier)

### Control Health System
- `Control.rawHealthScore` is calculated dynamically: (Effective assignments / Total assignments) × 100 over the last 90 days
- Auto-recalculated on every effectiveness change (PUT) or unassign (DELETE) in `POST/PUT /api/admin/control-assignments/[id]`
- Batch recalculation via `scripts/recalc_control_health.py`
- Dashboard displays average health per process area, grouped by Standard with traffic-light indicators

### Key Relationships
```
User ──< Assessment (assessor)
User ──< UserRoleMapping >── UserRole
User ──< UserFavorite (entityType + entityId)
User ──< AActUsers >── Aact
Assessment ──< ControlAssignment >── Control
Assessment ──< Sample, Finding ──< Action
Control ──< ControlSubProcess >── SubProcess
Control ──< AActControls >── Aact
Attachment ──< AttachmentMapping >── (Action | Finding | Sample)
Knowledgebase ──< MapArt2Know (artifact mapping)
DocumentExtract ──< ControlFromDocument ──< ControlFDSubProcess >── SubProcess
```

## 4. Architecture

```
seam-assurance-app/
├── prisma/          # Schema, seeds, migrations
├── scripts/         # Python DB migration scripts (psycopg2)
├── src/
│   ├── app/         # 40+ routes (all dynamic)
│   │   ├── login/   # Client-side credentials form
│   │   ├── fla/     # Dashboard, Create, Detail workflow with tabbed layout
│   │   ├── setup/   # Process Areas, Controls, Sub-Processes, Activity Types, Badges
│   │   ├── admin/   # Admin dashboard, templates, knowledgebase, generic table editor, CSV, user/role/company management
│   │   └── api/     # 70+ API routes
│   ├── components/  # NavBar, SignOutButton, GamificationDashboard, DeleteButton, AttachmentList, UserSearchSelect
│   ├── lib/         # prisma.ts, gamification.ts, activity-log.ts, findings.ts, schema-introspection.ts, fallback-schemas.ts
│   └── generated/   # Generated Prisma client
├── railway.toml     # RAILPACK builder, pre-deploy schema sync + seed
├── next.config.ts   # standalone output, pg external
└── .env             # DATABASE_URL (Railway PG), AUTH_SECRET
```

## 5. Authentication

- NextAuth.js v5 with JWT strategy and Credentials provider
- `trustHost: true` for Railway proxy
- `auth.config.ts` authorized callback protects all routes
- JWT callbacks inject id and role into session
- BCrypt password hashing

## 6. API Routes (70+ endpoints)

### Assessments
GET/POST `/api/admin/assessments`, GET/PUT/DELETE `/[id]`

### Control Assignments
PUT/DELETE `/api/admin/control-assignments/[id]` — auto-recalculates `Control.rawHealthScore`

### Samples, Findings, Actions
Full CRUD at `/api/admin/samples`, `/findings`, `/actions` with `/[id]`

### Attachments
GET `/api/attachments?destTable=X&recId=Y`, POST (FormData upload), DELETE `/[id]`

### Document Conversion
POST `/api/convert` — upload .docx/.pdf, returns Markdown (mammoth for docx, pdfjs-dist + tesseract.js OCR for PDF); optional `saveToKnowledgebase=true` + `remarks` to persist to Knowledgebase table

### Templates
GET/POST `/api/admin/assessment-templates`, GET/PUT/DELETE `/[id]`

### Gamification
POST `/api/gamification/award`, GET `/stats/[userId]`, GET `/leaderboard` — leaderboard excludes username "admin", uses cumulative `SUM(PointTransaction.points)`

### Admin Utilities
CSV validate/import, generic table CRUD (all 42 models), column management, SQL executor (`/api/admin/execute-sql` — Admin-only, small blocklist: DROP DATABASE, DELETE FROM information_schema, PRAGMA database_list; see §11 for blast-radius notes), database management, export, diagnostics, information_schema column discovery

## 7. Frontend Pages

| Route | Description |
|-------|-------------|
| `/login` | Login form |
| `/fla` | **Assurance Management Dashboard** — Process Health Dashboard (collapsible by standard, traffic-light indicators) + Gamification sidebar (points, earned badges, leaderboard top-3) |
| `/fla/new` | Create assessment with cascading control picker |
| `/fla/[id]` | **2-panel tabbed assessment**: Overview, Control Assignment, Sample Selection, Finding & Actions, Assessment Activities (activity CRUD with User assignment, Details form with checklists/notes/attachments, Controls mapping) |
| `/admin` | Admin dashboard with 37 table tiles, Badge Management, Template Management, **User Management** (Add/Edit with position/companyId, **Manage Roles**, **Manage Company**), Knowledgebase |
| `/admin/templates` | Template list + editor |
| `/admin/knowledgebase` | Document upload (.docx/.pdf → Markdown), search, preview, download |
| `/admin/table/[table]` | Generic table editor (auto-discovers columns via information_schema) |
| `/setup/process-areas` | Process areas with standard filter |
| `/setup/processdetails/[id]` | 3-tab drill-down (Overview, Controls, Assessments) |
| `/setup/controls` | 28-field control form |
| `/setup/badges` | Badge generation and management |

## 8. Activity Logging

31 event types logged via `logActivity()` helper in `src/lib/activity-log.ts`:
- Template CRUD, Assessment CRUD, Control testing, Sample CRUD, Finding CRUD, Action CRUD
- User management, Process Area/SubProcess/Control creation, CSV import, SQL execution, Auth events

## 9. Gamification

- 8 emotional drives (Octalysis-inspired): Diversity, Belonging, Recognition, Achievement, Excellence, Growth, Contribution, Security
- Achievement badges across all drives with rarity levels (Common through Legendary)
- Point system: configurable per activity type via GameAttributeRule (basePoints, perControlPoints, HSSE/quality bonuses, multiplier)
- Weekly emotional drive rollups, milestone tracking
- **Assurance Leaderboard**: top-3 + user's own position, cumulative points from `SUM(PointTransaction.points)`, excludes username "admin"

## 10. Control Health System

- `rawHealthScore` = (Effective ÷ Total) × 100 over last 90 days of assessments
- **Auto-recalculated** on every control effectiveness change or unassign via `PUT/DELETE /api/admin/control-assignments/[id]`
- Batch recalculation: `scripts/recalc_control_health.py` (VS Code task "Recalculate Control Health")
- Dashboard visualization: collapsible by Standard, per-process health bars, traffic-light emoji indicators

## 11. Deployment

```toml
# railway.toml
[build]
builder = "RAILPACK"
buildCommand = "npx prisma generate && npm run build"

[deploy]
preDeployCommand = "npx tsx prisma/sync-schema.ts && npx tsx prisma/seed.ts && npx tsx prisma/seed-activity-log-types.ts"
startCommand = "npm run start"
```

- Railway PostgreSQL plugin auto-provisions database
- Internal: `postgres.railway.internal:5432`, Public: `hayabusa.proxy.rlwy.net:54471`
- Schema sync via direct SQL (ALTER/CREATE IF NOT EXISTS) in `prisma/sync-schema.ts` — **not** Prisma Migrate (no `_prisma_migrations` table). Dev schema changes must be added to `sync-schema.ts` to propagate to production.

## 11. Known Architectural Debt & Risks

### Three Parallel Assessment Surfaces
Three route trees serve assessment workflows with overlapping functionality:
- `/fla` — primary assessor dashboard + assessment workflow (NavBar: "Dashboard")
- `/setup/assessments` — alternate assessment list/creation (NavBar: "Assessments")
- `/admin/assessments` — admin-side full assessment management (create, new, from-template, [id])

All three are live and linked from `NavBar.tsx`. Consider consolidating into a single assessment surface with role-based views.

### `/api/admin/execute-sql` Blast-Radius Risk
Accepts raw SQL from Admin users. The blocklist is minimal (only `DROP DATABASE`, `DELETE FROM information_schema`, `PRAGMA database_list`). Notable gaps: `DROP TABLE`, `TRUNCATE`, `ALTER TABLE`, `UPDATE`/`DELETE` without WHERE are all permitted. This endpoint has production-database access and represents a significant blast-radius risk if misused.

### `/api/admin/check` Inconsistent Authorization
Grants admin access via `role === "Admin"` **OR** hardcoded `email === "admin@example.com"`. The email-based fallback bypasses the role system and should be removed or unified with the standard role check.

### `scripts/generate_testing_kri.py` — Rule-Based Heuristic Engine
This script generates TestingApproach and KeyRiskIndicator for `ControlFromDocument` records using **keyword/regex heuristics** (not ML/LLM). It:
1. Derives Testing Approach from keyword scanning (inspect/verify/audit/calibrate/sample/witness/certify) plus frequency-pattern extraction (annually/quarterly/etc.)
2. Derives KRI by classifying controls into 8 types (inspection/approval/verification/monitoring/maintenance/training/documentation/testing/general) via weighted keyword scoring, then selecting lead/lag indicator templates

Flagged as a candidate for future LLM-assisted enhancement.

## 12. Changelog

| Version | Date | Changes |
|---------|------|---------|
| v2.4.4 | 2026-07-13 | Added Requirement table (696 statutory requirements from SMDS ICOP). Import script at scripts/import_mrequirements.py. |
| v2.4.5 | 2026-07-13 | Renamed MRequirement → Requirement. Added Manage Requirements admin panel with hierarchical filter and inline editor. |
| v2.4.3 | 2026-07-13 | Schema audit: verified 41 models/10 enums in sync. Added DocumentExtract, ControlFromDocument, ControlFDSubProcess to schema docs. |
| v2.4.2 | 2026-07-13 | Design doc audit: fix stale conversion tech, add Known Architectural Debt (§11), document execute-sql risk & admin/check inconsistency |
| v2.0.0 | 2026-07-07 | PostgreSQL migration, Railway deployment, ActivityLogType, force-dynamic, trustHost |
| v1.11.0 | 2026-07-04 | ControlSubProcess M2M junction |
| v2.1.0 | 2026-07-08 | Attachment system, actionTaken field, AttachmentList component |
| v1.8.0 | 2026-06-30 | Initial documented version |

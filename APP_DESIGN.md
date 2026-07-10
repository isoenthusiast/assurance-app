# SEAM Assurance App — Complete Design & Architecture Documentation

**Last Updated:** July 10, 2026 (v2.4.1)  
**Status:** Production — Deployed on Railway (PostgreSQL)  
**Code Name:** "CONAN PROJECT"

> **v2.4.0 — Process Health & Control Scoring:** Added Process Health Dashboard on `/fla` main panel showing average control health scores per process area, grouped by Standard with collapsible sections and traffic-light indicators (🟢>80 Healthy, 🟡50-80 Tolerable, 🔴<50 Not Tolerable). `Control.rawHealthScore` now auto-recalculates on every effectiveness change or unassign via 90-day window (`Effective/Total × 100`). Batch script `scripts/recalc_control_health.py` for bulk recalculation. Leaderboard excludes only username "admin", shows top-3 + user's own position with gaps.
>
> **v2.3.0 — User Roles, Company & Favorites:** Added `UserRole`, `UserRoleMapping`, `Company` tables. User model extended with `position` and `companyId`. Admin pages: Manage Roles (role CRUD + user↔role mapping), Manage Company (company CRUD + user↔company assignment). `UserFavorite` table for generic entity favoriting (ProcessArea, SubProcess, Control). Assessment detail page restructured into 2-panel tabbed layout (Overview, Control Assignment, Sample Selection, Finding & Actions, Assessment Activities). Assessment Activities panel with activity CRUD, user assignment, and control mapping via `Aact`/`AActUsers`/`AActControls` tables.
>
> **v2.2.0 — Knowledgebase & Document Conversion:** Added Knowledgebase model for storing converted documents. New `POST /api/convert` endpoint converts .docx/.pdf to Markdown via Python (python-docx + PyMuPDF) and optionally saves to Knowledgebase. Knowledgebase page at `/admin/knowledgebase` with drag-and-drop upload, preview, search, and download. `MapArt2Know` table for artifact-to-knowledge mapping.
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

## 3. Database Schema (37 Models, 10 Enums)

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
  - Fed by `POST /api/convert` which runs Python (python-docx / PyMuPDF) to convert .docx/.pdf → Markdown
  - Rendered as direct component in admin page (not iframe) with drag-and-drop upload, full-text preview, search, .md download
- **MapArt2Know** — artifact-to-knowledge mapping (mapA2KID, artName, artID, kID, whyToMap)

### Favorites System
- **UserFavorite** — generic favoriting for any entity (userId, entityType, entityId, createdAt)
  - `entityType`: "ProcessArea" | "SubProcess" | "Control"
  - Unique constraint on (userId, entityType, entityId) — cannot favorite the same entity twice
  - Enables personalized views: "Show only my favorite processes/controls"

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
POST `/api/convert` — upload .docx/.pdf, returns Markdown; optional `saveToKnowledgebase=true` + `remarks` to persist to Knowledgebase table

### Templates
GET/POST `/api/admin/assessment-templates`, GET/PUT/DELETE `/[id]`

### Gamification
POST `/api/gamification/award`, GET `/stats/[userId]`, GET `/leaderboard` — leaderboard excludes username "admin", uses cumulative `SUM(PointTransaction.points)`

### Admin Utilities
CSV validate/import, generic table CRUD (all 37 models), column management, SQL executor, database management, export, diagnostics, information_schema column discovery

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
- Schema sync via direct SQL (ALTER/CREATE IF NOT EXISTS)

## 11. Changelog

| Version | Date | Changes |
|---------|------|---------|
| v2.0.0 | 2026-07-07 | PostgreSQL migration, Railway deployment, ActivityLogType, force-dynamic, trustHost |
| v1.11.0 | 2026-07-04 | ControlSubProcess M2M junction |
| v2.1.0 | 2026-07-08 | Attachment system, actionTaken field, AttachmentList component |
| v1.8.0 | 2026-06-30 | Initial documented version |

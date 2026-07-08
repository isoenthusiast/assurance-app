# SEAM Assurance App — Complete Design & Architecture Documentation

**Last Updated:** July 8, 2026 (v2.1.0)  
**Status:** Production — Deployed on Railway (PostgreSQL)  
**Code Name:** "CONAN PROJECT"

> **v2.1.0 — Attachment System:** Added Attachment & AttachmentMapping models with reusable AttachmentList component. Actions now support `actionTaken` field and file attachments. Attachments can be linked to any table (Action, Finding, Sample) via the mapping table.

## 1. Executive Summary

The **SEAM Assurance App** ("CONAN PROJECT") is a gamified internal control testing platform for oil & gas operations. It enables:

- Manage Controls, Plan Assessments, Execute Tests via samples/findings/actions
- Gamification with 8 emotional drives, badges, milestones, and points
- Activity Logging with 31 event types across all user actions

**Core Design Principle:** Decouple controls from samples — assessments have independent relationships to both.

## 2. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.2.9 |
| Database | PostgreSQL | 16 (local) / 18 (Railway) |
| ORM | Prisma + @prisma/adapter-pg | 7.8.0 |
| Auth | NextAuth.js (Auth.js) | 5.x beta |
| UI | React + Tailwind CSS | 19.2.4 / 4.x |
| Testing | Playwright | 1.61.1 |
| Deployment | Railway | Docker + PG Plugin |

## 3. Database Schema (26 Models, 10 Enums)

### Enums
Role (Admin/Assessor), LOA (FirstLine/SecondLine/ThirdLine), ControlType (6 types), AssessmentStatus (Planned/InProgress/Completed/Cancelled), SampleStatus/Conclusion, Effectiveness, FindingSeverity, EmotionalDrive (8 drives), BadgeRarity

### Core Models
- **User** — accounts with gamification stats (totalPoints, dailyPointStreak)
- **ActivityLog** — audit trail (timestamp, description, activityType, username, refTable, refRecord)
- **ActivityLogType** — catalog of 31 valid activity types

### Setup Models
- **ProcessArea** — name (unique), pId, standard
- **SubProcess** — name, processAreaId
- **Control** — 28 fields (CSF framework, risk, testing approach, etc.)
- **ControlSubProcess** — M2M: Control ⟷ SubProcess
- **AssuranceActivityType** — name (unique), defaultLOA

### Assessment Models
- **Assessment** — activityTypeId, assessorId, dates, loa, status
- **ControlAssignment** — M2M: Assessment ⟷ Control + effectiveness tracking
- **Sample** — evidence records (sampleTypeId, recordSourceId, status, conclusion)
- **SampleType / RecordSourceType** — dynamic lookup tables

### Findings & Actions
- **Finding** — FID-XXXXXX IDs, severity, risks, controls
- **Action** — remediation per finding (ownership, dates, extensions, closure, actionTaken)

### Attachment System
- **Attachment** — file metadata (fileName, filePath, fileSize, description, uploadedBy, uploadDate)
- **AttachmentMapping** — polymorphic M2M: Attachment → any table (destTable, recId)

### Template Models
- **AssessmentTemplate** — reusable templates
- **AssessmentTemplateControlLinkage / AssessmentTemplateActivityType** — M2M junctions

### Gamification Models
- **PointTransaction** — points with emotional drive and multiplier
- **BehaviorMeasurement** — daily counters (plans, tests, evidence, team, quality)
- **EmotionalDriveMetric** — weekly 8-drive rollup with overall engagement
- **Milestone** — tracked achievements (title, targetValue, currentValue, type)
- **AchievementBadge** — 18 badges across 8 drives
- **UserAchievement** — M2M: User ⟷ Badge

### Key Relationships
```
User ──< Assessment (assessor)
Assessment ──< ControlAssignment >── Control
Assessment ──< Sample, Finding ──< Action
Control ──< ControlSubProcess >── SubProcess
Attachment ──< AttachmentMapping >── (Action | Finding | Sample)
```

## 4. Architecture

```
seam-assurance-app/
├── prisma/          # Schema, seeds, migrations, sync scripts
├── src/
│   ├── app/         # 33 routes (all dynamic)
│   │   ├── login/   # Client-side credentials form
│   │   ├── fla/     # Dashboard, Create, Detail workflow
│   │   ├── setup/   # Process Areas, Controls, Sub-Processes, Activity Types
│   │   ├── admin/   # Admin dashboard, templates, generic table editor, CSV
│   │   └── api/     # 60+ API routes
│   ├── components/  # NavBar, SignOutButton, GamificationDashboard
│   ├── lib/         # prisma.ts, gamification.ts, activity-log.ts, findings.ts
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

## 6. API Routes (60+ endpoints)

### Assessments
GET/POST `/api/admin/assessments`, GET/PUT/DELETE `/[id]`, PUT `/controls`

### Control Assignments
PUT/DELETE `/api/admin/control-assignments/[id]`

### Samples, Findings, Actions
Full CRUD at `/api/admin/samples`, `/findings`, `/actions` with `/[id]`

### Attachments
GET `/api/attachments?destTable=X&recId=Y`, POST (FormData upload), DELETE `/[id]`

### Templates
GET/POST `/api/admin/assessment-templates`, GET/PUT/DELETE `/[id]`

### Gamification
POST `/api/gamification/award`, GET `/stats/[userId]`, GET `/leaderboard`

### Admin Utilities
CSV validate/import, table CRUD, column management, SQL executor, database management, export, diagnostics

### Public Endpoints (No Admin Required)
GET `/api/controls` — process areas, sub-processes, controls, sample types, record sources
POST `/api/controls/reference` — quick-add sample types and record source types

## 7. Frontend Pages (17 primary routes)

| Route | Description |
|-------|-------------|
| `/login` | Login form |
| `/fla` | Dashboard with standards filter + gamification widget |
| `/fla/new` | Create assessment with cascading control picker |
| `/fla/[id]` | Full assessment workflow (info, controls, samples, findings, actions) |
| `/admin` | Admin dashboard with 12 table tiles |
| `/admin/templates` | Template list + editor |
| `/admin/table/[table]` | Generic table editor + SQL executor |
| `/setup/process-areas` | Process areas with standard filter |
| `/setup/processdetails/[id]` | 3-tab drill-down (Overview, Controls, Assessments) |
| `/setup/controls` | 28-field control form |

## 8. Activity Logging

31 event types logged via `logActivity()` helper in `src/lib/activity-log.ts`:
- Template CRUD, Assessment CRUD, Control testing, Sample CRUD, Finding CRUD, Action CRUD
- User management, Process Area/SubProcess/Control creation, CSV import, SQL execution, Auth events

## 9. Gamification

- 8 emotional drives (Octalysis-inspired): Diversity, Belonging, Recognition, Achievement, Excellence, Growth, Contribution, Security
- 18 achievement badges across all drives
- Point system: 30-200 points per action with HSSE/quality bonuses
- Daily behavior tracking, weekly emotional drive rollups, milestone tracking
- Leaderboard with personal rank

## 10. Deployment

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

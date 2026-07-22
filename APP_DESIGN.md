# SEAM Assurance App — Complete Design & Architecture Documentation

**Last Updated:** July 22, 2026 (v2.9.7)

> **v2.9.7 — Phase I & G Specs Settled (grill-with-docs):**
> - **Phase I — Control Health Recalculation:** Cumulative deduction model with quarterly reset. Score starts at 0% each quarter; first assessment brings control to 100%. Outstanding actions (actionClosureEffective=false) deduct per severity: Low 0%, Medium -5%, High -10%, Serious -15%, Repeat -15%. Floor at 0%. Scoped to controls assigned to the completed assessment only. ADR-0001 recorded.
> - **Phase G — Action Closure Fields:** Schema additions to Action model: `closureDate` (DateTime?) and `closureEvidence` (String?). UI includes AttachmentList (destTable=Action) for file uploads + text description. Updated by actionParty. Closure effectiveness reviewed separately by assessor.
> - **Grill-with-docs skills adopted:** Three-skill system (grilling primitive, domain-modeling, grill-with-docs wrapper) from Matt Pocock's skills repo. CONTEXT.md glossary created with sharpened domain terms. ADR directory established at `docs/adr/`.

> **v2.9.6 — Phase F: Attachment Integration for Samples & Findings:**
> - **AttachmentList on Samples:** Added file upload/attachment support to the Sample Selection tab in assessment detail. Each sample card now has an AttachmentList section (`destTable=Sample`).
> - **AttachmentList on Findings:** Added file upload/attachment support to the Finding & Actions tab. Each finding card now has an AttachmentList section (`destTable=Finding`).
> - **Sprint Backlog:** Phase F completed. Sprint is now fully done (18 completed, 0 in progress, 1 sprint item → completed).

> **v2.9.5 — SAMS App: Admin User Management CRUD:**
> - **UserManager Component:** Replaced static read-only user card list on `/admin?view=users` with interactive management. +Add User button opens modal with name, username, password, role dropdown (Admin/Assessor/Interviewee), and company multi-select checkboxes. Each user card has ✏️ Edit and 🗑 Delete buttons. Self-delete disabled for current user.
> - **User API:** `POST /api/admin/users` creates user with bcrypt-hashed password and company assignments. `PUT /api/admin/users/[id]` updates name, username, role, password (optional reset), and company sync (delete old UserCompany, insert new with ON CONFLICT DO NOTHING). `DELETE /api/admin/users/[id]` removes user with cascade; rejects self-delete.
> - **All CRUD operations verified:** Create (201), update with role change (200), delete (200), self-delete blocked (400).

> **v2.9.4 — SAMS App: Multi-Assessor, Activity Templates & Interviewee Role:**
> - **Multi-Assessor Support:** Added `AssessmentAssessor` junction table (assessmentId + userId). Kept `assessorId` as lead assessor; additional assessors via junction. Dashboard and detail page queries use `OR: [{ assessorId }, { assessorLinks: { some: { userId } } }]`. Edit UI includes lead assessor dropdown + multi-select checkbox list. Sync endpoint: `PUT /api/admin/table/Assessment/[id]/assessors`. Backfilled all 7 existing assessments.
> - **Interviewee Role:** Added `Interviewee` to `Role` enum. New `/fla/my-interviews` page with `/api/my/interviews` API — interviewees see only their assigned interview activities with full detail (controls, checklists, notes). Assessors and Admins can also use this dashboard. Interviewees without assessor rights are redirected from `/fla/[id]` to My Interviews.
> - **Activity Template:** 6 default activities auto-created per assessment on creation: Auditee Engagement Meeting, Kick Off Meeting, Update Session, Closing & Report Out, Controls Agreement Meeting (all ACT-001), and Document Review (ACT-002, mandatory). Backfill endpoint `POST /api/admin/backfill-activities` creates activities for assessments that have none.
> - **Document Review UI:** AssessmentActivitiesPanel shows dedicated "Documents for Review" guidance section when activity type is ACT-002, with instructions for using checklists + attachments.
> - **Assessment PUT Fix:** Removed duplicate `endDate` SET clause causing `42601: multiple assignments to same column`. Added explicit PostgreSQL enum casts for status and LOA. All 8 field edit scenarios verified (status, name, LOA, startDate, endDate, assessorId, activityTypeId, companyId).
> - **Activities APIs Rewritten:** All activity CRUD routes and My Interviews API rewritten from Prisma model queries to raw SQL (`$queryRawUnsafe`) to bypass PrismaPg adapter schema introspection caching. The adapter caches the schema on first connect; tables created after init are invisible to model queries.
> - **Aact Tables Created:** `Aact`, `AActUsers`, `AActControls`, `AActDetails` tables created in production PostgreSQL via raw SQL (were missing — previous activity CRUD tests operated on a different database instance). All 4 assessments backfilled with template activities.
> - **Lessons Captured:** 7 new lessons (2026-07-22) — npx tsx .env loading, PrismaPg adapter caching, duplicate SET clause, multi-assessor architecture, activity template design, readOnly mode pattern, raw SQL API pattern.
> - **Map Controls Panel:** Replaced the clunky "Bulk Map Controls to Requirements" collapsible section with a side-by-side mapping panel. Click "🗂 Map Controls" to toggle between normal card view and mapping mode. Left panel shows all unmapped controls for the current Process Area with checkboxes, filter, and Select All/Clear. Right panel shows compact requirement list — click a requirement to assign selected controls, or use the dropdown+button at the bottom. Drag-and-drop still works for single-control moves between requirements. Exits mapping mode with a single click.
> - **Database Backup & Restore:** Added "💾 Full Database Backup & Restore" section to `/admin/database-management`. Download complete SQL dump (schema + data) or restore from a `.sql` file upload with confirmation warning.
> - **Removed:** Old Bulk Map section (PA→SP comboboxes, checkbox list, requirement target) — 12 state variables, 50-line useEffect, and 150 lines of JSX deleted. Database Management page now standalone (navigated via Admin sidebar "🗄 Database" button).

> **v2.9.2 — Authorization Hardening & Security:**
> - **Centralized authz helpers** (`src/lib/authz.ts`): `requireAdmin`, `requireAuth`, `hasCompanyAccess`, `getSelectedCompanyId`, `requireSelectedCompany`, `getCompanyWhere`, `requireCompanyIdAccess`.
> - **Middleware:** `/admin/*` UI pages blocked for non-Admin users; `/api/admin/*` routes enforce their own auth (not blanket-blocked because `/fla` assessor pages call them).
> - **Admin page:** Adopt/Clean Templates now gated on `role === "Admin"` (was username comparison).
> - **Assessor-facing API routes:** Auth + company-access checks on assessments, findings, samples, actions, control-assignments, and assessment controls.
> - **Generic table API:** `GET /api/admin/table/[table]/data` allows any authenticated user with company scoping. `POST/PUT/DELETE` uses `ASSESSOR_WRITABLE_TABLES` whitelist (Aact, AActUsers, AActControls, AActDetails) for assessor writes; all other tables remain Admin-only.
> - **Admin-only routes standardized:** All 17 admin API routes (badges, database, diagnose, execute-sql, export/import, etc.) now use `requireAdmin()` helper instead of inline `auth()` + role checks.
> - **Session hardening:** JWT `maxAge` set to 8 hours (was 30 days default). Runtime role validation in `jwt` callback — only `"Admin"` or `"Assessor"` accepted; defaults to `"Assessor"` if corrupted.
> - **Data integrity:** 970 orphaned `MapControl2Requirement` rows dumped to JSON audit trail and deleted. All 3 companies verified at 1,048 controls each.
> - **Code quality:** Fixed `StatusBar.tsx` sync setState in effect (cascading render bug). Fixed `company-context.ts` empty object type. Removed unused imports in `OutstandingActions.tsx`.
> - **Nested repo hygiene:** `seam-assurance-app/` untracked from root `gamified-plant` repo (it has its own `.git`); added to root `.gitignore`.

> **v2.9.0 — Removed preDeployCommand (one-time ops):**
> - Removed `preDeployCommand` from `railway.toml`. Schema sync (`sync-schema.ts`), admin seeding (`seed.ts`), and activity log type seeding (`seed-activity-log-types.ts`) no longer run on every deploy. These are one-time operations. Schema changes now require manual `npx tsx prisma/sync-schema.ts` invocation.

> **v2.8.2 — In-App Help Page & Screenshots:**
> - New `/help` page with 8-section sidebar (Dashboard, Process Overview, Requirements & Controls, Knowledgebase & AI Chat, Assessments, Admin, Gamification, FAQ) featuring annotated screenshots and usage tips.
> - Screenshots captured for all key pages: dashboard-health.png, process-overview.png, requirements-controls.png, knowledgebase-chat.png, assessment-detail.png, admin-requirements.png.
> - "Help" link added to NavBar for all authenticated users. Image zoom on click for detail viewing.
> - **Fixes:** JSX escaped single-quote parse error (Turbopack) + `next/Image` 400 error on static PNGs — replaced with plain `<img>` tags.

> **v2.8.1 — Unmapped Controls Cleanup & Natural Sort:**
> - Duplicate detection and cleanup: 1,779 controls removed from Unmapped Controls where they already appeared in a specific requirement for the same PA. Each control now maps uniquely per company→process area.
> - Fixed sync-schema.ts dedup to use `processAreaId` instead of `standard` (was a deploy-time bomb).
> - All 3 companies verified: 65/65 PAs have their own Unmapped Controls with per-PA control mappings.
> - CompanySelector now sets `selectedCompanyId` cookie on mount for users with limited company access.
> - Requirement IDs sort naturally (1, 2, 3... 10, 11) instead of lexicographically (1, 10, 11, 2, 3).
> - Fixed Railway build: added missing `import { cookies }` in convert route.  
**Status:** Production — Deployed on Railway (PostgreSQL)  
**Code Name:** "CONAN PROJECT"  
**Companion:** `APP_DESIGN_PowerPlatform.md` — Power Platform (PowerApps/Power Automate/PowerBI/SharePoint) for tablet & mobile field use. Review when updating this document.

> **v2.8.0 — Unmapped Controls per ProcessArea, AI Chat Assistant & Knowledgebase Scoping:**
> - **Unmapped Controls restructure:** Changed `@@unique([requirementId, standard, companyId])` → `@@unique([requirementId, processAreaId, companyId])` on Requirement. Each ProcessArea now owns its own "Unmapped Controls" requirement (195 total across 3 companies). Controls auto-mapped via ControlSubProcess → SubProcess → ProcessArea chain.
> - **AI Chat Assistant:** New `POST /api/chat/knowledge` endpoint calls DeepSeek V4 (`deepseek-chat`) with knowledgebase context scoped to the process area + SAMS001 global knowledge. Parses `___CONTROL___` blocks from responses for suggested controls. New `POST /api/chat/update-control` creates Control records from approved suggestions. Chatbox integrated into Knowledgebase left panel with approve/reject cards and "Save to Knowledgebase" button.
> - **Knowledgebase scoping:** Added `companyId` and `processAreaId` to Knowledgebase model. Knowledgebase tab on process details page with 2-panel layout (entry tree + content viewer/editor). Upload supports .docx, .pdf, .md, .txt, .csv.
> - **Dashboard & Process Details UI polish:** Standard Health headers wrap text, score bars removed from PA breakdown. Requirements cards reordered (ReqNo → Scoring → ClauseContent). Process Health columns stack on mobile. "+ Add Control" removed from process details page.

> **v2.6.5 — Admin UX Hardening & Company-Aware Templates:** Proceed/Cancel confirmation for Adopt+Clean Templates, Admin-only gating. Templates page company-aware via cookie polling. `GET /api/admin/assessment-templates` filtered by companyId. Clean Templates API + button.

> **v2.6.4 — Adopt Templates Idempotency:** Added `@@unique` to Control + Requirement. Removed Standard NULL-companyId backfill. `orphan_analysis.py`, `full_db_backup.py`. SMDS 1:1 verified.

> **v2.6.3 — Deploy Fix: ON CONFLICT Mismatch:** Fixed P2010/42P10 in sync-schema.ts.

> **v2.6.2 — Admin API Fix & StatusBar:** 404 fix, ANALYZE table counts, StatusBar component.

> **v2.6.1 — Composite Unique Constraints:** 4 tables changed to @@unique([field, companyId]), 10 ON CONFLICT DO NOTHING.

> **v2.6.0 — Multi-Company Isolation:** Full company-scoped data isolation, Adopt Templates, CompanySelector.

> **v2.5.4 — Design Doc Audit:** Full codebase audit (45 models, 49 routes, 29 pages). Mapping Activity Log.

**Last Updated:** July 15, 2026 (v2.6.0)  
**Status:** Production — Deployed on Railway (PostgreSQL)  
**Code Name:** "CONAN PROJECT"

> **v2.5.4 — Design Doc Audit, Mapping Activity Log & API/Page Documentation:** Full audit of entire codebase against APP_DESIGN.md (45 models, 47 route files, 35 pages). Fixed API route count: 47 route files → ~80 HTTP endpoints. Added 17 undocumented pages and 13 undocumented API endpoints to docs. Architecture: added `CompanySelector.tsx`, `formatDate.ts`, `src/outputs/`, `src/proxy.ts`. Documented all 10+ schema cascade relationships beyond Assessment tree. Admin: new "📜 Mapping Activity Log" viewer with before/after JSON and ↩ Revert for MapControl2Requirement changes. All mapping ops (drag-drop, bulk map, unassign, +Add Control) create ActivityLog entries.
>
> **v2.5.2 — Assessment Cascade Delete, ControlForm Integration & Bulk Control-Requirement Mapping:** Added `onDelete: Cascade` relations: Assessment→Aact→AActControls/AActUsers/AActDetails (4 FK constraints applied via sync_schema.py with orphan cleanup). Comprehensive `DELETE /api/admin/table/Assessment/[id]` handler with manual polymorphic cleanup (AttachmentMapping, orphaned Attachment, MapArt2Know). Admin delete confirmation modal lists all cascaded and cleaned-up tables. ProcessDetailsClient now uses full `ControlForm` component for add/edit with `onSaved` callback (stays on source page; new controls auto-mapped to requirement). New collapsible "Bulk Map Controls to Requirements" section: PA→SP comboboxes, checkbox control list, requirement target, bulk `MapControl2Requirement` creation. ControlsSelector (assessment page) replaced SubProcess filter with Requirement filter; wildcard search uses regex (`*` pattern matching). `ControlFromDocument.controlType` changed from `ControlType` enum to `String` to resolve schema push conflict. Control statement tooltip on hover in Requirements & Controls tab. Alphabetical sorting on bulk map comboboxes.
>
> **v2.5.1 — UserCompany Assignments & API Fixes:** Admin Manage Company section now writes to `UserCompany` junction table (not `User.companyId`). All-assignments table shows user↔company mappings sorted by user name with Remove action. Fixed shared state collision between company editor and assignment form (`assignCompanyId` separate from `selectedCompanyId`). Added raw SQL INSERT fallback to POST `/api/admin/table/[table]` for models not in Prisma proxy (resolved "Unknown table: UserCompany" error). Documented pre-push build verification step in schema change checklist.
>
> **v2.5.0 — Multi-Company Architecture:** Restructured app for multi-company support. Added `companyId` to 8 core tables (Control, ProcessArea, SubProcess, Requirement, Assessment, Attachment, AssessmentTemplate, UserRole). Created `UserCompany` junction table for user↔company access control. Company-scoped assurance model: each company owns its controls, process areas, sub-processes, requirements, assessments, templates, and attachments. Template company "SAMS001" serves as master blueprint (admin-only, invisible to other users). Company selector combobox in header filters all views by selected company. Intelligent control↔requirement mapping via `MapControl2Requirement` with drag-and-drop re-assignment. Process Areas page restructured: Sub-Processes column replaced with Requirements; expandable requirement rows show linked controls with drag-and-drop. Schema change checklist documented to prevent stale admin column views.
>
> **v2.4.6 — Standard Table & Requirement-Control Mapping:** Added `Standard` model (6 rows) as canonical standards registry with sequenceNo ordering. Added `MapControl2Requirement` junction table (1,048 mappings) linking Control ⟷ Requirement. `ProcessArea.standardId` (StandardID) FK replaces free-text standard field. Admin Requirements tree derives hierarchy from Standard → ProcessArea tables. Requirements table default-sorted by Req ID ascending (natural sort). Expanded row shows Associated Controls panel.
>
> **v2.4.5 — Requirement Admin UI:** Renamed `MRequirement` → `Requirement` (model + DB table). Added Manage Requirements admin panel with 2-panel layout: left panel has hierarchical filter (Standard → Process Area), right panel lists requirements in sortable table. Click any row to expand an inline full-form editor for all columns.
>
> **v2.4.4 — Requirement Table:** Added `Requirement` model (803 rows) from SMDS ICOP statutory requirements plus 65 "Unmapped Controls" catch-all requirements (one per ProcessArea). rID as primary key. Includes standard, pID, requirementId, clauseContent, intentOutcome, clauseApplicability, references, applicable, processAreaId.
>
> **v2.4.3 — Schema Audit:** Verified 41 models / 10 enums in sync between Prisma schema and live DB. Fixed model count (was 37). Added missing Document Ingestion models: `DocumentExtract`, `ControlFromDocument`, `ControlFDSubProcess`. Documented manual `sync-schema.ts` sync mechanism (no Prisma Migrate).
>
> **v2.4.2 — Design Doc Audit & Cleanup:** Fixed stale document-conversion tech description (Python→mammoth/pdfjs-dist/tesseract.js). Added Known Architectural Debt section (§12) documenting three parallel assessment surfaces, `/api/admin/execute-sql` blast-radius risk, `/api/admin/check` inconsistent authorization, and `generate_testing_kri.py` rule-based heuristic engine.
>
> **v2.4.0 — Process Health & Control Scoring:** Added Process Health Dashboard on `/fla` main panel showing average control health scores per process area, grouped by Standard with collapsible sections and traffic-light indicators (🟢>80 Healthy, 🟡50-80 Tolerable, 🔴<50 Not Tolerable). `Control.rawHealthScore` now auto-recalculates on every effectiveness change or unassign via 90-day window (`Effective/Total × 100`). Batch script `scripts/recalc_control_health.py` for bulk recalculation. Leaderboard excludes only username "admin", shows top-3 + user's own position with gaps.
>
> **v2.3.0 — User Roles, Company & Favorites:** Added `UserRole`, `UserRoleMapping`, `Company` tables. User model extended with `position` and `companyId`. Admin pages: Manage Roles (role CRUD + user↔role mapping), Manage Company (company CRUD + user↔company assignment). `UserFavorite` table for generic entity favoriting (ProcessArea, SubProcess, Control). Assessment detail page restructured into 2-panel tabbed layout (Overview, Control Assignment, Sample Selection, Finding & Actions, Assessment Activities). Assessment Activities panel with activity CRUD, user assignment, and control mapping via `Aact`/`AActUsers`/`AActControls` tables.
>
> **v2.2.0 — Knowledgebase & Document Conversion:** Added Knowledgebase model for storing converted documents. New `POST /api/convert` endpoint converts .docx/.pdf to Markdown via mammoth (docx→markdown) and pdfjs-dist + tesseract.js (PDF with OCR fallback) and optionally saves to Knowledgebase. Knowledgebase page at `/admin/knowledgebase` with drag-and-drop upload, preview, search, and download. `MapArt2Know` table for artifact-to-knowledge mapping.
>
> **v2.1.0 — Attachment System:** Added Attachment & AttachmentMapping models with reusable AttachmentList component. Actions now support `actionTaken` field and file attachments. Attachments can be linked to any table (Action, Finding, Sample) via the mapping table.

## 1. Executive Summary

The **SEAM Assurance App** ("CONAN PROJECT") is a **multi-company** gamified internal control testing platform for oil & gas operations. It enables:

- **Multi-Company Isolation** — Controls, ProcessAreas, SubProcesses, Requirements, Assessments, Templates, and Attachments are company-scoped via `companyId`
- **Template Company** — "SAMS001" serves as the master blueprint; admin-only, invisible to other users
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

## 3. Database Schema (45 Models, 10 Enums)

### Enums
Role (Admin/Assessor), LOA (FirstLine/SecondLine/ThirdLine), ControlType (6 types), AssessmentStatus (Planned/InProgress/Completed/Cancelled), SampleStatus/Conclusion, Effectiveness, FindingSeverity, EmotionalDrive (8 drives), BadgeRarity

### Multi-Company Architecture (§3A)
- **Company** — company definitions (companyID unique, companyName, referenceID, shortName)
- **UserCompany** — M2M junction: User ⟷ Company access control
  - `userId` (FK→User), `companyId` (FK→Company.id)
  - Controls which companies appear in the header company selector combobox
  - Users are mapped to their parent company by default
- **Company-scoped tables** (have `companyId` FK):
  - Control, ProcessArea, SubProcess, Requirement
  - Assessment, AssessmentTemplate, Attachment
  - UserRole (role definitions can be company-specific)
- **Template Company "SAMS001"** — master blueprint with all baseline controls, process areas, sub-processes, requirements, templates
  - Only visible to Admin users
  - Immutable by non-admin users
  - New companies start by cloning from SAMS001
- **Company Selector** — combobox in header (between "CONAN PROJECT" title and "Dashboard" nav)
  - Shows `companyID` values the user has access to (via UserCompany)
  - Selection filters all views to the chosen company's data

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

### Standards & Hierarchy
- **Standard** — canonical standards registry (standard name unique, standardDescription, sequenceNo for display order)
  - 6 standards: Carbon/Environment/Social, HSSE & SP Foundations, Process Safety & Asset Management, Transport Safety, Workplace Health/Safety/Security, International Standards (ISO)
  - ProcessArea.standardId (StandardID) FK links to Standard.id
- **ProcessArea** — name (unique), pId, standard (legacy free-text), standardId (FK→Standard via StandardID column)
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
  - `assuranceID` FK → `Assessment.id` with **`ON DELETE CASCADE`**
- **AActControls** — M2M: Aact ⟷ Control (maps controls being tested in an activity)
  - `aaId` FK → `Aact.aaID` with **`ON DELETE CASCADE`**
- **AActUsers** — M2M: Aact ⟷ User with userRoles and assignmentRemarks
  - `aaId` FK → `Aact.aaID` with **`ON DELETE CASCADE`**
- **AActDetails** — activity detail text, summary, checklists (long text), activity notes (long text) (aactDetID, aaId, detail, summaryAgainstControls, checklists, activityNotes)
  - `aaId` FK → `Aact.aaID` with **`ON DELETE CASCADE`**

### Assessment Cascade Delete Chain
Deleting an Assessment cascades automatically through:
```
Assessment ──(Cascade)──▶ ControlAssignment
           ──(Cascade)──▶ Sample
           ──(Cascade)──▶ Finding ──(Cascade)──▶ Action
           ──(Cascade)──▶ Aact ──(Cascade)──▶ AActControls
                               ──(Cascade)──▶ AActUsers
                               ──(Cascade)──▶ AActDetails
```
Polymorphic tables (no FK possible) require manual cleanup in the DELETE handler:
- **AttachmentMapping** — `DELETE WHERE (destTable, recId)` matches any deleted entity
- **Attachment** — orphaned records (no remaining AttachmentMapping references)
- **MapArt2Know** — `DELETE WHERE artID` matches any deleted entity ID

### Findings & Actions
- **Finding** — FID-XXXXXX IDs, severity, risks, controls
- **Action** — remediation per finding (ownership, dates, extensions, closure, actionTaken)

### Attachment System
- **Attachment** — file metadata (fileName, filePath, fileSize, description, uploadedBy, uploadDate)
- **AttachmentMapping** — polymorphic M2M: Attachment → any table (destTable, recId)

### Knowledge Management
- **Knowledgebase** — converted documents (kID, knowledgeName, knowledgeContent, remarks, createdDate, addedBy, companyId, processAreaId)
  - `@@unique([knowledgeName, companyId])` — prevents duplicate document names within a company
  - `processAreaId` optionally links to a ProcessArea; uploads from the Process Details page auto-set this
  - `companyId` scopes documents to a company; KnowledgebaseManager tree groups by company
  - Knowledgebase tab on `/setup/processdetails/[id]` with 2-panel layout: left panel has entry tree + AI chatbox, right panel shows content with edit mode for owners/admins
  - AI Chat Assistant (DeepSeek V4) with context from process area knowledge + SAMS001 global knowledge
  - Fed by `POST /api/convert` which uses **mammoth** (docx→markdown) and **pdfjs-dist + tesseract.js** (PDF text extraction with OCR fallback) — pure Node/JS, no Python dependency. Also supports .md (passthrough), .csv (→table), .txt (→code block)
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
- **Requirement** — 738 statutory/regulatory requirements from SMDS ICOP framework + 195 "Unmapped Controls" catch-all requirements (one per ProcessArea per company)
  - `@@unique([requirementId, processAreaId, companyId])` — one Unmapped Controls per ProcessArea
  - `rID` as PK, `standard`, `pID`, `requirementId`, `clauseContent`, `intentOutcome`, `clauseApplicability`, `references`, `applicable`
  - `processAreaId` FK → ProcessArea
  - `controlMappings` → MapControl2Requirement[] (M2M to Control)
  - Controls are auto-mapped to their PA's Unmapped Controls via ControlSubProcess → SubProcess → ProcessArea chain
  - Imported from `frontline library/mRequirement.csv` via `scripts/import_mrequirements.py`
  - Admin UI at `/admin` → "📋 Requirements" with:
    - **Tree view:** Standard → ProcessArea hierarchy derived from Standard + ProcessArea tables (standardId FK)
    - **Table:** default-sorted by Req ID ascending (natural sort: "QMS-6.1" before "QMS-10.1")
    - **Inline editor:** full-form edit on row expand
    - **Associated Controls panel:** lists controls mapped via MapControl2Requirement, with links to `/setup/controls?edit={id}` for full Edit Control form
- **MapControl2Requirement** — M2M junction: Control ⟷ Requirement
  - `controlId` (FK→Control), `requirementRId` (FK→Requirement.rId), `processAreaId`
  - Unique on (controlId, requirementRId)
  - Backfilled via shared ProcessArea (control.processAreaId = requirement.processAreaId → mapping)

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
Company ──< UserCompany >── User (access control)
Company ──< Control, ProcessArea, SubProcess, Requirement (companyId FK)
Company ──< Assessment, AssessmentTemplate, Attachment (companyId FK)
Standard ──< ProcessArea (standardId)
ProcessArea ──< Requirement (processAreaId)
ProcessArea ──< Control (processAreaId)
Requirement ──< MapControl2Requirement >── Control
User ──< Assessment (assessor)
User ──< UserRoleMapping >── UserRole
User ──< UserFavorite (entityType + entityId)
User ──< AActUsers >── Aact
Assessment ──< ControlAssignment >── Control
Assessment ──< Sample, Finding ──< Action
Control ──< ControlSubProcess >── SubProcess
Control ──< AActControls >── Aact
Control ──< MapControl2Requirement >── Requirement
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
│   │   ├── help/    # In-app user manual with annotated screenshots, 8-section sidebar nav
│   │   └── api/     # 70+ API routes
│   ├── components/  # NavBar (with Help link), SignOutButton, GamificationDashboard, DeleteButton, AttachmentList, UserSearchSelect, CompanySelector
│   ├── lib/         # prisma.ts, gamification.ts, activity-log.ts, findings.ts, schema-introspection.ts, fallback-schemas.ts, formatDate.ts
│   ├── outputs/     # Export output directory
│   ├── proxy.ts     # Prisma Proxy pattern for lazy client init
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

## 6. API Routes (~90 HTTP endpoints across 49 route files)

### Assessments
GET/POST `/api/admin/assessments`, GET/PUT/DELETE `/[id]`

**Specialized DELETE:** `DELETE /api/admin/table/Assessment/[id]` has a dedicated `deleteAssessment()` handler that:
1. Collects all child IDs before deletion (findings, samples, aacts, actions)
2. Cleans up polymorphic `AttachmentMapping` records across all 5 entity types
3. Removes orphaned `Attachment` records (no remaining mappings)
4. Cleans up `MapArt2Know` polymorphic links
5. Deletes the Assessment — Prisma cascades the remaining 7 tables

Returns a JSON summary: `{ success, deleted: { assessmentId, cascadedTables[], orphanCleaned[], stats{} } }`

### Control Assignments
PUT/DELETE `/api/admin/control-assignments/[id]` — auto-recalculates `Control.rawHealthScore`

### Samples, Findings, Actions
Full CRUD at `/api/admin/samples`, `/findings`, `/actions` with `/[id]`

### Attachments
GET `/api/attachments?destTable=X&recId=Y`, POST (FormData upload), DELETE `/[id]`

### Document Conversion
POST `/api/convert` — upload .docx/.pdf/.md/.txt/.csv, converts to Markdown (mammoth for docx, pdfjs-dist + tesseract.js OCR for PDF, .md passthrough, .csv→table, .txt→code block); optional `saveToKnowledgebase=true` + `remarks` + `companyId` + `processAreaId` to persist to Knowledgebase table

### AI Chat Assistant
POST `/api/chat/knowledge` — sends user message + processAreaId + companyId + conversation history to DeepSeek V4 (`deepseek-chat`). System prompt includes process area info and knowledgebase content from both the current PA and SAMS001 global knowledge. Parses `___CONTROL___` JSON blocks from responses for suggested controls.

POST `/api/chat/update-control` — creates a Control record from an AI-suggested control (name, statement, controlType, processAreaId, companyId).

### Templates
GET/POST `/api/admin/assessment-templates`, GET/PUT/DELETE `/[id]`

### Gamification
POST `/api/gamification/award`, GET `/stats/[userId]`, GET `/leaderboard` — leaderboard excludes username "admin", uses cumulative `SUM(PointTransaction.points)`

### Controls & Reference Data
GET `/api/controls` — list all controls with process areas, sub-processes, and requirement mappings
GET `/api/controls/reference` — control reference data

### Badges
POST `/api/admin/badges/generate` — generate badges from definitions
DELETE `/api/admin/badges/clear` — clear all badges and user achievements

### System & Diagnostics
GET `/api/admin/diagnose` — system diagnostics
GET `/api/admin/tables` — list all database tables with row estimates
GET `/api/admin/export-all-tables` — full database export
GET `/api/admin/database/tables` — database table metadata
GET `/api/admin/database/tables/[name]` — per-table schema info
GET `/api/admin/database/sync-check` — schema sync validation

### Templates & Suggestions
GET/POST `/api/admin/template/[table]` — per-table template CRUD
POST `/api/admin/suggest-activity-types` — activity type suggestions

### Admin Utilities
CSV validate/import, generic table CRUD (all 45 models), column management, SQL executor (`/api/admin/execute-sql` — Admin-only, small blocklist: DROP DATABASE, DELETE FROM information_schema, PRAGMA database_list; see §12 for blast-radius notes), database management, export, diagnostics, information_schema column discovery

### Table Import/Export (v2.9.1)
`GET /api/admin/table/[table]/export` — exports table as downloadable CSV
`GET /api/admin/table/[table]/sql` — exports table as SQL (CREATE TABLE IF NOT EXISTS + batch INSERT)
`GET /api/admin/table/[table]/template` — downloads CSV template with header row + one sample row
`POST /api/admin/table/[table]/import` — accepts CSV file upload (multipart `file` field), parses with quote/comma/newline handling, validates headers against table columns, coerces types (Boolean/Int/Float/DateTime), auto-generates String IDs, inserts rows

### Database Backup & Restore (v2.9.1)
`GET /api/admin/database/backup` — full database SQL dump: queries information_schema for all public tables, generates DROP/CREATE TABLE with PKs + unique constraints + column types/defaults, batch INSERTs all data (100 rows/statement), wrapped in BEGIN/COMMIT, returns downloadable .sql file
`POST /api/admin/database/restore` — accepts .sql file upload, state-machine parser handles single-quote/$$/\$tag\$ quoting, executes statements sequentially, returns executed/skipped/error counts

## 7. Frontend Pages

| Route | Description |
|-------|-------------|
| `/login` | Login form |
| `/fla` | **Assurance Management Dashboard** — Process Health Dashboard (collapsible by standard, traffic-light indicators) + Gamification sidebar (points, earned badges, leaderboard top-3) |
| `/fla/new` | Create assessment with cascading control picker |
| `/fla/[id]` | **2-panel tabbed assessment**: Overview, Control Assignment, Sample Selection, Finding & Actions, Assessment Activities. Control Assignment has collapsible "Select Controls" panel with ProcessArea→Requirement→search filter chain (wildcard `*` regex matching on control statements) and checklist; "Assigned Controls" panel grouped by requirement. |
| `/admin` | Admin dashboard with 45 table tiles, Badge Management, Template Management, **User Management** (Add/Edit with position/companyId, **Manage Roles**, **Manage Company**), **Requirements** (tree: Standard→ProcessArea, sorted table, inline editor, Associated Controls), Knowledgebase, **Database Management** (full backup export + restore), table view with CSV import/export/template + SQL export buttons |
| `/admin/templates` | Template list + editor |
| `/admin/knowledgebase` | Document upload (.docx/.pdf → Markdown), search, preview, download |
| `/admin/table/[table]` | Generic table editor (auto-discovers columns via information_schema) |
| `/setup/process-areas` | Process areas with standard filter; expandable rows show Requirements (not Sub-Processes); requirement rows expand to linked controls with drag-and-drop re-mapping |
| `/setup/processdetails/[id]` | 3-tab drill-down: Process Overview (stats, linked assessments, outstanding actions), **Requirements & Controls** (expandable requirement groups with drag-and-drop control re-mapping, full ControlForm integration for add/edit with `onSaved` callback, "Unassign" moves control to Unmapped Controls, **🗂 Map Controls** toggle for side-by-side mapping panel: left=unmapped controls with checkboxes+filter, right=requirements list with one-click assign + dropdown bulk assign), Assessments (linked assessments list) |
| `/setup/controls` | 28-field control form |
| `/setup/badges` | Badge generation and management |
| `/setup/sub-processes` | Sub-Process CRUD table |
| `/setup/activity-types` | Assurance activity type CRUD |
| `/setup/assessments` | Alternate assessment list + create workflow |
| `/admin/assessments` | Admin assessment list, create, from-template |
| `/admin/templates/[id]` | Template edit page |
| `/admin/database-management` | Database management utilities |
| `/admin/document-controls` | Document-extracted controls browser |
| `/admin/import-csv` | CSV import page |
| `/admin/export-data` | Data export page |
| `/admin/add-activity-types` | Add activity types |
| `/admin/columns` | Column management |

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
startCommand = "npm run start"
```

- Railway PostgreSQL plugin auto-provisions database
- Internal: `postgres.railway.internal:5432`, Public: `hayabusa.proxy.rlwy.net:54471`
- **`preDeployCommand` removed (v2.9.0):** Schema sync, seeding, and activity log type seeding were one-time operations. They no longer run on every deploy. If schema changes are needed, run `npx tsx prisma/sync-schema.ts` manually or via a dedicated one-time script.
- Schema changes use direct SQL (ALTER/CREATE IF NOT EXISTS) in `prisma/sync-schema.ts` — **not** Prisma Migrate (no `_prisma_migrations` table).

## 12. Known Architectural Debt & Risks

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

### Polymorphic Table Cleanup on Entity Deletion
`AttachmentMapping` uses `(destTable, recId)` and `MapArt2Know` uses `artID` — both are polymorphic patterns that cannot have FK constraints. When an Assessment (or any entity they reference) is deleted, these tables require **manual SQL cleanup** in the DELETE handler. The `deleteAssessment()` function in `[table]/[id]/route.ts` is the reference implementation: collect all child entity IDs before Prisma cascade, then issue targeted DELETE statements for polymorphic tables.

### `scripts/generate_testing_kri.py` — Rule-Based Heuristic Engine
This script generates TestingApproach and KeyRiskIndicator for `ControlFromDocument` records using **keyword/regex heuristics** (not ML/LLM). It:
1. Derives Testing Approach from keyword scanning (inspect/verify/audit/calibrate/sample/witness/certify) plus frequency-pattern extraction (annually/quarterly/etc.)
2. Derives KRI by classifying controls into 8 types (inspection/approval/verification/monitoring/maintenance/training/documentation/testing/general) via weighted keyword scoring, then selecting lead/lag indicator templates

Flagged as a candidate for future LLM-assisted enhancement.

## 13. Changelog

| Version | Date | Changes |
|---------|------|---------|
| v2.9.2 | 2026-07-21 | Authz hardening: centralized helpers, middleware /admin blocking, role-based gating, company-scoped API access, ASSESSOR_WRITABLE_TABLES whitelist. Session JWT maxAge=8h + role validation. 17 admin routes standardized to requireAdmin. 970 orphan MCR rows cleaned. StatusBar, company-context, OutstandingActions fixes. Nested repo hygiene. |
| v2.9.1 | 2026-07-20 | Admin table import/export buttons (CSV import, CSV template, CSV export, SQL export). Database Management page: full backup download + restore from SQL file. New APIs: table SQL export, table CSV import, full DB backup, full DB restore. Template API now returns CSV. |
| v2.7.0 | 2026-07-16 | Outstanding Actions dashboard (sortable/resizable, modal with attachments). actionId ACTID-XXXXXX. 3 deploy fixes. All companies verified 1:1. 45 models, 10 enums, 49 routes, 29 pages, 9 components. |
| v2.6.5 | 2026-07-16 | Proceed/Cancel confirmation for Adopt+Clean Templates, Admin-only gating. Templates page company-aware via cookie polling. GET /api/admin/assessment-templates now filtered by companyId. OGP verified 1:1. |
| v2.6.4 | 2026-07-16 | Added @@unique to Control + Requirement. Clean-templates API + Clean button. Removed Standard NULL-companyId backfill. DEPLOYMENT_CHECKLIST.md. SMDS verified 1:1. |
| v2.6.3 | 2026-07-16 | Fixed sync-schema.ts P2010/42P10 deploy crash. Removed ON CONFLICT, added companyId column + composite unique index. |
| v2.6.2 | 2026-07-16 | Fixed 404 on all /api/admin/table/[table]/data routes (stale Turbopack). Fixed /api/admin/tables row counts (ANALYZE). StatusBar component. |
| v2.6.1 | 2026-07-15 | Composite unique constraints on 4 company-scoped tables. All 10 adopt-template INSERTs have ON CONFLICT DO NOTHING. |
| v2.9.3 | 2026-07-21 | Map Controls Panel: side-by-side mapping UI replaces bulk map section. Left=unmapped controls (checkbox+filter), right=requirements (click-to-assign + dropdown bulk assign). Database Backup & Restore UI on /admin/database-management. Removed old Bulk Map (12 state vars, useEffect, 150 lines JSX). |
| v2.5.2 | 2026-07-14 | Assessment cascade delete (4 FK constraints, orphan cleanup, confirmation modal). ControlForm integration in ProcessDetailsClient with onSaved callback. Bulk Map Controls to Requirements panel. ControlsSelector: Requirement filter replaces SubProcess, regex wildcard search. ControlFromDocument.controlType → String. Control statement tooltips. Bulk map combobox sorting. Design doc audit with 7 gap fixes. |
| v2.5.0 | 2026-07-14 | Multi-company architecture: companyId added to 8 core tables. UserCompany junction for access control. Template company "SAMS001" (admin-only). Company selector combobox in header. Control↔Requirement mapping: 718 intelligent + 330 catch-all = 1,048 total. Drag-and-drop control re-mapping. Process Areas page restructured with Requirements column. Schema change checklist documented. |
| v2.4.6 | 2026-07-13 | Added Standard table (6 standards, sequenceNo ordering). Added MapControl2Requirement junction (1,048 mappings). ProcessArea.standardId FK. Requirements tree from Standard+ProcessArea tables. Req ID natural sort. Associated Controls panel. |
| v2.4.5 | 2026-07-13 | Renamed MRequirement → Requirement. Added Manage Requirements admin panel with hierarchical filter and inline editor. |
| v2.4.4 | 2026-07-13 | Added Requirement table (738 statutory requirements from SMDS ICOP). Import script at scripts/import_mrequirements.py. |
| v2.4.3 | 2026-07-13 | Schema audit: verified 41 models/10 enums in sync. Added DocumentExtract, ControlFromDocument, ControlFDSubProcess to schema docs. |
| v2.4.2 | 2026-07-13 | Design doc audit: fix stale conversion tech, add Known Architectural Debt (§11), document execute-sql risk & admin/check inconsistency |
| v2.0.0 | 2026-07-07 | PostgreSQL migration, Railway deployment, ActivityLogType, force-dynamic, trustHost |
| v1.11.0 | 2026-07-04 | ControlSubProcess M2M junction |
| v2.1.0 | 2026-07-08 | Attachment system, actionTaken field, AttachmentList component |
| v1.8.0 | 2026-06-30 | Initial documented version |

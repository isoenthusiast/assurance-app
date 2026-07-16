# CONAN PROJECT — Power Platform Companion Design

**Last Updated:** July 16, 2026 (v1.0)  
**Status:** Design Phase  
**Platform:** Microsoft Power Platform (PowerApps, Power Automate, PowerBI, SharePoint Lists)  
**Form Factor:** Tablet & Mobile Only (No Desktop UI)

> ⚠️ **Companion Document:** When `APP_DESIGN.md` (Next.js/PostgreSQL) is updated, review whether the feature should also be implemented in the Power Platform version. Not all features need to migrate — only those suitable for field/mobile use.

---

## 1. Design Philosophy

The Power Platform version is a **field companion** to the main web app — not a replacement. It targets tablet and mobile users (auditors, assessors, action owners) who need to:

- View assigned assessments and outstanding actions on-site
- Capture findings and evidence (photos, notes) during field walks
- Mark actions as complete with closure notes
- View dashboards (KPIs, leaderboard) in a mobile-optimized layout

The main web app (Next.js) remains the **system of record** for master data management, template adoption, admin operations, and heavy data entry.

### Key Constraints
| Constraint | Impact |
|------------|--------|
| Tablet/Mobile only | No multi-column desktop layouts; use stacked cards, accordions, single-column scroll |
| SharePoint Lists as DB | No FK constraints, no transactions, 5K item view threshold, no raw SQL |
| PowerApps canvas | Limited component library; custom components need Power Apps Component Framework (PCF) |
| Offline support | PowerApps has basic offline; complex offline sync needs Power Automate + Dataverse |

---

## 2. Data Architecture (SharePoint Lists)

Each Prisma model maps to a SharePoint List. Lists use the same naming convention with a `PP_` prefix to distinguish from the main database.

### Core Lists

| SharePoint List | Prisma Model | Notes |
|----------------|-------------|-------|
| `PP_Company` | Company | Lookup column for company scoping |
| `PP_Standard` | Standard | Reference data |
| `PP_ProcessArea` | ProcessArea | Grouped by Standard |
| `PP_SubProcess` | SubProcess | Parent lookup to ProcessArea |
| `PP_Control` | Control | Core entity; linked to ProcessArea, SubProcess |
| `PP_Requirement` | Requirement | Statutory/ISO requirements |
| `PP_MapControl2Requirement` | MapControl2Requirement | Junction: Control ↔ Requirement |
| `PP_Assessment` | Assessment | Assessment header |
| `PP_ControlAssignment` | ControlAssignment | Which controls are in an assessment |
| `PP_Sample` | Sample | Individual test samples |
| `PP_Finding` | Finding | Findings raised during sampling |
| `PP_Action` | Action | Remediation actions (with ACTID) |
| `PP_Attachment` | Attachment | File metadata (files go to SharePoint Document Library) |

### Lightweight Lists (Mobile-Optimized)

| SharePoint List | Purpose |
|----------------|---------|
| `PP_User` | User profiles (synced from main app) |
| `PP_ActionAssignment` | Action assignments to users |
| `PP_AssessmentChecklist` | Simple checklist items for field assessments |

### Data Sync Strategy

```
Main App (PostgreSQL) ←→ Power Automate ←→ SharePoint Lists
```

- **Master data sync** (Standards, PAs, Controls, Requirements): Scheduled Power Automate flow runs daily to push changes from main app to SharePoint
- **Assessment sync**: Assessments created in the main app are synced to SharePoint; field updates (findings, actions) flow back
- **Conflict resolution**: Main app is always the source of truth; SharePoint data is a working copy

---

## 3. PowerApps Screens (Tablet/Mobile Layout)

### Screen 1: Home Dashboard
- **Layout:** Single-column scrollable cards
- **Cards:**
  - Outstanding Actions (count + tap to view list)
  - Assessments In Progress
  - Quick Actions (Start Assessment, Capture Finding)
- **Top Bar:** Company selector dropdown, user avatar

### Screen 2: My Actions
- **Layout:** Filterable list with status indicators
- **Filters:** Overdue, Due This Week, All Open
- **Tap Action:** Opens Action Detail screen
- **Columns (card view):** ACTID, Finding Description, Target Date, Status icon

### Screen 3: Action Detail (View/Edit)
- **View Mode:** Finding details, action description, party, target date, attachments
- **Edit Mode (if authorized):** 
  - Action Taken (multi-line text)
  - Mark as Complete toggle
  - Closure notes
  - Photo capture → saves to SharePoint Document Library
- **Attachments:** Thumbnail gallery, tap to view full; + button to add photo from camera

### Screen 4: Assessment List
- **Layout:** Cards grouped by Status (Planned, In Progress)
- **Tap Assessment:** Opens Assessment Detail

### Screen 5: Assessment Detail
- **Layout:** Accordion sections
- **Sections:**
  - Info (name, dates, status)
  - Samples (list with status badges)
  - Findings (expandable cards)
  - Actions (linked to My Actions)

### Screen 6: Capture Finding
- **Optimized for one-handed use:**
  - Description (text input)
  - Severity (dropdown: Low, Medium, High, Serious)
  - Photo capture (camera button)
  - Control reference (dropdown, searchable)
  - Save button (prominent, bottom-fixed)

### Screen 7: Leaderboard & Stats
- **Powered by PowerBI embedded report** or PowerApps charts
- Top 5 ranked users, current user's position
- Badge gallery (icons)
- Weekly points trend

---

## 4. Power Automate Flows

| Flow | Trigger | Action |
|------|---------|--------|
| **Master Data Sync** | Scheduled (daily) | Pull Standards, PAs, Controls, Requirements from PostgreSQL → upsert to SharePoint Lists |
| **Assessment Sync** | When Assessment created in main app | Create Assessment + ControlAssignments in SharePoint |
| **Action Feedback Loop** | When Action updated in SharePoint | Push actionClosureEffective, actionTaken, attachments back to main app API |
| **Attachment Upload** | When file added to SharePoint Library | Create AttachmentMapping record via main app API |
| **Overdue Reminder** | Scheduled (daily) | Email action parties for overdue actions |
| **New Finding Alert** | When Finding created in SharePoint | Notify assessment lead via Teams/Email |

---

## 5. PowerBI Dashboard (Mobile Layout)

### Report Pages (Mobile-Optimized)

**Page 1: Process Health Overview**
- Traffic-light cards per Standard (🟢🟡🔴)
- KPI: % controls with health > 80
- Bar chart: Controls by Process Area (horizontal, scrollable)

**Page 2: Action Tracking**
- Donut chart: Open vs Closed actions
- Bar chart: Actions by Action Party
- Table: Overdue actions (scrollable)

**Page 3: Assessment Progress**
- Cards: Planned, In Progress, Completed counts
- Gantt-style timeline of assessments

**Page 4: Leaderboard**
- Ranked list with points and badges
- User's own stats highlight card

---

## 6. SharePoint List Schema Details

### PP_Action
| Column | Type | Notes |
|--------|------|-------|
| Title | Single line | ACTID (e.g., ACTID-000001) |
| ActionDescription | Multiple lines | |
| ActionParty | Person | SharePoint person picker |
| Auditee | Person | |
| TargetDate | Date | |
| ActionClosureEffective | Yes/No | |
| ActionTaken | Multiple lines | |
| ActionClosureApprovedBy | Person | |
| FindingID | Lookup | → PP_Finding |
| AssessmentID | Lookup | → PP_Assessment |
| CompanyID | Lookup | → PP_Company |

### PP_Finding
| Column | Type | Notes |
|--------|------|-------|
| Title | Single line | Auto-numbered |
| Description | Multiple lines | |
| Severity | Choice | Low, Medium, High, Serious |
| Risks | Multiple lines | |
| ControlRefs | Multiple lines | Comma-separated control references |
| AssessmentID | Lookup | → PP_Assessment |
| SampleID | Lookup | → PP_Sample |

---

## 7. User Authentication & Authorization

- **Authentication:** Azure AD / Microsoft 365 (same tenant)
- **Role mapping:** Admin role in main app → Power Platform Admin; Assessor → standard user
- **Company scoping:** User's company assignment from main app determines visible data
- **Action edit permission:** Admin, actionParty, or auditee (same logic as main app)

---

## 8. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Create SharePoint Lists with all columns
- [ ] Master Data Sync flow (PostgreSQL → SharePoint)
- [ ] Home Dashboard screen (read-only)
- [ ] My Actions list + detail view

### Phase 2: Field Capture (Weeks 3-4)
- [ ] Capture Finding screen with photo upload
- [ ] Action edit/complete flow
- [ ] Action Feedback Loop (SharePoint → PostgreSQL)
- [ ] Assessment list + detail screens

### Phase 3: Reporting (Weeks 5-6)
- [ ] PowerBI mobile dashboard
- [ ] Overdue Reminder flow
- [ ] Leaderboard screen
- [ ] User testing on tablet + mobile

---

## 9. Differences from Main App (Feature Gap Analysis)

| Feature | Main App (Next.js) | Power Platform | Reason |
|---------|-------------------|----------------|--------|
| Adopt Templates | ✅ Bulk copy SAMS001→company | ❌ Not needed | Admin-only operation; use main app |
| Generic Table CRUD | ✅ Admin can edit any table | ❌ Not needed | Admin operation |
| Mapping Activity Log | ✅ Full audit trail | ❌ Simplified | SharePoint versioning provides basic audit |
| Sortable/resizable columns | ✅ Custom React | ⚠️ Limited | SharePoint list views have basic sorting |
| Process Health Dashboard | ✅ Full interactive | ✅ PowerBI cards | Redesigned for mobile |
| Badge Management | ✅ Admin CRUD | ❌ Not needed | Admin operation |
| Knowledgebase | ✅ Full editor | ✅ Read-only view | Reference in field |
| Document Controls | ✅ Ingestion pipeline | ❌ Not needed | Admin operation |
| User Management | ✅ Full admin | ❌ Not needed | Uses Azure AD |
| Clean Templates | ✅ API + button | ❌ Not needed | Admin operation |
| StatusBar | ✅ Cookie-based | ❌ Not needed | Mobile has native notifications |
| Outstanding Actions | ✅ Full modal + edit | ✅ Core feature | Primary mobile use case |
| Attachment upload | ✅ File input | ✅ Camera + gallery | Enhanced for mobile |
| Company filtering | ✅ Cookie/dropdown | ✅ User profile | Based on Azure AD group |

---

## 10. Synchronization with Main App Design

> **Rule:** When `APP_DESIGN.md` is updated, review this document to determine if:
> 1. The new feature is relevant for mobile/field use
> 2. New data columns need to be added to SharePoint Lists
> 3. New API endpoints need corresponding Power Automate flows
> 4. The feature gap analysis needs updating

### Sync Checklist
- [ ] New Prisma columns → Added to corresponding SharePoint List?
- [ ] New API endpoints → Power Automate flow created?
- [ ] Unique constraints → SharePoint List validation rules?
- [ ] New components → Mobile equivalent designed?

---

## Appendix A: SharePoint List Creation Script (PnP PowerShell)

```powershell
# Example: Create PP_Action list
Connect-PnPOnline -Url "https://tenant.sharepoint.com/sites/CONAN" -Interactive
New-PnPList -Title "PP_Action" -Template GenericList
Add-PnPField -List "PP_Action" -DisplayName "ActionDescription" -InternalName "ActionDescription" -Type Note
Add-PnPField -List "PP_Action" -DisplayName "ActionParty" -InternalName "ActionParty" -Type User
Add-PnPField -List "PP_Action" -DisplayName "TargetDate" -InternalName "TargetDate" -Type DateTime
# ... additional fields
```

## Appendix B: Power Automate — PostgreSQL Connector Notes

The main app's API endpoints can be called directly from Power Automate using the **HTTP** connector:
- `GET https://app.railway.app/api/admin/actions` — list actions
- `PUT https://app.railway.app/api/admin/actions/{id}` — update action
- Authentication: API key or service account token (to be configured)

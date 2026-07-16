# CONAN PROJECT — User Manual (Draft Skeleton)

**Version:** v2.8.2 | **Last Updated:** July 17, 2026

> 💡 **Looking for quick help?** An in-app user manual with annotated screenshots is available at **Help** in the navigation bar (or navigate to `/help`). This document provides the complete reference.

---

## 1. Introduction

### 1.1 What is CONAN PROJECT?
CONAN PROJECT is a multi-company gamified internal control testing platform for oil & gas operations. It helps you manage controls, plan assessments, execute tests, track findings and actions, monitor process health, and earn gamification rewards.

### 1.2 Key Concepts
| Term | Definition |
|------|-----------|
| **Company** | Your organization (e.g., SMDS, OGP). All data is scoped to your company. |
| **Standard** | A compliance framework (e.g., "Process Safety & Asset Management") containing multiple Process Areas. |
| **Process Area** | A functional domain (e.g., "Asset Integrity") with controls, requirements, and assessments. |
| **Control** | A safeguard or procedure that mitigates risk. Controls are tested via assessments. |
| **Requirement** | A statutory/regulatory obligation that controls help satisfy. |
| **Unmapped Controls** | Controls not yet assigned to a specific requirement — a holding bucket per Process Area. |
| **Assessment** | A planned review of controls, producing findings and actions. |
| **Finding** | An issue identified during assessment testing. |
| **Action** | A remediation task assigned to resolve a finding. |
| **Knowledgebase** | A repository of converted documents (procedures, manuals, standards) with AI chat assistance. |

### 1.3 Roles
| Role | Capabilities |
|------|-------------|
| **Admin** | Full access: manage users, roles, companies, templates, all admin functions, view SAMS001 master data. |
| **Assessor** | Conduct assessments, create findings/actions, view dashboards, upload knowledge. Company-scoped. |

---

## 2. Getting Started

### 2.1 Logging In
Navigate to the app URL. Enter your username and password. Upon first login, your default company is selected automatically.

### 2.2 Company Selector
The dropdown in the top navigation bar shows companies you have access to. Select a company to filter all views to that company's data.

### 2.3 Navigation
- **Dashboard** — Process health overview, outstanding actions, gamification stats.
- **Assessments** — List and manage assessments.
- **Process Area** — Browse process areas and their requirements, controls, and knowledge.
- **Controls** — Browse and search all controls.
- **Admin** — User management, templates, knowledgebase, database tables (Admin only).

---

## 3. Dashboard (`/fla`)

### 3.1 Standard Health
Shows average control health per standard, grouped by company. Click a standard to expand its process areas with health percentages and control counts.

- 🟢 **Healthy** (>80%)
- 🟡 **Tolerable** (50–80%)
- 🔴 **Not Tolerable** (<50%)

### 3.2 Outstanding Actions
Collapsible table of open actions from findings. Sort by columns, click to view details. Edit inline if you are the action party, auditee, or an admin.

### 3.3 Gamification Widgets
- **Total Points** — Your cumulative gamification score.
- **Badges Earned** — Achievement badges you've unlocked.
- **Leaderboard** — Top scorers across the organization.

---

## 4. Process Areas (`/setup/process-areas`)

### 4.1 Browsing Process Areas
List of all process areas in your company. Use the search bar to filter by name.

### 4.2 Process Details (`/setup/processdetails/[id]`)

#### Tab: Process Overview
- **Stats cards**: Effective controls, assessments completed, findings, open actions.
- **Process Health**: Control effectiveness, assessment activity, sample testing — each with percentage bars.
- **Outstanding Actions**: Findings with open actions linked to this process area.
- **Requirements Summary**: Cards showing each requirement with health score and clause content.

#### Tab: Requirements & Controls
- Expandable requirement cards showing linked controls in a table.
- **Drag-and-drop**: Move controls between requirements by dragging.
- **Unassign**: Move a control to "Unmapped Controls" to remove it from a requirement.
- **Bulk Map Controls**: Expand the section at the bottom to assign multiple controls to a requirement at once.
- **Unmapped Controls**: A special requirement holding controls not yet assigned to any specific requirement (one per Process Area).

#### Tab: Assessments
- List of assessments linked to this process area's controls.
- Click "View" to go to the assessment detail page.
- Click "+ Add Assessment" to create a new assessment with all controls pre-selected.

#### Tab: Knowledgebase
- **Left panel**: Knowledge entries tree + AI Chat Assistant.
- **Right panel**: Document content viewer/editor.
- Upload documents (.docx, .pdf, .md, .txt, .csv) which are converted to Markdown and saved.
- **AI Chat**: Ask questions about the process area. The AI has context from all knowledgebase documents for this PA and SAMS001 global knowledge.
- **Control suggestions**: The AI may suggest controls. Click "✓ Approve" to add them to the database.
- **Save to Knowledgebase**: Save AI responses as new knowledge entries.

---

## 5. Assessments

### 5.1 Creating an Assessment
From a process area's Assessments tab, click "+ Add Assessment". Give it a name, select a start date, choose which controls to include, and submit.

### 5.2 Assessment Detail (`/fla/[id]`)
Tabs:
- **Overview** — Assessment details, status, dates.
- **Control Assignment** — Map controls to the assessment and track effectiveness.
- **Sample Selection** — Create and manage test samples.
- **Findings & Actions** — Record findings and assign remediation actions.
- **Assessment Activities** — Plan and log assurance activities (interviews, document reviews, site visits).

### 5.3 Managing Findings
Each finding has:
- **Severity** (Low/Medium/High/Serious)
- **Description**
- **Linked Controls**
- **Actions** — remediation tasks with parties, target dates, and closure tracking.

### 5.4 Managing Actions
- Set **action party** (who is responsible).
- Set **target date** for completion.
- Track **extensions** and **closure approvals**.
- Add **action taken** notes and **file attachments**.

---

## 6. Knowledgebase & AI Assistant

### 6.1 Uploading Documents (Admin Page)
Go to **Admin → Knowledgebase**. Drag and drop .docx, .pdf, .md, .txt, or .csv files. They are automatically converted to Markdown and saved. Add optional remarks and select the target company.

### 6.2 Process Area Knowledgebase
From any Process Details page, the **Knowledgebase** tab shows documents scoped to that process area. Upload, view, and edit knowledge entries directly.

### 6.3 AI Chat Assistant
In the Knowledgebase tab's left panel, use the chatbox to ask questions about the process area. The AI:
- Has access to all knowledgebase documents for this PA AND SAMS001 global knowledge.
- Can suggest new controls based on identified gaps.
- Responses can be saved as new knowledge entries.

---

## 7. Admin Functions (Admin Only)

### 7.1 User Management
- **Add/Edit Users**: Manage usernames, passwords, roles, and company assignments.
- **Manage Roles**: Create role definitions and assign users to roles.
- **Manage Company**: Edit company details, manage user→company assignments.

### 7.2 Templates
- **Assessment Templates**: Create reusable assessment templates with pre-selected controls and activity types.
- **Adopt Templates**: Clone SAMS001 master data (standards, process areas, controls, requirements) to a new company.
- **Clean Templates**: Remove all template data from a company.

### 7.3 Knowledgebase Management
Upload, search, preview, and delete knowledgebase entries. Tree view grouped by company.

### 7.4 Requirements Management
- Tree view: Company → Standard → Process Area.
- Table: sortable columns with inline editing.
- Expand a requirement to see associated controls and edit all fields.

### 7.5 Database Tables
Browse all 45 database tables. Click any table to view, edit, add, or delete rows. Use with caution — direct database edits bypass application logic.

### 7.6 Badge Management
Create and manage achievement badges with emotional drives, rarity levels, and point requirements.

### 7.7 Mapping Activity Log
View all control↔requirement mapping changes with before/after JSON. Revert any mapping change.

---

## 8. Gamification

### 8.1 How Points Work
Points are earned through assessment activities, control testing, and completing actions. Different activity types award different base points, with bonuses for HSSE-critical controls and quality thresholds.

### 8.2 Badges
Badges are awarded automatically when you meet criteria (points thresholds, control check counts, daily streaks). View your badges on the Dashboard.

### 8.3 Leaderboard
The leaderboard shows top performers across your company. Your position is always visible, even if outside the top 3.

---

## 9. FAQ & Troubleshooting

### 9.1 Why don't I see my company's data?
Check the **Company Selector** dropdown in the top navigation bar. Make sure your company is selected.

### 9.2 What are "Unmapped Controls"?
Controls that haven't been assigned to a specific requirement yet. Each Process Area has its own Unmapped Controls bucket. You can drag controls from Unmapped Controls to any requirement.

### 9.3 How do I add a new control?
From a Process Area's **Requirements & Controls** tab, click "+ Add Control" within any requirement, or use the Bulk Map section at the bottom. The AI Chat Assistant can also suggest controls.

### 9.4 How do I change a control's requirement?
Drag and drop the control from one requirement to another in the Requirements & Controls tab.

### 9.5 How do I upload a document?
**Admin → Knowledgebase** for general uploads. For process-specific documents, use the **Knowledgebase** tab on any Process Details page.

### 9.6 The AI isn't working / API key error
The AI Chat Assistant requires a valid DeepSeek API key configured in the server environment. Contact your administrator.

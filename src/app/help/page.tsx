"use client";

import { useState } from "react";
import Image from "next/image";

type Section = {
  id: string;
  title: string;
  icon: string;
};

const sections: Section[] = [
  { id: "dashboard", title: "Dashboard", icon: "📊" },
  { id: "process-overview", title: "Process Overview", icon: "📋" },
  { id: "requirements", title: "Requirements & Controls", icon: "📝" },
  { id: "knowledgebase", title: "Knowledgebase & AI Chat", icon: "📚" },
  { id: "assessments", title: "Assessments", icon: "✅" },
  { id: "admin", title: "Admin Functions", icon: "⚙️" },
  { id: "gamification", title: "Gamification", icon: "🏆" },
  { id: "faq", title: "FAQ", icon: "❓" },
];

export default function HelpPage() {
  const [active, setActive] = useState("dashboard");

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left Sidebar */}
      <nav className="w-56 flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">📖 User Manual</h2>
        </div>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 ${
              active === s.id ? "bg-blue-50 text-blue-700 border-l-2 border-l-blue-500 font-medium" : "text-slate-600"
            }`}
          >
            <span>{s.icon}</span> {s.title}
          </button>
        ))}
      </nav>

      {/* Right Content */}
      <main className="flex-1 overflow-y-auto p-6 max-w-4xl">
        {active === "dashboard" && <DashboardSection />}
        {active === "process-overview" && <ProcessOverviewSection />}
        {active === "requirements" && <RequirementsSection />}
        {active === "knowledgebase" && <KnowledgebaseSection />}
        {active === "assessments" && <AssessmentsSection />}
        {active === "admin" && <AdminSection />}
        {active === "gamification" && <GamificationSection />}
        {active === "faq" && <FAQSection />}
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">{title}</h1>
      {children}
    </div>
  );
}

function HelpImage({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <div className="my-4 rounded-lg border border-slate-200 overflow-hidden">
      <Image src={src} alt={alt} width={800} height={450} className="w-full" />
      {caption && <p className="px-3 py-2 text-xs text-slate-500 bg-slate-50 border-t border-slate-200">{caption}</p>}
    </div>
  );
}

function DashboardSection() {
  return (
    <Section title="📊 Dashboard">
      <p className="text-sm text-slate-600 mb-4">
        The Dashboard is your home page. It shows process health across all standards, outstanding actions requiring attention, and your gamification progress.
      </p>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Standard Health</h3>
      <p className="text-sm text-slate-600 mb-3">
        Each standard shows a traffic-light indicator based on the average control health score of its process areas.
        Click a standard to expand and see individual process areas with their health percentages and control counts.
      </p>
      <ul className="text-sm text-slate-600 space-y-1 mb-3 ml-4 list-disc">
        <li>🟢 <strong>Healthy</strong> — Average control health above 80%</li>
        <li>🟡 <strong>Tolerable</strong> — Average between 50% and 80%</li>
        <li>🔴 <strong>Not Tolerable</strong> — Average below 50%</li>
      </ul>
      <HelpImage src="/help/dashboard-health.png" alt="Standard Health section" caption="Standard Health section showing process areas grouped by standard with health indicators." />

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Outstanding Actions</h3>
      <p className="text-sm text-slate-600 mb-3">
        The Outstanding Actions table lists all open actions from findings across your company. Click any row to view full details in a modal.
        You can sort columns and resize them. If you are the action party, auditee, or an admin, you can edit actions inline.
      </p>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Gamification Sidebar</h3>
      <p className="text-sm text-slate-600">
        The right sidebar shows your total points, badges earned, daily streak, and the Assurance Leaderboard with top performers.
      </p>
    </Section>
  );
}

function ProcessOverviewSection() {
  return (
    <Section title="📋 Process Overview">
      <p className="text-sm text-slate-600 mb-4">
        Each Process Area has a detail page with four tabs. The Process Overview tab gives you a quick summary.
      </p>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Stats Cards</h3>
      <p className="text-sm text-slate-600 mb-3">
        Four cards at the top show: Effective Controls, Assessments Completed, Total Findings, and Open Actions.
      </p>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Process Health</h3>
      <p className="text-sm text-slate-600 mb-3">
        Three columns show control effectiveness, assessment activity, and sample testing results as percentage bars.
        On mobile, these stack vertically for easier reading.
      </p>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Requirements Summary</h3>
      <p className="text-sm text-slate-600 mb-3">
        Cards for each requirement in this process area, ordered as: Requirement ID → Health Score → Clause Content.
        Cards stack full-width on mobile.
      </p>
      <HelpImage src="/help/process-overview.png" alt="Process Overview tab" caption="Process Overview tab showing stats, health charts, and requirements summary." />
    </Section>
  );
}

function RequirementsSection() {
  return (
    <Section title="📝 Requirements & Controls">
      <p className="text-sm text-slate-600 mb-4">
        This tab shows all requirements for the process area with their linked controls. It's the main workspace for managing control-to-requirement mappings.
      </p>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Requirement Cards</h3>
      <p className="text-sm text-slate-600 mb-3">
        Each card shows the requirement ID, number of linked controls in parentheses, and a preview of the clause content.
        Click a card to expand it and see the controls table.
      </p>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Drag-and-Drop Re-mapping</h3>
      <p className="text-sm text-slate-600 mb-3">
        You can drag a control from one requirement to another. Each control row has a drag handle (⋮⋮).
        Drop it onto any requirement card to re-map it.
      </p>
      <HelpImage src="/help/requirements-controls.png" alt="Requirements & Controls tab" caption="Requirements & Controls tab with expandable cards, drag-and-drop, and Unmapped Controls." />

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Unmapped Controls</h3>
      <p className="text-sm text-slate-600 mb-3">
        Each Process Area has an "Unmapped Controls" requirement — a holding bucket for controls not yet assigned to a specific requirement.
        Controls appear here automatically based on their sub-process linkage. You can drag them from Unmapped Controls to any requirement.
      </p>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Bulk Map Controls</h3>
      <p className="text-sm text-slate-600 mb-3">
        Expand the "Bulk Map Controls to Requirements" section at the bottom. Select a Process Area, then a Sub-Process,
        check the controls you want to map, choose a target requirement, and click "Map N Control(s)".
      </p>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Adding Controls</h3>
      <p className="text-sm text-slate-600">
        Click "+ Add Control" inside any expanded requirement to create a new control and automatically link it to that requirement.
        Or use the AI Chat Assistant in the Knowledgebase tab to get control suggestions.
      </p>
    </Section>
  );
}

function KnowledgebaseSection() {
  return (
    <Section title="📚 Knowledgebase & AI Chat">
      <p className="text-sm text-slate-600 mb-4">
        The Knowledgebase tab lets you upload, view, and edit documents for this process area.
        It also includes an AI Chat Assistant that can answer questions and suggest controls.
      </p>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Two-Panel Layout</h3>
      <p className="text-sm text-slate-600 mb-3">
        <strong>Left Panel:</strong> Knowledge entry tree (top) + AI Chat Assistant (bottom).<br />
        <strong>Right Panel:</strong> Document content viewer with edit mode for owners and admins.
      </p>
      <HelpImage src="/help/knowledgebase-chat.png" alt="Knowledgebase tab with AI Chat" caption="Knowledgebase tab showing entry tree, AI Chat Assistant, and document viewer." />

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Uploading Documents</h3>
      <p className="text-sm text-slate-600 mb-3">
        Click "＋ Add Knowledge" in the left panel. Drag and drop a file (.docx, .pdf, .md, .txt, .csv) or click "Browse Files".
        The file is automatically converted to Markdown and saved to this process area's knowledgebase.
        Add optional remarks before uploading.
      </p>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">AI Chat Assistant</h3>
      <p className="text-sm text-slate-600 mb-3">
        Type a question in the chat input at the bottom of the left panel and press Enter. The AI has context from all knowledgebase
        documents in this process area AND SAMS001 global knowledge.
      </p>
      <ul className="text-sm text-slate-600 space-y-1 mb-3 ml-4 list-disc">
        <li><strong>Control Suggestions:</strong> The AI may suggest new controls. Click "✓ Approve" to add them to the database.</li>
        <li><strong>Save Responses:</strong> Click "💾 Save to Knowledgebase" under any AI response to store it as a knowledge entry.</li>
      </ul>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Admin Knowledgebase</h3>
      <p className="text-sm text-slate-600">
        Go to <strong>Admin → Knowledgebase</strong> for a company-wide view of all knowledge entries.
        Upload documents, search, preview, and download as .md files. The company selector determines which company the document belongs to.
      </p>
    </Section>
  );
}

function AssessmentsSection() {
  return (
    <Section title="✅ Assessments">
      <p className="text-sm text-slate-600 mb-4">
        Assessments are planned reviews of controls that produce findings and actions. You can create them from any Process Area's Assessments tab.
      </p>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Creating an Assessment</h3>
      <p className="text-sm text-slate-600 mb-3">
        Click "+ Add Assessment", give it a name, select a start date, choose which controls to include, and submit.
        The new assessment appears in the list and you can click "View" to open it.
      </p>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Assessment Detail Tabs</h3>
      <ul className="text-sm text-slate-600 space-y-1 mb-3 ml-4 list-disc">
        <li><strong>Overview:</strong> Assessment details, status, dates, linked controls.</li>
        <li><strong>Control Assignment:</strong> Map controls and track effectiveness (Effective / Not Effective).</li>
        <li><strong>Sample Selection:</strong> Create and manage test samples with status tracking.</li>
        <li><strong>Findings & Actions:</strong> Record findings with severity levels and assign remediation actions with target dates and parties.</li>
        <li><strong>Assessment Activities:</strong> Log interviews, document reviews, and site visits.</li>
      </ul>
      <HelpImage src="/help/assessment-detail.png" alt="Assessment detail" caption="Assessment detail page with Findings & Actions tab." />

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Managing Findings</h3>
      <p className="text-sm text-slate-600 mb-3">
        Each finding has a severity (Low/Medium/High/Serious), description, and linked controls.
        Add actions to each finding — set the responsible party, target date, and track closure.
      </p>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">File Attachments</h3>
      <p className="text-sm text-slate-600">
        Actions support file attachments. Upload evidence, screenshots, or documents directly to any action.
      </p>
    </Section>
  );
}

function AdminSection() {
  return (
    <Section title="⚙️ Admin Functions">
      <p className="text-sm text-slate-600 mb-4">
        The Admin page is accessible only to users with the Admin role. It provides full control over users, templates, knowledgebase, requirements, and the database.
      </p>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">User Management</h3>
      <p className="text-sm text-slate-600 mb-3">
        Add and edit users, assign roles (Admin/Assessor), set positions, and manage company assignments.
        The "Manage Roles" section lets you create role definitions and map users to roles.
      </p>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Templates</h3>
      <p className="text-sm text-slate-600 mb-3">
        Create assessment templates with pre-selected controls. Use "Adopt Templates" to clone SAMS001 master data
        (standards, process areas, controls, requirements) into a new company. "Clean Templates" removes all template data.
      </p>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Requirements Management</h3>
      <p className="text-sm text-slate-600 mb-3">
        A tree view organized as Company → Standard → Process Area. Click any Process Area to see its requirements in a sortable table.
        Expand a row to edit all fields inline, including clause content, intent/outcome, and applicability.
      </p>
      <HelpImage src="/help/admin-requirements.png" alt="Admin Requirements" caption="Admin Requirements manager with Company→Standard→PA tree and inline editor." />

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Database Tables</h3>
      <p className="text-sm text-slate-600 mb-3">
        Browse all 45 database tables. Click any table to view, edit, add, or delete rows.
        <strong>Use with caution</strong> — direct database edits bypass application logic and validation.
      </p>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Mapping Activity Log</h3>
      <p className="text-sm text-slate-600">
        View all control↔requirement mapping changes with before/after JSON diffs. You can revert any mapping change.
      </p>
    </Section>
  );
}

function GamificationSection() {
  return (
    <Section title="🏆 Gamification">
      <p className="text-sm text-slate-600 mb-4">
        CONAN PROJECT uses gamification to encourage thorough control testing and timely action completion.
      </p>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">How Points Work</h3>
      <p className="text-sm text-slate-600 mb-3">
        Points are earned through assessment activities, control testing, and completing actions.
        Different activity types award different base points, with bonuses for:
      </p>
      <ul className="text-sm text-slate-600 space-y-1 mb-3 ml-4 list-disc">
        <li><strong>HSSE-Critical Controls:</strong> Extra points for testing safety-critical controls.</li>
        <li><strong>Quality Thresholds:</strong> Bonus points when sample testing meets quality standards.</li>
        <li><strong>Per-Control Points:</strong> Points scale with the number of controls tested.</li>
      </ul>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Badges</h3>
      <p className="text-sm text-slate-600 mb-3">
        Badges are awarded automatically based on criteria like points thresholds, control check counts, and daily streaks.
        Each badge is tied to one of 8 emotional drives (e.g., Accomplishment, Ownership, Social Influence).
      </p>

      <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Leaderboard</h3>
      <p className="text-sm text-slate-600">
        The leaderboard on the Dashboard shows top performers across your company. Your position is always visible,
        even if outside the top 3. Admin users are excluded from the leaderboard.
      </p>
    </Section>
  );
}

function FAQSection() {
  return (
    <Section title="❓ Frequently Asked Questions">
      <div className="space-y-6">
        <FaqItem
          q="Why don't I see my company's data?"
          a='Check the Company Selector dropdown in the top navigation bar. Make sure your company is selected. If you only have access to one company, it is selected automatically.'
        />
        <FaqItem
          q="What are Unmapped Controls?"
          a="Controls that haven't been assigned to a specific requirement yet. Each Process Area has its own Unmapped Controls bucket. Drag controls from Unmapped Controls to any requirement to assign them."
        />
        <FaqItem
          q="How do I add a new control?"
          a="From a Process Area's Requirements &amp; Controls tab, click &quot;+ Add Control&quot; inside any expanded requirement, or use the Bulk Map section. The AI Chat Assistant can also suggest controls."
        />
        <FaqItem
          q="How do I change a control's requirement?"
          a="Drag and drop the control from one requirement card to another in the Requirements & Controls tab. Each control row has a drag handle (⋮⋮)."
        />
        <FaqItem
          q="How do I upload a document?"
          a="Go to Admin → Knowledgebase for general uploads. For process-specific documents, use the Knowledgebase tab on any Process Details page. Supported formats: .docx, .pdf, .md, .txt, .csv."
        />
        <FaqItem
          q="How do I create a new assessment?"
          a="Navigate to a Process Area, click the Assessments tab, then click '+ Add Assessment'. Give it a name, select controls, and submit."
        />
        <FaqItem
          q="How does control health scoring work?"
          a="Control health is calculated as (Effective assignments / Total assignments) × 100 over the last 90 days. It updates automatically when effectiveness changes."
        />
        <FaqItem
          q="What does the company selector do?"
          a="It filters all views to show only data belonging to the selected company. Controls, process areas, requirements, assessments, and knowledge entries are all company-scoped."
        />
        <FaqItem
          q="Can I edit a knowledgebase entry?"
          a="Yes — if you are the original uploader or an Admin, the Knowledgebase viewer shows an editable text area with a Save button."
        />
      </div>
    </Section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-800">{q}</h3>
      <p className="text-sm text-slate-600 mt-1">{a}</p>
    </div>
  );
}

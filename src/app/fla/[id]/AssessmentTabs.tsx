'use client';

import { useState } from 'react';
import AssessmentInfoForm from './AssessmentInfoForm';
import ControlsSelectorWrapper from './ControlsSelectorWrapper';
import AssignedControlsTable from './AssignedControlsTable';
import SamplesTable from './SamplesTable';
import FindingsTable, { Finding, FindingsTableHandle } from './FindingsTable';
import { useRef } from 'react';

const TABS = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'controls', label: 'Control Assignment', icon: '⚙️' },
  { id: 'samples', label: 'Sample Selection', icon: '🔬' },
  { id: 'findings', label: 'Finding and Actions', icon: '🔍' },
  { id: 'activities', label: 'Assessment Activities', icon: '📅' },
] as const;

type TabId = typeof TABS[number]['id'];

interface Props {
  assessment: any;
  users: any[];
  activityTypes: any[];
  loaOptions: { value: string; label: string }[];
  statusOptions: string[];
  assignedControlIds: Set<string>;
  assignmentsKey: string;
  availableControls: any[];
  assignedControls: { id: string; name: string }[];
  samples: any[];
  findings: any[];
}

export default function AssessmentTabs({
  assessment,
  users,
  activityTypes,
  loaOptions,
  statusOptions,
  assignedControlIds,
  assignmentsKey,
  availableControls,
  assignedControls,
  samples,
  findings,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const findingsRef = useRef<FindingsTableHandle>(null);

  return (
    <div className="flex h-[calc(100vh-140px)] gap-0">
      {/* LEFT: Menu */}
      <div className="w-52 flex-shrink-0 rounded-l-lg border border-slate-200 bg-white flex flex-col">
        <div className="px-3 py-2.5 border-b border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assessment</div>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 border-l-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-l-blue-500 bg-blue-50 font-medium text-blue-700'
                  : 'border-l-transparent text-slate-600'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT: Content */}
      <div className="flex-1 rounded-r-lg border border-l-0 border-slate-200 bg-white overflow-y-auto">
        {activeTab === 'overview' && (
          <div>
            <div className="px-4 py-2.5 border-b border-slate-200">
              <span className="font-semibold text-slate-900 text-sm">📋 Overview</span>
            </div>
            <div className="p-4">
              <AssessmentInfoForm
                assessment={assessment}
                users={users}
                activityTypes={activityTypes}
                loaOptions={loaOptions}
                statusOptions={statusOptions}
              />
            </div>
          </div>
        )}

        {activeTab === 'controls' && (
          <div>
            <div className="px-4 py-2.5 border-b border-slate-200">
              <span className="font-semibold text-slate-900 text-sm">⚙️ Control Assignment</span>
            </div>
            <div className="p-4 space-y-4">
              <ControlsSelectorWrapper
                assessmentId={assessment.id}
                initialSelectedIds={Array.from(assignedControlIds)}
              />
              <AssignedControlsTable
                key={assignmentsKey}
                initialAssignments={assessment.controlAssignments}
              />
            </div>
          </div>
        )}

        {activeTab === 'samples' && (
          <div>
            <div className="px-4 py-2.5 border-b border-slate-200">
              <span className="font-semibold text-slate-900 text-sm">🔬 Sample Selection</span>
            </div>
            <div className="p-4">
              <SamplesTable
                assessmentId={assessment.id}
                initialSamples={samples}
                availableControls={availableControls}
                onAddFinding={(sampleId) => findingsRef.current?.openAddModal(sampleId)}
              />
            </div>
          </div>
        )}

        {activeTab === 'findings' && (
          <div>
            <div className="px-4 py-2.5 border-b border-slate-200">
              <span className="font-semibold text-slate-900 text-sm">🔍 Finding and Actions</span>
            </div>
            <div className="p-4">
              <FindingsTable
                ref={findingsRef}
                assessmentId={assessment.id}
                initialFindings={findings}
                assignedControls={assignedControls}
                samples={samples}
              />
            </div>
          </div>
        )}

        {activeTab === 'activities' && (
          <div>
            <div className="px-4 py-2.5 border-b border-slate-200">
              <span className="font-semibold text-slate-900 text-sm">📅 Assessment Activities</span>
            </div>
            <div className="p-4">
              <div className="text-sm text-slate-400 italic p-8 text-center">
                Assessment activities will be available here. Use this section to track interviews, document reviews, and site visits linked to this assessment.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

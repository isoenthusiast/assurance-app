'use client';

import { useRef } from 'react';
import SamplesTable from './SamplesTable';
import FindingsTable, { Finding, FindingsTableHandle } from './FindingsTable';

interface SampleType {
  id: string;
  name: string;
}

interface RecordSource {
  id: string;
  name: string;
}

interface Control {
  id: string;
  name: string;
  processArea: { name: string };
  subProcess?: { name: string } | null;
}

interface Sample {
  id: string;
  sampleTypeId: string | null;
  recordSourceId: string | null;
  recordReference: string | null;
  controlEffective: boolean;
  status: string;
  comment?: string | null;
  sampleType?: SampleType | null;
  recordSource?: RecordSource | null;
}

interface AssignedControl {
  id: string;
  name: string;
}

/**
 * Renders the Samples table and the Findings table together, and wires up
 * the per-sample "+ Finding" shortcut: clicking it opens the Findings "Add
 * Finding" modal pre-selected with that sample, via an imperative handle on
 * FindingsTable.
 */
export default function EvidenceSection({
  assessmentId,
  samples,
  availableControls,
  initialFindings,
  assignedControls,
}: {
  assessmentId: string;
  samples: Sample[];
  availableControls?: Control[];
  initialFindings: Finding[];
  assignedControls: AssignedControl[];
}) {
  const findingsRef = useRef<FindingsTableHandle>(null);

  return (
    <>
      <div className="mt-8">
        <SamplesTable
          assessmentId={assessmentId}
          initialSamples={samples}
          availableControls={availableControls}
          onAddFinding={(sampleId) => findingsRef.current?.openAddModal(sampleId)}
        />
      </div>

      <div className="mt-8">
        <FindingsTable
          ref={findingsRef}
          assessmentId={assessmentId}
          initialFindings={initialFindings}
          assignedControls={assignedControls}
          samples={samples}
        />
      </div>
    </>
  );
}

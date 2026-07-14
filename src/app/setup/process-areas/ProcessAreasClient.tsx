"use client";

import { useState } from "react";
import ProcessAreasTable from "./ProcessAreasTable";
import ProcessAreaForm from "./ProcessAreaForm";
import SubProcessQuickAddForm from "./SubProcessQuickAddForm";

type ProcessArea = {
  id: string;
  name: string;
  description: string | null;
  pId?: string | null;
  standard?: string | null;
  _count: { subProcesses: number; controls: number; requirements: number };
};

type AssessmentSummary = {
  id: string;
  name: string;
  endDate: string | Date | null;
  status: string;
  findingsCount: number;
  actionsCount: number;
};

type SubProcess = {
  id: string;
  name: string;
  description: string | null;
  processAreaId: string;
  _count: { controlSubProcesses: number };
  assessmentCount: number;
  assessments: AssessmentSummary[];
};

type ControlSummary = {
  id: string;
  name: string;
  controlType: string;
  controlRef: string | null;
  isHsseCritical: boolean;
  ramRating: string | null;
  rawHealthScore: number;
  lastTestedDate: string | Date | null;
  lastTestResult: string | null;
  _count: { controlAssignments: number };
};

type Requirement = {
  rId: number;
  requirementId: string;
  clauseContent: string;
  intentOutcome: string;
  clauseApplicability: string;
  references: string | null;
  applicable: boolean;
  standard: string;
  pId: string;
  processAreaId: string | null;
  _count: { controlMappings: number };
  controlMappings: { control: ControlSummary }[];
};

type Editing = {
  id: string;
  name: string;
  description: string | null;
  standard?: string | null;
  pId?: string | null;
} | null;

export default function ProcessAreasClient({
  areas,
  standards,
  deleteAction,
  subProcesses,
  requirements,
  deleteSubProcessAction,
  editing,
  isAdmin,
}: {
  areas: ProcessArea[];
  standards: string[];
  deleteAction: (id: string) => Promise<void>;
  subProcesses: SubProcess[];
  requirements: Requirement[];
  deleteSubProcessAction: (id: string) => Promise<void>;
  editing: Editing;
  isAdmin: boolean;
}) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addDefaultStandard, setAddDefaultStandard] = useState("");
  const [subProcessTarget, setSubProcessTarget] = useState<{ id: string; name: string } | null>(
    null
  );

  return (
    <>
      <ProcessAreasTable
        areas={areas}
        standards={standards}
        deleteAction={deleteAction}
        subProcesses={subProcesses}
        requirements={requirements}
        deleteSubProcessAction={deleteSubProcessAction}
        isAdmin={isAdmin}
        onAddClick={(defaultStandard) => {
          setAddDefaultStandard(defaultStandard);
          setIsAddOpen(true);
        }}
        onAddSubProcessClick={(id, name) => setSubProcessTarget({ id, name })}
      />

      <ProcessAreaForm
        editing={editing}
        standards={standards}
        defaultStandard={addDefaultStandard}
        isOpen={isAddOpen || Boolean(editing)}
        onClose={() => setIsAddOpen(false)}
      />

      {subProcessTarget && (
        <SubProcessQuickAddForm
          processAreaId={subProcessTarget.id}
          processAreaName={subProcessTarget.name}
          onClose={() => setSubProcessTarget(null)}
        />
      )}
    </>
  );
}

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
  _count: { subProcesses: number; controls: number };
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
  _count: { controls: number };
  assessmentCount: number;
  assessments: AssessmentSummary[];
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
  deleteSubProcessAction,
  editing,
}: {
  areas: ProcessArea[];
  standards: string[];
  deleteAction: (id: string) => Promise<void>;
  subProcesses: SubProcess[];
  deleteSubProcessAction: (id: string) => Promise<void>;
  editing: Editing;
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
        deleteSubProcessAction={deleteSubProcessAction}
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

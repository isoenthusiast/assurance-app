"use client";

import { useState } from "react";
import ActivityTypesTable from "./ActivityTypesTable";
import ActivityTypeForm from "./ActivityTypeForm";

type ActivityType = {
  id: string;
  name: string;
  defaultLOA: string;
  description: string | null;
  _count: { assessments: number };
};

type EditingActivityType = {
  id: string;
  name: string;
  defaultLOA: string;
  description: string | null;
} | null;

type LOAOption = {
  value: string;
  label: string;
};

export default function ActivityTypesClient({
  types,
  editing,
  loaOptions,
  deleteAction,
}: {
  types: ActivityType[];
  editing: EditingActivityType;
  loaOptions: LOAOption[];
  deleteAction: (id: string) => Promise<void>;
}) {
  const [isAddOpen, setIsAddOpen] = useState(false);

  return (
    <>
      <ActivityTypesTable
        types={types}
        loaOptions={loaOptions}
        deleteAction={deleteAction}
        onAddClick={() => setIsAddOpen(true)}
      />

      <ActivityTypeForm
        editing={editing}
        loaOptions={loaOptions}
        isOpen={isAddOpen || Boolean(editing)}
        onClose={() => setIsAddOpen(false)}
      />
    </>
  );
}

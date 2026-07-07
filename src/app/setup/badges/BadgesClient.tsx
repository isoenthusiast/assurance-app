"use client";

import { useState } from "react";
import BadgesTable from "./BadgesTable";
import BadgeForm from "./BadgeForm";

type Badge = {
  id: string;
  badgeName: string;
  description: string;
  icon: string;
  badgeImage: string | null;
  emotionalDrive: string;
  rarity: string;
  pointsRequired: number | null;
  controlsChecked: number | null;
  streakDays: number | null;
  achievementType: string;
  createdAt: Date;
};

export default function BadgesClient({
  badges,
  editing,
  deleteAction,
}: {
  badges: Badge[];
  editing: Badge | null;
  deleteAction: (id: string) => Promise<void>;
}) {
  const [isAddOpen, setIsAddOpen] = useState(false);

  return (
    <>
      <BadgesTable
        badges={badges}
        deleteAction={deleteAction}
        onAddClick={() => setIsAddOpen(true)}
      />

      <BadgeForm
        editing={editing}
        isOpen={isAddOpen || Boolean(editing)}
        onClose={() => setIsAddOpen(false)}
      />
    </>
  );
}

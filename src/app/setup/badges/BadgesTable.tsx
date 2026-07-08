"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DeleteButton from "@/components/DeleteButton";

type Badge = {
  id: string;
  badgeName: string;
  description: string;
  icon: string;
  badgeImage: string | null;
  emotionalDrive: string;
  rarity: string;
  level: string | null;
  processAreaId: string | null;
  processArea?: { name: string; standard: string | null } | null;
  pointsRequired: number | null;
  controlsChecked: number | null;
  streakDays: number | null;
  achievementType: string;
  createdAt: Date;
};

const RARITY_COLORS: Record<string, string> = {
  Common: "bg-slate-100 text-slate-700",
  Uncommon: "bg-green-100 text-green-700",
  Rare: "bg-blue-100 text-blue-700",
  Epic: "bg-purple-100 text-purple-700",
  Legendary: "bg-amber-100 text-amber-700",
};

const LEVEL_COLORS: Record<string, string> = {
  Bronze: "bg-amber-100 text-amber-700",
  Silver: "bg-slate-200 text-slate-700",
  Gold: "bg-yellow-100 text-yellow-700",
  Platinum: "bg-cyan-100 text-cyan-700",
  Black: "bg-slate-800 text-white",
};

const ITEMS_PER_PAGE_OPTIONS = [5, 10, 30, 100];

export default function BadgesTable({
  badges,
  deleteAction,
  onAddClick,
}: {
  badges: Badge[];
  deleteAction: (id: string) => Promise<void>;
  onAddClick: () => void;
}) {
  const [sortKey, setSortKey] = useState<keyof Badge>("badgeName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const router = useRouter();

  const handleClearAll = async () => {
    if (!confirm(`Delete ALL ${badges.length} badges? This cannot be undone.`)) return;
    setClearing(true);
    try {
      await fetch("/api/admin/badges/clear", { method: "POST" });
      router.refresh();
    } finally {
      setClearing(false);
    }
  };

  const handleGenerate = async () => {
    if (!confirm("Generate 5 badges (Bronze→Black) for every Process Area? Existing badges will be skipped.")) return;
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await fetch("/api/admin/badges/generate", { method: "POST" });
      const data = await res.json();
      setGenResult(`Created ${data.created}, skipped ${data.skipped} existing of ${data.total} total`);
      router.refresh();
    } catch {
      setGenResult("Failed to generate badges");
    } finally {
      setGenerating(false);
    }
  };

  const sorted = [...badges].sort((a, b) => {
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    const cmp = String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const paged = sorted.slice(page * perPage, (page + 1) * perPage);

  const toggleSort = (key: keyof Badge) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  };

  const sortIcon = (key: keyof Badge) => {
    if (sortKey !== key) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onAddClick}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            + Add Badge
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {generating ? "⏳ Generating…" : "🔍 Generate Process Badges"}
          </button>
          {badges.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearing}
              className="rounded border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {clearing ? "Clearing…" : "Clear All"}
            </button>
          )}
          {genResult && <span className="text-xs text-slate-500">{genResult}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Show</span>
          <select
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(0); }}
            className="rounded border border-slate-300 px-1 py-0.5 text-xs"
          >
            {ITEMS_PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n === total && total > 100 ? "All" : n}</option>
            ))}
            {!ITEMS_PER_PAGE_OPTIONS.includes(total) && <option value={total}>All ({total})</option>}
          </select>
          <span>entries</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-600" onClick={() => toggleSort("icon")}>
                Icon{sortIcon("icon")}
              </th>
              <th className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-600" onClick={() => toggleSort("badgeName")}>
                Badge Name{sortIcon("badgeName")}
              </th>
              <th className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-600" onClick={() => toggleSort("emotionalDrive")}>
                Drive{sortIcon("emotionalDrive")}
              </th>
              <th className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-600" onClick={() => toggleSort("rarity")}>
                Rarity{sortIcon("rarity")}
              </th>
              <th className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-600" onClick={() => toggleSort("level" as any)}>
                Level{sortIcon("level" as any)}
              </th>
              <th className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-600">
                Process Area
              </th>
              <th className="px-3 py-2 text-xs font-medium text-slate-600">
                Standard
              </th>
              <th className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-600" onClick={() => toggleSort("achievementType")}>
                Type{sortIcon("achievementType")}
              </th>
              <th className="px-3 py-2 text-xs font-medium text-slate-600">Image</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((b) => (
              <tr key={b.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 text-lg" title={b.description}>{b.icon}</td>
                <td className="px-3 py-2 font-medium text-slate-900" title={b.description}>{b.badgeName}</td>
                <td className="px-3 py-2 text-slate-600">{b.emotionalDrive}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${RARITY_COLORS[b.rarity] || "bg-slate-100 text-slate-700"}`}>
                    {b.rarity}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {b.level ? (
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_COLORS[b.level] || "bg-slate-100 text-slate-700"}`}>
                      {b.level}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600 text-xs">
                  {b.processArea ? b.processArea.name : "—"}
                </td>
                <td className="px-3 py-2 text-slate-600 text-xs">
                  {b.processArea?.standard || "—"}
                </td>
                <td className="px-3 py-2 text-slate-600">{b.achievementType}</td>
                <td className="px-3 py-2">
                  {b.badgeImage ? (
                    <img src={b.badgeImage} alt={b.badgeName} className="h-8 w-8 rounded object-cover" />
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/setup/badges?edit=${b.id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteButton action={deleteAction.bind(null, b.id)} />
                  </div>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-slate-400">
                  No badges found. Click "+ Add Badge" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {page * perPage + 1}–{Math.min((page + 1) * perPage, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="rounded border px-2 py-0.5 disabled:opacity-30"
            >
              First
            </button>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded border px-2 py-0.5 disabled:opacity-30"
            >
              Prev
            </button>
            <span className="px-2">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded border px-2 py-0.5 disabled:opacity-30"
            >
              Next
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="rounded border px-2 py-0.5 disabled:opacity-30"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

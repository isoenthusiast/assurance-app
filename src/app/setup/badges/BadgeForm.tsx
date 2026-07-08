"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

const EMOJI_CATEGORIES = [
  {
    name: "Trophies",
    emojis: ["🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "👑", "💍", "🔱", "🎪", "🏟️", "🎗️"],
  },
  {
    name: "Stars",
    emojis: ["⭐", "🌟", "💫", "✨", "🌠", "🔆", "💥", "🎇", "🎆", "☀️", "🔥", "🌈"],
  },
  {
    name: "Medals",
    emojis: ["🎯", "✅", "✔️", "☑️", "🏁", "🏷️", "🔰", "💮", "🉐", "㊗️", "🈴", "🪪"],
  },
  {
    name: "Gems",
    emojis: ["💎", "🔮", "💠", "🪩", "🔷", "🔶", "🟣", "🟦", "🟩", "🟨", "🟧", "🟥"],
  },
  {
    name: "Shields",
    emojis: ["🛡️", "🔒", "🔐", "🗝️", "⚔️", "🗡️", "🏹", "💂", "⛓️", "🔗", "🧲", "🏰"],
  },
  {
    name: "Growth",
    emojis: ["🌱", "🌿", "🌳", "🌻", "🌸", "📈", "📊", "🧠", "💡", "🔬", "🔭", "🧬"],
  },
  {
    name: "Rockets",
    emojis: ["🚀", "🛸", "✈️", "🌍", "🌎", "🌏", "⚡", "💨", "🌀", "🎢", "⏫", "🆙"],
  },
  {
    name: "People",
    emojis: ["🤝", "👥", "🙌", "👏", "💪", "🦾", "🧑‍🏫", "👨‍💼", "👷", "🦸", "🧑‍🔬", "👨‍🔧"],
  },
  {
    name: "Tools",
    emojis: ["📋", "📝", "✏️", "🖊️", "📌", "📎", "📐", "📏", "🗂️", "📁", "📓", "🔍"],
  },
  {
    name: "Hearts",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🤍", "🖤", "💖", "💝", "💘", "💕"],
  },
  {
    name: "Flags",
    emojis: ["🚩", "🏳️", "🏴", "🎌", "🏁", "⛳", "📍", "📌", "🔖", "📑", "🗞️", "📰"],
  },
  {
    name: "Fun",
    emojis: ["🎨", "🎵", "🎭", "🎉", "🎊", "🎈", "🔔", "📯", "🎺", "🥁", "🎸", "🎪"],
  },
  {
    name: "Process",
    emojis: [
      "🌬️", "🦋", "♻️", "⚡", "📦", "🤲", "🏞️", "🗑️", "💧",
      "🔄", "👷", "🚨", "🏢", "📊", "🤝", "📚", "🔀", "⚠️",
      "📈", "📋", "🏗️", "✅", "💻", "✏️", "🛡️", "✔️", "🔒",
      "🎯", "📅", "🔧", "🏚️", "📆", "🚛", "🔍", "🔐", "🛢️",
      "🪛", "🔁", "📐", "🚗", "⛴️", "🏛️", "🎉", "⛑️", "🎛️",
      "🤿", "🔌", "⛏️", "😴", "🏃", "☣️", "🔥", "🧠", "☢️",
      "🏋️", "🦺", "🚧", "🛂", "👥", "🪜",
    ],
  },
];

const PREDEFINED_ACHIEVEMENT_TYPES = [
  "first_fla", "first_test", "perfect_assessment",
  "diversity_explorer", "weekly_diversity",
  "team_player", "community_champion",
  "quality_leader", "milestone_master",
  "perfect_week", "excellence_seeker",
  "learner", "growth_trajectory",
  "mentor", "org_builder",
  "safety_focused", "compliance_leader",
  "process_assurance", "hse_excellence",
  "audit_champion", "continuous_improvement",
];

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
  pointsRequired: number | null;
  controlsChecked: number | null;
  streakDays: number | null;
  achievementType: string;
};

const LEVELS = [
  { value: "Bronze", label: "Bronze", color: "bg-amber-100 text-amber-700", tip: "Starting level — process activation initiated" },
  { value: "Silver", label: "Silver", color: "bg-slate-200 text-slate-700", tip: "Missions performed with XP in the process attribute" },
  { value: "Gold", label: "Gold", color: "bg-yellow-100 text-yellow-700", tip: "Demonstrated mastery and consistent delivery" },
  { value: "Platinum", label: "Platinum", color: "bg-cyan-100 text-cyan-700", tip: "Elite performance with measurable impact" },
  { value: "Black", label: "Black", color: "bg-slate-800 text-white", tip: "The highest tier — legendary process excellence" },
];

const EMOTIONAL_DRIVES = [
  { value: "Diversity", label: "Diversity", emoji: "🎨", tip: "Drive for new experiences and variety" },
  { value: "Belonging", label: "Belonging", emoji: "👥", tip: "Drive to connect with people and community" },
  { value: "Recognition", label: "Recognition", emoji: "⭐", tip: "Drive to feel valued and acknowledged" },
  { value: "Achievement", label: "Achievement", emoji: "✅", tip: "Drive to complete goals and progress" },
  { value: "Excellence", label: "Excellence", emoji: "💎", tip: "Drive to exceed expectations and standards" },
  { value: "Growth", label: "Growth", emoji: "📈", tip: "Drive to improve oneself and learn" },
  { value: "Contribution", label: "Contribution", emoji: "🤝", tip: "Drive to serve a purpose beyond self" },
  { value: "Security", label: "Security", emoji: "🛡️", tip: "Drive for safety, stability and control" },
];

const RARITIES = [
  { value: "Common", label: "Common", color: "bg-slate-100", tip: "Easy to earn — everyday achievements" },
  { value: "Uncommon", label: "Uncommon", color: "bg-green-100", tip: "Requires some effort across multiple activities" },
  { value: "Rare", label: "Rare", color: "bg-blue-100", tip: "Significant effort over time or across teams" },
  { value: "Epic", label: "Epic", color: "bg-purple-100", tip: "Major accomplishment with sustained excellence" },
  { value: "Legendary", label: "Legendary", color: "bg-amber-100", tip: "Exceptional — the highest tier of achievement" },
];

type ProcessArea = {
  id: string;
  name: string;
  standard: string | null;
};

export default function BadgeForm({
  editing,
  isOpen,
  onClose,
  processAreas,
}: {
  editing: Badge | null;
  isOpen: boolean;
  onClose: () => void;
  processAreas: ProcessArea[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(editing?.badgeImage ?? null);
  const [removeImage, setRemoveImage] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState(editing?.icon ?? "🏆");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState(0);
  const [achTypeQuery, setAchTypeQuery] = useState(editing?.achievementType ?? "");
  const [achTypeOpen, setAchTypeOpen] = useState(false);
  const achTypeRef = useRef<HTMLDivElement>(null);

  // Close achievement type dropdown on click outside
  useEffect(() => {
    if (!achTypeOpen) return;
    const handler = (e: MouseEvent) => {
      if (achTypeRef.current && !achTypeRef.current.contains(e.target as Node)) {
        setAchTypeOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [achTypeOpen]);

  const filteredAchTypes = PREDEFINED_ACHIEVEMENT_TYPES.filter(t =>
    t.toLowerCase().includes(achTypeQuery.toLowerCase())
  );

  // Close emoji picker on click outside
  useEffect(() => {
    if (!emojiOpen) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setEmojiOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [emojiOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const id = formData.get("id")?.toString();

    if (removeImage) {
      formData.set("removeImage", "true");
    }

    if (id) {
      await fetch(`/api/admin/badges/${id}`, {
        method: "PUT",
        body: formData,
      });
    } else {
      await fetch("/api/admin/badges", {
        method: "POST",
        body: formData,
      });
    }

    router.refresh();
    router.push("/setup/badges");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
      setRemoveImage(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget && !editing) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="my-8 w-full max-w-lg space-y-3 rounded border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-900">
            {editing ? "Edit Badge" : "Add Badge"}
          </h2>
          {editing ? (
            <Link href="/setup/badges" className="text-xl leading-none text-slate-400 hover:text-slate-600" aria-label="Close">×</Link>
          ) : (
            <button type="button" onClick={onClose} className="text-xl leading-none text-slate-400 hover:text-slate-600" aria-label="Close">×</button>
          )}
        </div>
        {editing && <input type="hidden" name="id" value={editing.id} />}

        {/* Badge Name */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700" title="Display name of the badge shown to users">
            Badge Name <span className="text-slate-400 font-normal">— Display name shown to users</span>
          </label>
          <input name="badgeName" defaultValue={editing?.badgeName ?? ""} required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700" title="Describes what the user must do to earn this badge">
            Description <span className="text-slate-400 font-normal">— Criteria to earn this badge</span>
          </label>
          <textarea name="description" defaultValue={editing?.description ?? ""} rows={2} required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
        </div>

        {/* Icon + Achievement Type row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" title="Emoji icon representing this badge">
              Icon <span className="text-slate-400 font-normal">— Emoji</span>
            </label>
            <div ref={emojiRef} className="relative">
              <input type="hidden" name="icon" value={selectedEmoji} />
              <button
                type="button"
                onClick={() => setEmojiOpen(!emojiOpen)}
                className="flex w-full items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm hover:border-slate-400"
              >
                <span className="text-xl">{selectedEmoji}</span>
                <span className="text-slate-400">Choose…</span>
              </button>
              {emojiOpen && (
                <div className="absolute left-0 top-full z-20 mt-1 w-80 rounded border border-slate-200 bg-white shadow-xl">
                  {/* Category tabs */}
                  <div className="flex flex-wrap gap-0.5 border-b border-slate-100 bg-slate-50 px-1 pt-1">
                    {EMOJI_CATEGORIES.map((cat, i) => (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => setEmojiCategory(i)}
                        className={`rounded-t px-2 py-1 text-xs ${i === emojiCategory ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                  {/* Emoji grid */}
                  <div className="grid grid-cols-6 gap-1 p-2 max-h-64 overflow-y-auto">
                    {EMOJI_CATEGORIES[emojiCategory].emojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => { setSelectedEmoji(emoji); setEmojiOpen(false); }}
                        className={`rounded p-1 text-lg hover:bg-slate-100 ${selectedEmoji === emoji ? "bg-blue-50 ring-1 ring-blue-300" : ""}`}
                        title={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" title="Internal code used by the gamification engine to identify this achievement type">
              Achievement Type <span className="text-slate-400 font-normal">— Internal code</span>
            </label>
            <div ref={achTypeRef} className="relative">
              <input type="hidden" name="achievementType" value={achTypeQuery} />
              <input
                type="text"
                value={achTypeQuery}
                onChange={e => { setAchTypeQuery(e.target.value); setAchTypeOpen(true); }}
                onFocus={() => setAchTypeOpen(true)}
                placeholder="Select or type a new type…"
                autoComplete="off"
                required
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
              {achTypeOpen && filteredAchTypes.length > 0 && (
                <ul className="absolute left-0 top-full z-20 mt-1 max-h-40 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow-lg">
                  {filteredAchTypes.map(t => (
                    <li
                      key={t}
                      className={`cursor-pointer px-3 py-1.5 text-sm hover:bg-slate-100 ${t === achTypeQuery ? "bg-blue-50 font-medium" : ""}`}
                      onMouseDown={() => { setAchTypeQuery(t); setAchTypeOpen(false); }}
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Emotional Drive + Rarity row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" title="The Octalysis emotional drive this badge appeals to">
              Emotional Drive <span className="text-slate-400 font-normal">— Octalysis core drive</span>
            </label>
            <select name="emotionalDrive" defaultValue={editing?.emotionalDrive ?? "Achievement"}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
              {EMOTIONAL_DRIVES.map((d) => (
                <option key={d.value} value={d.value} title={d.tip}>{d.emoji} {d.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" title="How difficult or rare this badge is to earn">
              Rarity <span className="text-slate-400 font-normal">— Difficulty tier</span>
            </label>
            <select name="rarity" defaultValue={editing?.rarity ?? "Uncommon"}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
              {RARITIES.map((r) => (
                <option key={r.value} value={r.value} title={r.tip}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Process Area + Level row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" title="Link this badge to a specific Process Area (optional)">
              Process Area <span className="text-slate-400 font-normal">— Optional</span>
            </label>
            <select name="processAreaId" defaultValue={editing?.processAreaId ?? ""}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
              <option value="">— None —</option>
              {processAreas.map((pa) => (
                <option key={pa.id} value={pa.id}>{pa.standard ? `${pa.standard} — ` : ""}{pa.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" title="Progression level within the process (Bronze → Black)">
              Level <span className="text-slate-400 font-normal">— Progression tier</span>
            </label>
            <select name="level" defaultValue={editing?.level ?? ""}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
              <option value="">— None —</option>
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value} title={l.tip}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Criteria fields */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" title="Minimum points the user must accumulate to unlock this badge (optional)">
              Points Req. <span className="text-slate-400 font-normal">— Optional threshold</span>
            </label>
            <input name="pointsRequired" type="number" min="0" defaultValue={editing?.pointsRequired ?? ""}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" title="Number of controls the user must check to earn this badge (optional)">
              Controls Req. <span className="text-slate-400 font-normal">— Optional</span>
            </label>
            <input name="controlsChecked" type="number" min="0" defaultValue={editing?.controlsChecked ?? ""}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" title="Consecutive days of activity required to earn this badge (optional)">
              Streak Days <span className="text-slate-400 font-normal">— Optional</span>
            </label>
            <input name="streakDays" type="number" min="0" defaultValue={editing?.streakDays ?? ""}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        {/* Image Upload */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700" title="Upload a badge image (PNG, JPG). Stored in /images/badges/">
            Badge Image <span className="text-slate-400 font-normal">— Upload PNG/JPG</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              name="badgeImage"
              accept="image/*"
              onChange={handleFileChange}
              className="text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
            {previewUrl && !removeImage && (
              <div className="flex items-center gap-2">
                <img src={previewUrl} alt="Preview" className="h-10 w-10 rounded border object-cover" />
                <button
                  type="button"
                  onClick={() => { setPreviewUrl(null); setRemoveImage(true); if (fileRef.current) fileRef.current.value = ""; }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              </div>
            )}
            {removeImage && (
              <span className="text-xs text-amber-600">Image will be removed on save</span>
            )}
          </div>
        </div>

        <div className="pt-2">
          <button type="submit" className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            {editing ? "Update Badge" : "Create Badge"}
          </button>
        </div>
      </form>
    </div>
  );
}

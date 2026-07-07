"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

const EMOJI_OPTIONS = [
  // Awards & Stars
  "🏆", "🥇", "🥈", "🥉", "⭐", "🌟", "💫", "✨", "🎖️", "🏅",
  // Medals & Badges
  "🎯", "🔰", "✅", "☑️", "✔️", "💎", "🔮", "🎪", "🎗️", "🏷️",
  // Shields & Protection
  "🛡️", "🔒", "🔐", "🗝️", "⚔️", "🗡️", "🏹", "💂", "👑", "💍",
  // Growth & Nature
  "🌱", "🌿", "🌳", "🌻", "🌸", "🔥", "💡", "📈", "📊", "🧠",
  // Hands & People
  "🤝", "👥", "👤", "🙌", "👏", "💪", "🦾", "🧑‍🏫", "👨‍🔬", "👷",
  // Tools & Science
  "🔬", "🔭", "📋", "📝", "✏️", "🖊️", "📌", "📎", "🔗", "🧲",
  // Hearts & Emotions
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🤍", "🖤", "💖", "💝",
  // Misc Cool
  "🎨", "🎵", "🎭", "🚀", "🌍", "🏗️", "⚡", "💎", "🔔", "🎉",
];

const EMOJI_CATEGORIES = [
  { name: "Awards", emojis: EMOJI_OPTIONS.slice(0, 10) },
  { name: "Badges", emojis: EMOJI_OPTIONS.slice(10, 20) },
  { name: "Shields", emojis: EMOJI_OPTIONS.slice(20, 30) },
  { name: "Growth", emojis: EMOJI_OPTIONS.slice(30, 40) },
  { name: "People", emojis: EMOJI_OPTIONS.slice(40, 50) },
  { name: "Tools", emojis: EMOJI_OPTIONS.slice(50, 60) },
  { name: "Hearts", emojis: EMOJI_OPTIONS.slice(60, 70) },
  { name: "Misc", emojis: EMOJI_OPTIONS.slice(70, 80) },
];

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
};

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

export default function BadgeForm({
  editing,
  isOpen,
  onClose,
}: {
  editing: Badge | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(editing?.badgeImage ?? null);
  const [removeImage, setRemoveImage] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState(editing?.icon ?? "🏆");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState(0);

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
                <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded border border-slate-200 bg-white shadow-xl">
                  {/* Category tabs */}
                  <div className="flex flex-wrap border-b border-slate-100 bg-slate-50 px-1 pt-1">
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
                  <div className="grid grid-cols-10 gap-0.5 p-2">
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
            <input name="achievementType" defaultValue={editing?.achievementType ?? ""} required
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
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

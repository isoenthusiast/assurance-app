"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { formatDate } from "@/lib/formatDate";

interface KBRecord {
  kID: string;
  knowledgeName: string;
  knowledgeContent: string;
  remarks: string | null;
  createdDate: string;
  addedBy: string;
}

export default function KnowledgebasePage() {
  return <KnowledgebaseManager />;
}

export function KnowledgebaseManager() {
  const [records, setRecords] = useState<KBRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<KBRecord | null>(null);
  const [remarks, setRemarks] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const PER_PAGE = 20;

  // Load records
  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/table/Knowledgebase/data?perPage=500`);
      if (res.ok) {
        const d = await res.json();
        let rows = d.rows || [];
        if (search) {
          const q = search.toLowerCase();
          rows = rows.filter(
            (r: KBRecord) =>
              r.knowledgeName?.toLowerCase().includes(q) ||
              r.remarks?.toLowerCase().includes(q) ||
              r.addedBy?.toLowerCase().includes(q)
          );
        }
        setRecords(rows);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Handle file upload
  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["docx", "pdf"].includes(ext || "")) {
        setMsg({ type: "err", text: "Only .docx and .pdf files are supported." });
        return;
      }

      setUploading(true);
      setMsg(null);
      setPreview(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("saveToKnowledgebase", "true");
        if (remarks) formData.append("remarks", remarks);

        const res = await fetch("/api/convert", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || err.details || "Upload failed");
        }

        const data = await res.json();
        setPreview(data.markdown);
        setMsg({
          type: "ok",
          text: `"${file.name}" converted and saved to Knowledgebase. (${(data.mdLength / 1024).toFixed(1)} KB)`,
        });
        setRemarks("");
        loadRecords();
      } catch (e: any) {
        setMsg({ type: "err", text: e.message });
      } finally {
        setUploading(false);
      }
    },
    [remarks, loadRecords]
  );

  // Delete record
  const deleteRecord = async (kID: string) => {
    if (!confirm("Delete this knowledgebase entry?")) return;
    try {
      const res = await fetch(`/api/admin/table/Knowledgebase/${kID}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMsg({ type: "ok", text: "Entry deleted." });
        if (selectedRecord?.kID === kID) setSelectedRecord(null);
        loadRecords();
      } else {
        const err = await res.json();
        throw new Error(err.error || "Delete failed");
      }
    } catch (e: any) {
      setMsg({ type: "err", text: e.message });
    }
  };

  // Download markdown
  const downloadMarkdown = (record: KBRecord) => {
    const blob = new Blob([record.knowledgeContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${record.knowledgeName}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full gap-3 p-3">
      {/* LEFT: Upload + List */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-3">
        {/* Upload Zone */}
        <div
          className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
            dragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
        >
          <div className="text-2xl mb-1">📄</div>
          <div className="text-xs text-slate-600 mb-2">
            Drop .docx or .pdf here
          </div>
          <div className="text-xs text-slate-400 mb-2">— or —</div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? "Converting..." : "Browse Files"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        {/* Remarks */}
        <div>
          <label className="text-xs font-medium text-slate-600">Remarks (optional)</label>
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g., Extracted from HSSE manual v3..."
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Message */}
        {msg && (
          <div
            className={`rounded px-3 py-2 text-xs ${
              msg.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* Search */}
        <div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entries..."
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Record List */}
        <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white">
          <div className="px-3 py-2 border-b border-slate-200 text-xs font-semibold text-slate-600 flex justify-between">
            <span>Entries ({records.length})</span>
            <button onClick={loadRecords} className="text-blue-600 hover:underline">
              ↻
            </button>
          </div>
          {loading ? (
            <div className="p-3 text-xs text-slate-400">Loading...</div>
          ) : records.length === 0 ? (
            <div className="p-3 text-xs text-slate-400">No entries yet.</div>
          ) : (
            records.map((r) => (
              <button
                key={r.kID}
                onClick={() => setSelectedRecord(r)}
                className={`w-full text-left px-3 py-2 text-xs border-b border-slate-50 hover:bg-slate-50 ${
                  selectedRecord?.kID === r.kID ? "bg-blue-50 border-l-2 border-l-blue-500 font-medium" : ""
                }`}
              >
                <div className="truncate text-slate-700">{r.knowledgeName}</div>
                <div className="text-slate-400 text-2xs mt-0.5">
                  {r.addedBy} · {formatDate(r.createdDate)}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* RIGHT: Preview / Detail */}
      <div className="flex-1 rounded-lg border border-slate-200 bg-white flex flex-col min-w-0">
        {selectedRecord ? (
          <>
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-900 text-sm">{selectedRecord.knowledgeName}</span>
                <span className="text-xs text-slate-400 ml-3">
                  by {selectedRecord.addedBy} on {new Date(selectedRecord.createdDate).toLocaleString()}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadMarkdown(selectedRecord)}
                  className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  ⬇ Download .md
                </button>
                <button
                  onClick={() => deleteRecord(selectedRecord.kID)}
                  className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                >
                  🗑 Delete
                </button>
              </div>
            </div>

            {/* Remarks */}
            {selectedRecord.remarks && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
                📝 {selectedRecord.remarks}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                {selectedRecord.knowledgeContent.length > 50000
                  ? selectedRecord.knowledgeContent.slice(0, 50000) +
                    "\n\n... (truncated, download .md for full content)"
                  : selectedRecord.knowledgeContent}
              </pre>
            </div>
          </>
        ) : preview ? (
          <>
            <div className="px-4 py-2.5 border-b border-slate-200">
              <span className="font-semibold text-slate-900 text-sm">Conversion Preview</span>
              <span className="text-xs text-green-600 ml-3">Saved to Knowledgebase ✓</span>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                {preview.length > 50000
                  ? preview.slice(0, 50000) + "\n\n... (truncated)"
                  : preview}
              </pre>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
            <div className="text-4xl">📚</div>
            <div className="text-sm">Upload a document or select an entry</div>
            <div className="text-xs text-slate-300">.docx · .pdf → Markdown → Knowledgebase</div>
          </div>
        )}
      </div>
    </div>
  );
}

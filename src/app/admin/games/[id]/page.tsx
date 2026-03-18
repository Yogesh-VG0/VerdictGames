"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Game, VerdictLabel } from "@/lib/types";

async function fetchGame(id: string): Promise<Game> {
  const res = await fetch(`/api/admin/games/${id}`);
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error ?? "Failed to fetch game");
}

async function updateGame(id: string, data: Partial<Game>): Promise<Game> {
  const res = await fetch(`/api/admin/games/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error ?? "Failed to update game");
}

async function reingestGame(id: string): Promise<void> {
  const res = await fetch(`/api/admin/games/${id}/ingest`, { method: "POST" });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Re-ingest failed");
}

async function toggleFlags(id: string, flags: { featured?: boolean; trending?: boolean }): Promise<void> {
  const res = await fetch("/api/admin/featured", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId: id, ...flags }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Update failed");
}

const VERDICT_OPTIONS: VerdictLabel[] = ["MUST PLAY", "WORTH IT", "MIXED", "SKIP"];

export default function AdminGameEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();

  const game = useQuery({
    queryKey: ["admin-game", id],
    queryFn: () => fetchGame(id),
  });

  const [form, setForm] = useState({
    title: "",
    description: "",
    score: 0,
    verdict_label: "MIXED" as VerdictLabel,
    verdict_summary: "",
    pros: [] as string[],
    cons: [] as string[],
    featured: false,
    trending: false,
  });

  const [prosText, setProsText] = useState("");
  const [consText, setConsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    if (game.data) {
      setForm({
        title: game.data.title,
        description: game.data.description,
        score: game.data.score,
        verdict_label: game.data.verdictLabel,
        verdict_summary: game.data.verdictSummary,
        pros: game.data.pros ?? [],
        cons: game.data.cons ?? [],
        featured: game.data.featured ?? false,
        trending: game.data.trending ?? false,
      });
      setProsText((game.data.pros ?? []).join("\n"));
      setConsText((game.data.cons ?? []).join("\n"));
    }
  }, [game.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const updatedPros = prosText.split("\n").map((s) => s.trim()).filter(Boolean);
      const updatedCons = consText.split("\n").map((s) => s.trim()).filter(Boolean);
      return updateGame(id, {
        title: form.title,
        description: form.description,
        score: form.score,
        verdictLabel: form.verdict_label,
        verdictSummary: form.verdict_summary,
        pros: updatedPros,
        cons: updatedCons,
      } as unknown as Partial<Game>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-game", id] });
      setSaveMsg("Saved successfully!");
      setTimeout(() => setSaveMsg(""), 3000);
    },
    onError: (err) => {
      setSaveMsg("Error: " + (err as Error).message);
    },
  });

  const reingestMutation = useMutation({
    mutationFn: () => reingestGame(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-game", id] });
      setSaveMsg("Re-ingested successfully!");
      setTimeout(() => setSaveMsg(""), 3000);
    },
  });

  const flagsMutation = useMutation({
    mutationFn: (flags: { featured?: boolean; trending?: boolean }) => toggleFlags(id, flags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-game", id] });
    },
  });

  if (game.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-white/5 rounded-lg animate-pulse w-1/3" />
        <div className="h-64 bg-white/5 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!game.data) {
    return <p className="text-secondary text-sm">Game not found</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          {game.data.coverImage && (
            <div className="w-16 h-22 rounded-xl overflow-hidden bg-surface-2 shrink-0 relative">
              <Image src={game.data.coverImage} alt="" fill className="object-cover" sizes="64px" />
            </div>
          )}
          <div>
            <Link href="/admin/games" className="text-xs text-tertiary hover:text-accent transition-colors">
              ← Back to Games
            </Link>
            <h1 className="text-xl font-bold text-foreground mt-0.5">{game.data.title}</h1>
            <p className="text-xs text-tertiary">{game.data.slug} • Score: {game.data.score}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => reingestMutation.mutate()}
            disabled={reingestMutation.isPending}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-pixel-cyan/10 text-pixel-cyan border border-pixel-cyan/20 hover:bg-pixel-cyan/20 transition-all disabled:opacity-50"
          >
            {reingestMutation.isPending ? "Re-ingesting..." : "Re-ingest Data"}
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-accent text-white shadow-sm shadow-accent/20 hover:bg-accent-hover transition-all disabled:opacity-50"
          >
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {saveMsg && (
        <div className={`rounded-xl px-4 py-2 text-sm font-medium ${saveMsg.startsWith("Error") ? "bg-danger/10 text-danger" : "bg-pixel-green/10 text-pixel-green"}`}>
          {saveMsg}
        </div>
      )}

      {/* Flags */}
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => {
              setForm((f) => ({ ...f, featured: e.target.checked }));
              flagsMutation.mutate({ featured: e.target.checked });
            }}
            className="w-4 h-4 rounded accent-accent"
          />
          <span className="text-sm text-foreground font-medium">Featured</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.trending}
            onChange={(e) => {
              setForm((f) => ({ ...f, trending: e.target.checked }));
              flagsMutation.mutate({ trending: e.target.checked });
            }}
            className="w-4 h-4 rounded accent-accent"
          />
          <span className="text-sm text-foreground font-medium">Trending</span>
        </label>
      </div>

      {/* Edit Form */}
      <div className="space-y-4">
        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
          />
        </div>

        {/* Score + Verdict */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Score (0-100)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.score}
              onChange={(e) => setForm((f) => ({ ...f, score: parseInt(e.target.value, 10) || 0 }))}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Verdict Label</label>
            <select
              value={form.verdict_label}
              onChange={(e) => setForm((f) => ({ ...f, verdict_label: e.target.value as VerdictLabel }))}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
            >
              {VERDICT_OPTIONS.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Verdict Summary */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Verdict Summary</label>
          <textarea
            value={form.verdict_summary}
            onChange={(e) => setForm((f) => ({ ...f, verdict_summary: e.target.value }))}
            rows={3}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all resize-y"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={6}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all resize-y"
          />
        </div>

        {/* Pros & Cons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-secondary uppercase tracking-wider">
              Pros <span className="text-tertiary font-normal">(one per line)</span>
            </label>
            <textarea
              value={prosText}
              onChange={(e) => setProsText(e.target.value)}
              rows={5}
              placeholder="Great visuals&#10;Engaging story&#10;Smooth gameplay"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-tertiary focus:outline-none focus:border-pixel-green/50 focus:ring-1 focus:ring-pixel-green/20 transition-all resize-y"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-secondary uppercase tracking-wider">
              Cons <span className="text-tertiary font-normal">(one per line)</span>
            </label>
            <textarea
              value={consText}
              onChange={(e) => setConsText(e.target.value)}
              rows={5}
              placeholder="Performance issues&#10;Short campaign&#10;Repetitive missions"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-tertiary focus:outline-none focus:border-danger/50 focus:ring-1 focus:ring-danger/20 transition-all resize-y"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

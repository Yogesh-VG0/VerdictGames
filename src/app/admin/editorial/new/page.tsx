"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Save, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const VERDICT_OPTIONS = ["MUST PLAY", "WORTH IT", "MIXED", "SKIP", "COMING SOON"];

interface GameSearchResult {
  id: string;
  title: string;
  slug: string;
  cover_image: string;
  developer: string;
  release_date: string | null;
}

async function searchGames(query: string): Promise<GameSearchResult[]> {
  if (!query.trim()) return [];
  // Search games already in the database (not external sources)
  const res = await fetch(`/api/admin/games?q=${encodeURIComponent(query)}&limit=10`);
  const json = await res.json();
  if (json.success && json.data?.games) {
    return json.data.games.map((g: Record<string, unknown>) => ({
      id: g.id,
      title: g.title,
      slug: g.slug,
      cover_image: g.cover_image,
      developer: g.developer,
      release_date: g.release_date,
    }));
  }
  return [];
}

async function createEditorialReview(data: Record<string, unknown>) {
  const res = await fetch("/api/admin/editorial-reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error ?? "Failed to create review");
}

const inputClass = "w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all";
const labelClass = "text-xs font-semibold text-secondary uppercase tracking-wider";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

export default function NewEditorialReviewPage() {
  const router = useRouter();
  const [step, setStep] = useState<"select-game" | "write-review">("select-game");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGame, setSelectedGame] = useState<GameSearchResult | null>(null);
  const [saveMsg, setSaveMsg] = useState("");

  const [form, setForm] = useState({
    title: "",
    content: "",
    score: null as number | null,
    verdict_label: "",
    playtime_hours: null as number | null,
    platform_played: "",
    version_reviewed: "",
    is_published: false,
    is_featured: false,
  });

  const [prosText, setProsText] = useState("");
  const [consText, setConsText] = useState("");

  const gameSearch = useQuery({
    queryKey: ["game-search", searchQuery],
    queryFn: () => searchGames(searchQuery),
    enabled: searchQuery.length >= 2,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!selectedGame) throw new Error("No game selected");
      const pros = prosText.split("\n").map((s) => s.trim()).filter(Boolean);
      const cons = consText.split("\n").map((s) => s.trim()).filter(Boolean);
      return createEditorialReview({
        game_id: selectedGame.id,
        ...form,
        pros,
        cons,
      });
    },
    onSuccess: (data) => {
      router.push(`/admin/editorial/${data.id}`);
    },
    onError: (err) => {
      setSaveMsg("Error: " + (err as Error).message);
    },
  });

  const setField = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  if (step === "select-game") {
    return (
      <div className="space-y-6">
        <div>
          <Link href="/admin/editorial" className="text-xs text-tertiary hover:text-accent transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" />
            Back to Editorial Reviews
          </Link>
          <h1 className="text-xl font-bold text-foreground mt-2">New Editorial Review</h1>
          <p className="text-sm text-secondary mt-1">Step 1: Select a game to review</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
          <Field label="Search for a game">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${inputClass} pl-10`}
                placeholder="Type game title..."
                autoFocus
              />
            </div>
          </Field>

          {gameSearch.isLoading && (
            <div className="text-sm text-tertiary py-4 text-center">Searching...</div>
          )}

          {gameSearch.data && gameSearch.data.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {gameSearch.data.map((game) => (
                <button
                  key={game.id}
                  onClick={() => {
                    setSelectedGame(game);
                    setStep("write-review");
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-2 hover:bg-accent/10 hover:border-accent/30 transition-all text-left"
                >
                  <div className="w-12 h-16 rounded-lg overflow-hidden bg-surface shrink-0 relative">
                    {game.cover_image ? (
                      <Image src={game.cover_image} alt="" fill className="object-cover" sizes="48px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-tertiary text-xs">
                        ?
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{game.title}</p>
                    <p className="text-xs text-tertiary">{game.developer} • {game.release_date?.split("-")[0]}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {searchQuery.length >= 2 && !gameSearch.isLoading && gameSearch.data?.length === 0 && (
            <div className="text-sm text-tertiary py-4 text-center">No games found for "{searchQuery}"</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          {selectedGame?.cover_image && (
            <div className="w-16 h-20 rounded-xl overflow-hidden bg-surface-2 shrink-0 relative">
              <Image src={selectedGame.cover_image} alt="" fill className="object-cover" sizes="64px" />
            </div>
          )}
          <div>
            <button
              onClick={() => setStep("select-game")}
              className="text-xs text-tertiary hover:text-accent transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Change Game
            </button>
            <h1 className="text-xl font-bold text-foreground mt-0.5">{selectedGame?.title}</h1>
            <p className="text-xs text-tertiary">New Editorial Review</p>
          </div>
        </div>
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || !form.content.trim()}
          className="px-4 py-2 rounded-xl text-xs font-medium bg-accent text-white shadow-sm shadow-accent/20 hover:bg-accent-hover transition-all disabled:opacity-50 flex items-center gap-1.5"
        >
          <Save className="w-4 h-4" />
          {createMutation.isPending ? "Creating..." : "Create Review"}
        </button>
      </div>

      {/* Status message */}
      {saveMsg && (
        <div className={`rounded-xl px-4 py-2 text-sm font-medium ${saveMsg.startsWith("Error") ? "bg-danger/10 text-danger" : "bg-pixel-green/10 text-pixel-green"}`}>
          {saveMsg}
        </div>
      )}

      {/* Form */}
      <div className="rounded-2xl border border-border bg-surface p-6 space-y-6">
        <Field label="Review Title (Optional Headline)">
          <input
            type="text"
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
            className={inputClass}
            placeholder="e.g., A masterpiece that defines its genre"
          />
        </Field>

        <Field label="Review Content *">
          <textarea
            value={form.content}
            onChange={(e) => setField("content", e.target.value)}
            rows={12}
            className={`${inputClass} resize-y`}
            placeholder="Write your detailed review here. Supports markdown formatting."
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Score (0-100, optional)">
            <input
              type="number"
              min={0}
              max={100}
              value={form.score ?? ""}
              onChange={(e) => setField("score", e.target.value ? parseInt(e.target.value, 10) : null)}
              className={inputClass}
              placeholder="Leave empty to use game's score"
            />
          </Field>
          <Field label="Verdict Label (optional)">
            <select
              value={form.verdict_label}
              onChange={(e) => setField("verdict_label", e.target.value)}
              className={inputClass}
            >
              <option value="">Use game&apos;s verdict</option>
              {VERDICT_OPTIONS.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Pros (one per line)">
            <textarea
              value={prosText}
              onChange={(e) => setProsText(e.target.value)}
              rows={5}
              placeholder={"Great visuals\nEngaging story\nSmooth gameplay"}
              className={`${inputClass} resize-y`}
            />
          </Field>
          <Field label="Cons (one per line)">
            <textarea
              value={consText}
              onChange={(e) => setConsText(e.target.value)}
              rows={5}
              placeholder={"Performance issues\nShort campaign\nRepetitive missions"}
              className={`${inputClass} resize-y`}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Playtime (hours)">
            <input
              type="number"
              min={0}
              step={0.5}
              value={form.playtime_hours ?? ""}
              onChange={(e) => setField("playtime_hours", e.target.value ? parseFloat(e.target.value) : null)}
              className={inputClass}
              placeholder="e.g., 25.5"
            />
          </Field>
          <Field label="Platform Played">
            <input
              type="text"
              value={form.platform_played}
              onChange={(e) => setField("platform_played", e.target.value)}
              className={inputClass}
              placeholder="e.g., PC, PS5, Xbox"
            />
          </Field>
          <Field label="Version Reviewed">
            <input
              type="text"
              value={form.version_reviewed}
              onChange={(e) => setField("version_reviewed", e.target.value)}
              className={inputClass}
              placeholder="e.g., 1.2.3, Early Access"
            />
          </Field>
        </div>

        <div className="flex items-center gap-4 pt-4 border-t border-border">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => setField("is_published", e.target.checked)}
              className="w-4 h-4 rounded border-border bg-surface-2 text-accent focus:ring-accent/20"
            />
            <span className="text-sm text-secondary">Publish immediately</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_featured}
              onChange={(e) => setField("is_featured", e.target.checked)}
              className="w-4 h-4 rounded border-border bg-surface-2 text-accent focus:ring-accent/20"
            />
            <span className="text-sm text-secondary">Feature this review</span>
          </label>
        </div>
      </div>
    </div>
  );
}

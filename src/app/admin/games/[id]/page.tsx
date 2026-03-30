"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Game, VerdictLabel } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ── API helpers ── */

async function fetchGame(id: string): Promise<Game> {
  const res = await fetch(`/api/admin/games/${id}`);
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error ?? "Failed to fetch game");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateGame(id: string, data: Record<string, any>): Promise<Game> {
  const res = await fetch(`/api/admin/games/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error ?? "Failed to update game");
}

async function reingestGame(id: string, source?: string, forceOverwrite?: boolean): Promise<{ preview?: boolean; source?: string; message?: string; data?: Record<string, unknown> }> {
  const body: Record<string, unknown> = {};
  if (source) body.source = source;
  if (forceOverwrite) body.forceOverwrite = true;
  
  const res = await fetch(`/api/admin/games/${id}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success && !json.data?.preview) throw new Error(json.error ?? "Re-ingest failed");
  return json.data ?? {};
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

/* ── Constants ── */

const VERDICT_OPTIONS: VerdictLabel[] = ["MUST PLAY", "WORTH IT", "MIXED", "SKIP"];

const TABS = [
  { key: "overview", label: "Overview", icon: "📋" },
  { key: "editorial", label: "Editorial", icon: "✍️" },
  { key: "media", label: "Media", icon: "🖼️" },
  { key: "links", label: "Store / Links", icon: "🔗" },
  { key: "diagnostics", label: "Diagnostics", icon: "🔧" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/* ── Reusable field components ── */

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all";
const labelClass = "text-xs font-semibold text-secondary uppercase tracking-wider";
const readOnlyClass =
  "w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-tertiary cursor-not-allowed";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

/* ── Main page component ── */

export default function AdminGameEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("overview");

  const game = useQuery({
    queryKey: ["admin-game", id],
    queryFn: () => fetchGame(id),
  });

  // ── Form state ──
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    description: "",
    developer: "",
    publisher: "",
    release_date: "",
    franchise: "",
    genres: [] as string[],
    tags: [] as string[],
    platforms: [] as string[],
    score: 0,
    verdict_label: "MIXED" as VerdictLabel,
    verdict_summary: "",
    monetization: "",
    performance_notes: "",
    monetization_notes: "",
    featured: false,
    trending: false,
    cover_image: "",
    header_image: "",
    trailer_url: "",
    trailer_thumbnail: "",
    screenshots: [] as string[],
    steam_url: "",
    play_store_url: "",
    website_url: "",
    wikipedia_url: "",
    metacritic_url: "",
    reddit_url: "",
    igdb_url: "",
  });

  const [prosText, setProsText] = useState("");
  const [consText, setConsText] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [screenshotInput, setScreenshotInput] = useState("");
  const [genresText, setGenresText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [reingestSource, setReingestSource] = useState<string>("all");
  const [platformsText, setPlatformsText] = useState("");
  const [uploading, setUploading] = useState<string | null>(null); // tracks which field is uploading

  // ── Sync form state from server data ──
  useEffect(() => {
    if (game.data) {
      const g = game.data;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        title: g.title ?? "",
        subtitle: g.subtitle ?? "",
        description: g.description ?? "",
        developer: g.developer ?? "",
        publisher: g.publisher ?? "",
        release_date: g.releaseDate ?? "",
        franchise: g.franchise ?? "",
        genres: g.genres ?? [],
        tags: g.tags ?? [],
        platforms: g.platforms ?? [],
        score: g.score ?? 0,
        verdict_label: g.verdictLabel ?? "MIXED",
        verdict_summary: g.verdictSummary ?? "",
        monetization: g.monetization ?? "",
        performance_notes: g.performanceNotes ?? "",
        monetization_notes: g.monetizationNotes ?? "",
        featured: g.featured ?? false,
        trending: g.trending ?? false,
        cover_image: g.coverImage ?? "",
        header_image: g.headerImage ?? "",
        trailer_url: g.trailerUrl ?? "",
        trailer_thumbnail: g.trailerThumbnail ?? "",
        screenshots: g.screenshots ?? [],
        steam_url: g.steamUrl ?? "",
        play_store_url: g.playStoreUrl ?? "",
        website_url: g.websiteUrl ?? "",
        wikipedia_url: g.wikipediaUrl ?? "",
        metacritic_url: g.metacriticUrl ?? "",
        reddit_url: g.redditUrl ?? "",
        igdb_url: g.igdbUrl ?? "",
      });
      setProsText((g.pros ?? []).join("\n"));
      setConsText((g.cons ?? []).join("\n"));
      setGenresText((g.genres ?? []).join(", "));
      setTagsText((g.tags ?? []).join(", "));
      setPlatformsText((g.platforms ?? []).join(", "));
    }
  }, [game.data]);

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: () => {
      const updatedPros = prosText.split("\n").map((s) => s.trim()).filter(Boolean);
      const updatedCons = consText.split("\n").map((s) => s.trim()).filter(Boolean);
      const genres = genresText.split(",").map((s) => s.trim()).filter(Boolean);
      const tags = tagsText.split(",").map((s) => s.trim()).filter(Boolean);
      const platforms = platformsText.split(",").map((s) => s.trim()).filter(Boolean);

      return updateGame(id, {
        title: form.title,
        subtitle: form.subtitle,
        description: form.description,
        developer: form.developer,
        publisher: form.publisher,
        release_date: form.release_date,
        franchise: form.franchise,
        genres,
        tags,
        platforms,
        score: form.score,
        verdict_label: form.verdict_label,
        verdict_summary: form.verdict_summary,
        monetization: form.monetization,
        performance_notes: form.performance_notes,
        monetization_notes: form.monetization_notes,
        pros: updatedPros,
        cons: updatedCons,
        cover_image: form.cover_image,
        header_image: form.header_image,
        trailer_url: form.trailer_url,
        trailer_thumbnail: form.trailer_thumbnail,
        screenshots: form.screenshots,
        steam_url: form.steam_url,
        play_store_url: form.play_store_url,
        website_url: form.website_url,
        wikipedia_url: form.wikipedia_url,
        metacritic_url: form.metacritic_url,
        reddit_url: form.reddit_url,
        igdb_url: form.igdb_url,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-game", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity"] });
      queryClient.invalidateQueries({ queryKey: ["admin-games"] });
      queryClient.invalidateQueries({ queryKey: ["homepage"] });
      queryClient.invalidateQueries({ queryKey: ["game", game.data?.slug] });
      setSaveMsg("Saved successfully!");
      setTimeout(() => setSaveMsg(""), 3000);
    },
    onError: (err) => {
      setSaveMsg("Error: " + (err as Error).message);
    },
  });

  const reingestMutation = useMutation({
    mutationFn: ({ source, forceOverwrite }: { source?: string; forceOverwrite?: boolean }) => 
      reingestGame(id, source === "all" ? undefined : source, forceOverwrite),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-game", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity"] });
      queryClient.invalidateQueries({ queryKey: ["admin-games"] });
      queryClient.invalidateQueries({ queryKey: ["homepage"] });
      queryClient.invalidateQueries({ queryKey: ["game", game.data?.slug] });
      const fields = (result?.data as Record<string, unknown>)?.fieldsUpdated as string[] | undefined;
      const fieldList = fields?.length ? `\nFields: ${fields.join(", ")}` : "";
      setSaveMsg((result?.message ?? "Re-ingested successfully!") + fieldList);
      setTimeout(() => setSaveMsg(""), 8000);
    },
  });

  const flagsMutation = useMutation({
    mutationFn: (flags: { featured?: boolean; trending?: boolean }) => toggleFlags(id, flags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-game", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity"] });
      queryClient.invalidateQueries({ queryKey: ["admin-games"] });
      queryClient.invalidateQueries({ queryKey: ["homepage"] });
    },
  });

  // ── Screenshot management ──
  const addScreenshot = () => {
    const url = screenshotInput.trim();
    if (url && !form.screenshots.includes(url)) {
      setForm((f) => ({ ...f, screenshots: [...f.screenshots, url] }));
      setScreenshotInput("");
    }
  };
  const removeScreenshot = (index: number) => {
    setForm((f) => ({ ...f, screenshots: f.screenshots.filter((_, i) => i !== index) }));
  };
  const handleScreenshotUpload = async (file: File) => {
    setUploading("screenshot");
    try {
      // Compress large images before upload
      const processedFile = await compressImage(file);
      
      const formData = new FormData();
      formData.append("file", processedFile);
      formData.append("folder", "verdict-games/screenshots");
      formData.append("gameSlug", game.data?.slug ?? "");
      formData.append("assetType", "screenshot");

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.data?.url) {
        setForm((f) => ({ ...f, screenshots: [...f.screenshots, json.data.url] }));
        setSaveMsg(`Screenshot uploaded!`);
        setTimeout(() => setSaveMsg(""), 3000);
      } else {
        setSaveMsg(`Error: ${json.error || "Upload failed"}`);
      }
    } catch (err) {
      setSaveMsg(`Error: ${err instanceof Error ? err.message : "Upload failed"}`);
    } finally {
      setUploading(null);
    }
  };

  // ── Setters ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setField = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  // ── Compress image before upload ──
  const compressImage = async (file: File, maxSizeMB: number = 3.5): Promise<File> => {
    // If file is small enough, return as-is
    if (file.size <= maxSizeMB * 1024 * 1024) return file;

    return new Promise((resolve, reject) => {
      const img = document.createElement("img");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      img.onload = () => {
        // Calculate new dimensions (max 2000px on longest side)
        let { width, height } = img;
        const maxDim = 2000;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = (height / width) * maxDim;
            width = maxDim;
          } else {
            width = (width / height) * maxDim;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to blob with reduced quality
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: "image/jpeg" }));
            } else {
              reject(new Error("Compression failed"));
            }
          },
          "image/jpeg",
          0.85
        );
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = URL.createObjectURL(file);
    });
  };

  // ── Image upload handler ──
  const handleImageUpload = async (file: File, fieldKey: string) => {
    setUploading(fieldKey);
    try {
      // Compress large images before upload
      const processedFile = await compressImage(file);
      
      const formData = new FormData();
      formData.append("file", processedFile);
      formData.append("folder", "verdict-games");
      formData.append("gameSlug", game.data?.slug ?? "");
      formData.append("assetType", fieldKey);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.data?.url) {
        setField(fieldKey, json.data.url);
        setSaveMsg(`Image uploaded successfully!`);
        setTimeout(() => setSaveMsg(""), 3000);
      } else {
        setSaveMsg(`Error: ${json.error || "Upload failed"}`);
      }
    } catch (err) {
      setSaveMsg(`Error: ${err instanceof Error ? err.message : "Upload failed"}`);
    } finally {
      setUploading(null);
    }
  };

  // ── Loading / Error states ──
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
      {/* ── Header ── */}
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
            <div className="flex items-center gap-2 mt-0.5">
              <h1 className="text-xl font-bold text-foreground">{game.data.title}</h1>
              <Link
                href={`/game/${game.data.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-xs text-secondary hover:text-accent font-medium transition-colors"
                title="View public game page"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </Link>
            </div>
            <p className="text-xs text-tertiary">{game.data.slug} • Score: {game.data.score}</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={reingestSource}
            onChange={(e) => setReingestSource(e.target.value)}
            className="h-9 px-2 text-xs rounded-xl border border-border bg-surface-2 text-foreground focus:outline-none focus:border-accent/50"
          >
            <option value="all">Full Pipeline</option>
            <option value="rawg">RAWG Only</option>
            <option value="igdb">IGDB Only</option>
            <option value="google_play">Google Play</option>
            <option value="app_store">App Store</option>
            <option value="mobile_both">Both Mobile Stores</option>
          </select>
          <button
            onClick={() => reingestMutation.mutate({ source: reingestSource })}
            disabled={reingestMutation.isPending}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-pixel-cyan/10 text-pixel-cyan border border-pixel-cyan/20 hover:bg-pixel-cyan/20 transition-all disabled:opacity-50"
          >
            {reingestMutation.isPending ? "Re-ingesting..." : reingestSource === "all" ? "Re-ingest Data" : `Fetch from ${reingestSource === "google_play" ? "Google Play" : reingestSource === "app_store" ? "App Store" : reingestSource === "mobile_both" ? "Both Stores" : reingestSource.toUpperCase()}`}
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

      {/* Status message */}
      {saveMsg && (
        <div className={`rounded-xl px-4 py-2 text-sm font-medium whitespace-pre-line ${saveMsg.startsWith("Error") ? "bg-danger/10 text-danger" : "bg-pixel-green/10 text-pixel-green"}`}>
          {saveMsg}
        </div>
      )}

      {/* ── Flag toggles ── */}
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
        <label className="flex items-center gap-2 cursor-pointer group" title="Featured games appear in the hero carousel on the homepage. Only a few games should be featured at a time for maximum impact.">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => {
              setField("featured", e.target.checked);
              flagsMutation.mutate({ featured: e.target.checked });
            }}
            className="w-4 h-4 rounded accent-accent"
          />
          <span className="text-sm text-foreground font-medium">Featured</span>
          <span className="text-[10px] text-tertiary hidden sm:inline group-hover:text-secondary transition-colors">Homepage hero carousel</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer group" title="Trending games appear in the &quot;Trending Now&quot; rail on the homepage. Auto-managed hourly by the scheduler based on Steam player counts, but can be manually toggled here.">
          <input
            type="checkbox"
            checked={form.trending}
            onChange={(e) => {
              setField("trending", e.target.checked);
              flagsMutation.mutate({ trending: e.target.checked });
            }}
            className="w-4 h-4 rounded accent-accent"
          />
          <span className="text-sm text-foreground font-medium">Trending</span>
          <span className="text-[10px] text-tertiary hidden sm:inline group-hover:text-secondary transition-colors">Homepage trending rail (auto-managed hourly)</span>
        </label>
      </div>

      {/* ── Tab Bar ── */}
      <nav className="flex gap-1 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap",
              tab === t.key
                ? "bg-accent text-white shadow-sm shadow-accent/20"
                : "text-secondary hover:text-foreground hover:bg-surface-2"
            )}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Tab Content ── */}
      <div className="rounded-2xl border border-border bg-surface p-5 md:p-6 space-y-5">

        {/* ═══ OVERVIEW TAB ═══ */}
        {tab === "overview" && (
          <>
            <Field label="Title">
              <input type="text" value={form.title} onChange={(e) => setField("title", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Subtitle">
              <input type="text" value={form.subtitle} onChange={(e) => setField("subtitle", e.target.value)} className={inputClass} placeholder="Optional tagline" />
            </Field>
            <Field label="Slug (read-only)">
              <input type="text" value={game.data.slug} readOnly className={readOnlyClass} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Developer">
                <input type="text" value={form.developer} onChange={(e) => setField("developer", e.target.value)} className={inputClass} />
              </Field>
              <Field label="Publisher">
                <input type="text" value={form.publisher} onChange={(e) => setField("publisher", e.target.value)} className={inputClass} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Release Date">
                <input type="date" value={form.release_date} onChange={(e) => setField("release_date", e.target.value)} className={inputClass} />
              </Field>
              <Field label="Franchise">
                <input type="text" value={form.franchise} onChange={(e) => setField("franchise", e.target.value)} className={inputClass} placeholder="e.g., The Elder Scrolls" />
              </Field>
            </div>
            <Field label="Genres (comma-separated)">
              <input type="text" value={genresText} onChange={(e) => setGenresText(e.target.value)} className={inputClass} placeholder="Action, RPG, Open World" />
            </Field>
            <Field label="Tags (comma-separated)">
              <input type="text" value={tagsText} onChange={(e) => setTagsText(e.target.value)} className={inputClass} placeholder="Singleplayer, Co-op, Moddable" />
            </Field>
            <Field label="Platforms (comma-separated)">
              <input type="text" value={platformsText} onChange={(e) => setPlatformsText(e.target.value)} className={inputClass} placeholder="PC, PlayStation 5, Xbox Series X|S" />
            </Field>
            <Field label="Description">
              <textarea value={form.description} onChange={(e) => setField("description", e.target.value)} rows={6} className={`${inputClass} resize-y`} />
            </Field>
          </>
        )}

        {/* ═══ EDITORIAL TAB ═══ */}
        {tab === "editorial" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Score (0-100)">
                <input
                  type="number" min={0} max={100}
                  value={form.score}
                  onChange={(e) => setField("score", parseInt(e.target.value, 10) || 0)}
                  className={inputClass}
                />
              </Field>
              <Field label="Verdict Label">
                <select
                  value={form.verdict_label}
                  onChange={(e) => setField("verdict_label", e.target.value)}
                  className={inputClass}
                >
                  {VERDICT_OPTIONS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Verdict Summary">
              <textarea value={form.verdict_summary} onChange={(e) => setField("verdict_summary", e.target.value)} rows={3} className={`${inputClass} resize-y`} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Pros (one per line)">
                <textarea
                  value={prosText}
                  onChange={(e) => setProsText(e.target.value)}
                  rows={5}
                  placeholder={"Great visuals\nEngaging story\nSmooth gameplay"}
                  className={`${inputClass} resize-y !focus:border-pixel-green/50`}
                />
              </Field>
              <Field label="Cons (one per line)">
                <textarea
                  value={consText}
                  onChange={(e) => setConsText(e.target.value)}
                  rows={5}
                  placeholder={"Performance issues\nShort campaign\nRepetitive missions"}
                  className={`${inputClass} resize-y !focus:border-danger/50`}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Monetization">
                <select value={form.monetization} onChange={(e) => setField("monetization", e.target.value)} className={inputClass}>
                  <option value="">—</option>
                  <option value="Free">Free</option>
                  <option value="Paid">Paid</option>
                  <option value="Freemium">Freemium</option>
                </select>
              </Field>
            </div>
            <Field label="Performance Notes">
              <textarea value={form.performance_notes} onChange={(e) => setField("performance_notes", e.target.value)} rows={3} className={`${inputClass} resize-y`} placeholder="Runs well on modern hardware..." />
            </Field>
            <Field label="Monetization Notes">
              <textarea value={form.monetization_notes} onChange={(e) => setField("monetization_notes", e.target.value)} rows={3} className={`${inputClass} resize-y`} placeholder="One-time purchase, no microtransactions..." />
            </Field>
          </>
        )}

        {/* ═══ MEDIA TAB ═══ */}
        {tab === "media" && (
          <>
            <Field label="Cover Image">
              <div className="flex gap-2">
                <input type="url" value={form.cover_image} onChange={(e) => setField("cover_image", e.target.value)} className={`flex-1 ${inputClass}`} placeholder="https://... or upload" />
                <label className="px-3 py-2 rounded-xl text-xs font-medium bg-pixel-cyan/10 text-pixel-cyan border border-pixel-cyan/20 hover:bg-pixel-cyan/20 transition-all cursor-pointer shrink-0 flex items-center gap-1.5">
                  {uploading === "cover_image" ? (
                    <span className="animate-pulse">Uploading...</span>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      Upload
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, "cover_image");
                      e.target.value = "";
                    }}
                    disabled={uploading === "cover_image"}
                  />
                </label>
              </div>
            </Field>
            {form.cover_image && (
              <div className="w-24 h-32 rounded-xl overflow-hidden bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.cover_image} alt="Cover preview" className="w-full h-full object-cover" />
              </div>
            )}

            <Field label="Header Image">
              <div className="flex gap-2">
                <input type="url" value={form.header_image} onChange={(e) => setField("header_image", e.target.value)} className={`flex-1 ${inputClass}`} placeholder="https://... or upload" />
                <label className="px-3 py-2 rounded-xl text-xs font-medium bg-pixel-cyan/10 text-pixel-cyan border border-pixel-cyan/20 hover:bg-pixel-cyan/20 transition-all cursor-pointer shrink-0 flex items-center gap-1.5">
                  {uploading === "header_image" ? (
                    <span className="animate-pulse">Uploading...</span>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      Upload
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, "header_image");
                      e.target.value = "";
                    }}
                    disabled={uploading === "header_image"}
                  />
                </label>
              </div>
            </Field>
            {form.header_image && (
              <div className="aspect-[21/9] max-w-lg rounded-xl overflow-hidden bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.header_image} alt="Header preview" className="w-full h-full object-cover" />
              </div>
            )}

            <Field label="Trailer URL">
              <input type="url" value={form.trailer_url} onChange={(e) => setField("trailer_url", e.target.value)} className={inputClass} placeholder="https://youtube.com/watch?v=..." />
            </Field>
            <Field label="Trailer Thumbnail URL">
              <input type="url" value={form.trailer_thumbnail} onChange={(e) => setField("trailer_thumbnail", e.target.value)} className={inputClass} placeholder="https://..." />
            </Field>

            {/* Screenshots manager */}
            <div className="space-y-3">
              <label className={labelClass}>Screenshots ({form.screenshots.length})</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={screenshotInput}
                  onChange={(e) => setScreenshotInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addScreenshot())}
                  placeholder="Paste screenshot URL and press Enter"
                  className={`flex-1 ${inputClass}`}
                />
                <button
                  onClick={addScreenshot}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-accent text-white hover:bg-accent-hover transition-all shrink-0"
                >
                  Add
                </button>
                <label className="px-3 py-2 rounded-xl text-xs font-medium bg-pixel-cyan/10 text-pixel-cyan border border-pixel-cyan/20 hover:bg-pixel-cyan/20 transition-all cursor-pointer shrink-0 flex items-center gap-1.5">
                  {uploading === "screenshot" ? (
                    <span className="animate-pulse">Uploading...</span>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      Upload
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleScreenshotUpload(file);
                      e.target.value = "";
                    }}
                    disabled={uploading === "screenshot"}
                  />
                </label>
              </div>
              {form.screenshots.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {form.screenshots.map((url, i) => (
                    <div key={i} className="group relative aspect-video rounded-xl overflow-hidden bg-surface-2 border border-border">
                      <Image src={url} alt={`Screenshot ${i + 1}`} fill className="object-cover" sizes="200px" />
                      <button
                        onClick={() => removeScreenshot(i)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-danger/80 backdrop-blur text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove"
                      >
                        ✕
                      </button>
                      <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-black/60 backdrop-blur text-white px-1.5 py-0.5 rounded-full">
                        #{i + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══ STORE / LINKS TAB ═══ */}
        {tab === "links" && (
          <>
            <Field label="Steam URL">
              <input type="url" value={form.steam_url} onChange={(e) => setField("steam_url", e.target.value)} className={inputClass} placeholder="https://store.steampowered.com/app/..." />
            </Field>
            <Field label="Google Play URL">
              <input type="url" value={form.play_store_url} onChange={(e) => setField("play_store_url", e.target.value)} className={inputClass} placeholder="https://play.google.com/store/apps/..." />
            </Field>
            <Field label="Official Website">
              <input type="url" value={form.website_url} onChange={(e) => setField("website_url", e.target.value)} className={inputClass} />
            </Field>
            <hr className="border-border" />
            <h4 className="text-xs font-semibold text-tertiary uppercase tracking-wider">External References</h4>
            <Field label="Wikipedia URL">
              <input type="url" value={form.wikipedia_url} onChange={(e) => setField("wikipedia_url", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Metacritic URL">
              <input type="url" value={form.metacritic_url} onChange={(e) => setField("metacritic_url", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Reddit URL">
              <input type="url" value={form.reddit_url} onChange={(e) => setField("reddit_url", e.target.value)} className={inputClass} />
            </Field>
            <Field label="IGDB URL">
              <input type="url" value={form.igdb_url} onChange={(e) => setField("igdb_url", e.target.value)} className={inputClass} />
            </Field>
          </>
        )}

        {/* ═══ DIAGNOSTICS TAB ═══ */}
        {tab === "diagnostics" && (
          <>
            <p className="text-xs text-tertiary">Read-only diagnostics from the enrichment pipeline.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Game ID">
                <input type="text" value={game.data.id} readOnly className={readOnlyClass} />
              </Field>
              <Field label="Score Source">
                <input type="text" value={game.data.scoreSource ?? "unknown"} readOnly className={readOnlyClass} />
              </Field>
              <Field label="Current Players">
                <input type="text" value={game.data.currentPlayers?.toLocaleString() ?? "N/A"} readOnly className={readOnlyClass} />
              </Field>
              <Field label="Momentum">
                <input type="text" value={game.data.momentum?.toFixed(2) ?? "N/A"} readOnly className={readOnlyClass} />
              </Field>
              <Field label="Steam Review Count">
                <input type="text" value={game.data.reviewCount?.toLocaleString() ?? "N/A"} readOnly className={readOnlyClass} />
              </Field>
              <Field label="User Score (Steam %)">
                <input type="text" value={game.data.userScore != null ? `${game.data.userScore}%` : "N/A"} readOnly className={readOnlyClass} />
              </Field>
              <Field label="IGDB Rating">
                <input type="text" value={game.data.igdbRating != null ? String(Math.round(game.data.igdbRating)) : "N/A"} readOnly className={readOnlyClass} />
              </Field>
              <Field label="Metacritic Score">
                <input type="text" value="See Metacritic URL" readOnly className={readOnlyClass} />
              </Field>
            </div>
            <div className="pt-4 flex items-center gap-2">
              <select
                value={reingestSource}
                onChange={(e) => setReingestSource(e.target.value)}
                className="h-9 px-2 text-xs rounded-xl border border-border bg-surface-2 text-foreground focus:outline-none focus:border-accent/50"
              >
                <option value="all">Full Pipeline</option>
                <option value="rawg">RAWG Only</option>
                <option value="igdb">IGDB Only</option>
                <option value="google_play">Google Play</option>
                <option value="app_store">App Store</option>
                <option value="mobile_both">Both Mobile Stores</option>
              </select>
              <button
                onClick={() => reingestMutation.mutate({ source: reingestSource })}
                disabled={reingestMutation.isPending}
                className="px-4 py-2.5 rounded-xl text-xs font-medium bg-pixel-cyan/10 text-pixel-cyan border border-pixel-cyan/20 hover:bg-pixel-cyan/20 transition-all disabled:opacity-50"
              >
                {reingestMutation.isPending ? "Re-ingesting..." : `🔄 Re-ingest from ${reingestSource === "all" ? "Pipeline" : reingestSource === "google_play" ? "Google Play" : reingestSource === "app_store" ? "App Store" : reingestSource === "mobile_both" ? "Both Stores" : reingestSource.toUpperCase()}`}
              </button>
              {(reingestSource === "google_play" || reingestSource === "app_store" || reingestSource === "mobile_both") && (
                <button
                  onClick={() => reingestMutation.mutate({ source: reingestSource, forceOverwrite: true })}
                  disabled={reingestMutation.isPending}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 transition-all disabled:opacity-50"
                  title="Overwrite ALL fields with fresh store data (resets admin edits)"
                >
                  🔄 Force Reset
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

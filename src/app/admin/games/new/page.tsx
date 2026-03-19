"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/utils/slugify";

type Mode = "lookup" | "url" | "provisional";

const PLATFORMS = ["PC", "PlayStation 5", "PlayStation 4", "Xbox Series X|S", "Xbox One", "Nintendo Switch", "Nintendo Switch 2", "Android", "iOS", "macOS", "Linux"];
const RELEASE_STATUSES = [
  { value: "upcoming", label: "Coming Soon" },
  { value: "tba", label: "TBA" },
  { value: "announced", label: "Announced" },
];

export default function AdminAddGamePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("lookup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Lookup mode
  const [lookupTitle, setLookupTitle] = useState("");

  // URL mode
  const [sourceUrl, setSourceUrl] = useState("");

  // Provisional mode
  const [form, setForm] = useState({
    title: "",
    slug: "",
    developer: "",
    publisher: "",
    releaseDate: "",
    releaseStatus: "upcoming",
    platforms: [] as string[],
    genres: "",
    description: "",
    coverImage: "",
  });

  const autoSlug = form.title ? slugify(form.title) : "";

  async function handleSubmit() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      let body: Record<string, unknown>;

      if (mode === "lookup") {
        if (!lookupTitle.trim()) { setError("Enter a game title"); setLoading(false); return; }
        body = { mode: "lookup", title: lookupTitle.trim() };
      } else if (mode === "url") {
        if (!sourceUrl.trim()) { setError("Enter a source URL"); setLoading(false); return; }
        body = { mode: "url", url: sourceUrl.trim() };
      } else {
        if (!form.title.trim()) { setError("Title is required"); setLoading(false); return; }
        body = {
          mode: "provisional",
          title: form.title.trim(),
          slug: form.slug || autoSlug,
          developer: form.developer,
          publisher: form.publisher,
          releaseDate: form.releaseDate || null,
          releaseStatus: form.releaseStatus,
          platforms: form.platforms,
          genres: form.genres.split(",").map(g => g.trim()).filter(Boolean),
          description: form.description,
          coverImage: form.coverImage,
        };
      }

      const res = await fetch("/api/admin/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        // 422 = low confidence match — offer to create provisional instead
        if (res.status === 422) {
          setError(`⚠️ ${json.error || "Low confidence match."} You can try creating a Provisional page instead.`);
        } else {
          setError(json.error || "Failed to create game");
        }
      } else {
        setSuccess(json.data?.message || "Game created!");
        setTimeout(() => {
          if (json.data?.gameId) {
            router.push(`/admin/games/${json.data.gameId}`);
          } else {
            router.push("/admin/games");
          }
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const tabClass = (t: Mode) =>
    `px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${mode === t
      ? "bg-accent text-white shadow-sm shadow-accent/20"
      : "text-secondary hover:text-foreground hover:bg-surface-2"
    }`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Add New Game</h1>
        <p className="text-sm text-secondary mt-1">Create a game entry via lookup, URL import, or manual entry</p>
      </div>

      {/* Mode Tabs */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setMode("lookup")} className={tabClass("lookup")}>
          🔍 Title Lookup
        </button>
        <button onClick={() => setMode("url")} className={tabClass("url")}>
          🔗 Source URL
        </button>
        <button onClick={() => setMode("provisional")} className={tabClass("provisional")}>
          📝 Create Provisional
        </button>
      </div>

      {/* Form */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-5">
        {mode === "lookup" && (
          <div className="space-y-4">
            <p className="text-xs text-tertiary">
              Search RAWG/IGDB/Steam by title. The game will be fully ingested and enriched automatically.
            </p>
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Game Title</label>
              <input
                value={lookupTitle}
                onChange={e => setLookupTitle(e.target.value)}
                placeholder="e.g. Elden Ring, Hollow Knight Silksong"
                className="w-full rounded-xl bg-surface-2 border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-tertiary focus:border-accent focus:outline-none transition-colors"
              />
            </div>
          </div>
        )}

        {mode === "url" && (
          <div className="space-y-4">
            <p className="text-xs text-tertiary">
              Paste a Steam, RAWG, or IGDB URL. The title will be extracted and ingested automatically.
            </p>
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Source URL</label>
              <input
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                placeholder="e.g. https://store.steampowered.com/app/1245620/ELDEN_RING/"
                className="w-full rounded-xl bg-surface-2 border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-tertiary focus:border-accent focus:outline-none transition-colors"
              />
            </div>
          </div>
        )}

        {mode === "provisional" && (
          <div className="space-y-4">
            <p className="text-xs text-tertiary">
              Create a placeholder page for an announced or upcoming game. Data will be enriched when sources become available.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">Title *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="E.g. Grand Theft Auto VI"
                  className="w-full rounded-xl bg-surface-2 border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-tertiary focus:border-accent focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">
                  Slug <span className="text-tertiary">(auto: {autoSlug || "..."})</span>
                </label>
                <input
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                  placeholder={autoSlug || "auto-generated"}
                  className="w-full rounded-xl bg-surface-2 border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-tertiary focus:border-accent focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">Developer</label>
                <input
                  value={form.developer}
                  onChange={e => setForm(f => ({ ...f, developer: e.target.value }))}
                  placeholder="Studio name"
                  className="w-full rounded-xl bg-surface-2 border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-tertiary focus:border-accent focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">Publisher</label>
                <input
                  value={form.publisher}
                  onChange={e => setForm(f => ({ ...f, publisher: e.target.value }))}
                  placeholder="Publisher name"
                  className="w-full rounded-xl bg-surface-2 border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-tertiary focus:border-accent focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">Release Date</label>
                <input
                  type="date"
                  value={form.releaseDate}
                  onChange={e => setForm(f => ({ ...f, releaseDate: e.target.value }))}
                  className="w-full rounded-xl bg-surface-2 border border-border px-4 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">Release Status</label>
                <select
                  value={form.releaseStatus}
                  onChange={e => setForm(f => ({ ...f, releaseStatus: e.target.value }))}
                  className="w-full rounded-xl bg-surface-2 border border-border px-4 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none transition-colors"
                >
                  {RELEASE_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Platforms</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm(f => ({
                      ...f,
                      platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p],
                    }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      form.platforms.includes(p)
                        ? "bg-accent/20 border-accent/40 text-accent"
                        : "bg-surface-2 border-border text-tertiary hover:text-secondary"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Genres (comma-separated)</label>
              <input
                value={form.genres}
                onChange={e => setForm(f => ({ ...f, genres: e.target.value }))}
                placeholder="Action, RPG, Adventure"
                className="w-full rounded-xl bg-surface-2 border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-tertiary focus:border-accent focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Brief game description..."
                className="w-full rounded-xl bg-surface-2 border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-tertiary focus:border-accent focus:outline-none transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Cover Image URL</label>
              <input
                value={form.coverImage}
                onChange={e => setForm(f => ({ ...f, coverImage: e.target.value }))}
                placeholder="https://..."
                className="w-full rounded-xl bg-surface-2 border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-tertiary focus:border-accent focus:outline-none transition-colors"
              />
            </div>
          </div>
        )}

        {/* Status Messages */}
        {error && (
          <div className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl bg-success/10 border border-success/20 px-4 py-3 text-sm text-success">
            {success}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Processing..." : mode === "lookup" ? "Search & Ingest" : mode === "url" ? "Import from URL" : "Create Provisional Page"}
        </button>
      </div>
    </div>
  );
}

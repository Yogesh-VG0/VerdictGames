"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { slugify } from "@/lib/utils/slugify";
import { Search, Link2, FileEdit, ArrowLeft, Check, Star, Calendar, Gamepad2, Loader2, AlertCircle, CheckCircle2, ExternalLink, Smartphone, Download, Store } from "lucide-react";

type Mode = "lookup" | "url" | "provisional";
type Step = "search" | "candidates" | "confirm" | "ingesting";
type CandidateSource = "rawg" | "google_play" | "app_store";

interface Candidate {
  source: CandidateSource;
  rawgId: number | null;
  name: string;
  slug: string;
  released: string | null;
  backgroundImage: string | null;
  rating: number | null;
  ratingsCount: number | null;
  metacritic: number | null;
  platforms: string[];
  genres: string[];
  developer: string | null;
  icon: string | null;
  score: number | null;
  installs: string | null;
  appId: string | null;
  trackId: number | null;
  storeUrl: string | null;
  alreadyInDb: boolean;
}

const SOURCE_LABELS: Record<CandidateSource, string> = { rawg: "RAWG", google_play: "Google Play", app_store: "App Store" };
const SOURCE_COLORS: Record<CandidateSource, string> = { rawg: "bg-blue-500/10 text-blue-400 border-blue-500/20", google_play: "bg-green-500/10 text-green-400 border-green-500/20", app_store: "bg-sky-500/10 text-sky-400 border-sky-500/20" };

const PLATFORMS = ["PC", "PlayStation 5", "PlayStation 4", "Xbox Series X|S", "Xbox One", "Nintendo Switch", "Nintendo Switch 2", "Android", "iOS", "macOS", "Linux"];
const RELEASE_STATUSES = [
  { value: "upcoming", label: "Coming Soon" },
  { value: "tba", label: "TBA" },
  { value: "announced", label: "Announced" },
];

const inputCls = "w-full rounded-xl bg-surface-2 border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-tertiary focus:border-accent focus:outline-none transition-colors";

export default function AdminAddGamePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("lookup");
  const [step, setStep] = useState<Step>("search");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Lookup mode
  const [lookupTitle, setLookupTitle] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [editedTitle, setEditedTitle] = useState("");

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

  // Search all sources for candidates
  const handleSearch = useCallback(async () => {
    if (!lookupTitle.trim()) { setError("Enter a game title"); return; }
    setLoading(true);
    setError("");
    setCandidates([]);
    setSourceFilter(null);
    try {
      const res = await fetch(`/api/admin/games/search-preview?q=${encodeURIComponent(lookupTitle.trim())}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Search failed"); setLoading(false); return; }
      const list: Candidate[] = json.data?.candidates ?? [];
      if (list.length === 0) { setError(`No results found for "${lookupTitle}". Try a different search or create a Provisional page.`); setLoading(false); return; }
      setCandidates(list);
      setStep("candidates");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [lookupTitle]);

  // Source filter for candidates list
  const [sourceFilter, setSourceFilter] = useState<CandidateSource | null>(null);
  const filteredCandidates = sourceFilter ? candidates.filter(c => c.source === sourceFilter) : candidates;
  const sourceCounts = {
    rawg: candidates.filter(c => c.source === "rawg").length,
    google_play: candidates.filter(c => c.source === "google_play").length,
    app_store: candidates.filter(c => c.source === "app_store").length,
  };

  // Select a candidate and move to confirm step
  function selectCandidate(c: Candidate) {
    setSelectedCandidate(c);
    setEditedTitle(c.name);
    setError("");
    setStep("confirm");
  }

  // Confirm and ingest the selected game
  async function handleIngest() {
    if (!selectedCandidate) return;
    setLoading(true);
    setError("");
    setSuccess("");
    setStep("ingesting");
    try {
      let payload: Record<string, unknown>;

      if (selectedCandidate.source === "rawg") {
        // RAWG: use the standard lookup ingest pipeline
        payload = { mode: "lookup", title: editedTitle.trim() || selectedCandidate.name };
      } else {
        // Google Play / App Store: use mobile_store mode
        payload = {
          mode: "mobile_store",
          storeSource: selectedCandidate.source,
          title: editedTitle.trim() || selectedCandidate.name,
          slug: slugify(editedTitle.trim() || selectedCandidate.name),
          developer: selectedCandidate.developer || "",
          platforms: selectedCandidate.platforms,
          genres: selectedCandidate.genres,
          coverImage: selectedCandidate.icon || "",
          appId: selectedCandidate.appId,
          trackId: selectedCandidate.trackId,
        };
      }

      const res = await fetch("/api/admin/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 422) {
          setError(`${json.error || "Low confidence match."} Try editing the title or create a Provisional page.`);
        } else {
          setError(json.error || "Failed to ingest game");
        }
        setStep("confirm");
      } else {
        setSuccess(json.data?.message || "Game ingested successfully!");
        setTimeout(() => {
          if (json.data?.gameId) router.push(`/admin/games/${json.data.gameId}`);
          else router.push("/admin/games");
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStep("confirm");
    } finally {
      setLoading(false);
    }
  }

  // URL & Provisional submit
  async function handleOtherSubmit() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      let body: Record<string, unknown>;
      if (mode === "url") {
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
        setError(json.error || "Failed to create game");
      } else {
        setSuccess(json.data?.message || "Game created!");
        setTimeout(() => {
          if (json.data?.gameId) router.push(`/admin/games/${json.data.gameId}`);
          else router.push("/admin/games");
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function resetLookup() {
    setStep("search");
    setCandidates([]);
    setSelectedCandidate(null);
    setEditedTitle("");
    setError("");
    setSuccess("");
  }

  function switchMode(m: Mode) {
    setMode(m);
    resetLookup();
  }

  const tabClass = (t: Mode) =>
    `flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${mode === t
      ? "bg-accent text-white shadow-sm shadow-accent/20"
      : "text-secondary hover:text-foreground hover:bg-surface-2"
    }`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Add New Game</h1>
        <p className="text-sm text-secondary mt-1">Search RAWG, Google Play &amp; App Store — or create manually</p>
      </div>

      {/* Mode Tabs */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => switchMode("lookup")} className={tabClass("lookup")}>
          <Search className="w-4 h-4" /> Title Lookup
        </button>
        <button onClick={() => switchMode("url")} className={tabClass("url")}>
          <Link2 className="w-4 h-4" /> Source URL
        </button>
        <button onClick={() => switchMode("provisional")} className={tabClass("provisional")}>
          <FileEdit className="w-4 h-4" /> Create Provisional
        </button>
      </div>

      {/* ═══════════ LOOKUP MODE ═══════════ */}
      {mode === "lookup" && (
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-5">

          {/* Step 1: Search */}
          {step === "search" && (
            <div className="space-y-4">
              <p className="text-xs text-tertiary">
                Search by title across RAWG, Google Play &amp; App Store. You&apos;ll verify the match before ingesting.
              </p>
              <div className="flex gap-2">
                <input
                  value={lookupTitle}
                  onChange={e => setLookupTitle(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  placeholder="e.g. Elden Ring, Offroad League Online, Clash Royale"
                  className={`${inputCls} flex-1`}
                  autoFocus
                />
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Search
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Pick from candidates (multi-source) */}
          {step === "candidates" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Search Results</h3>
                  <p className="text-xs text-tertiary mt-0.5">
                    {candidates.length} result{candidates.length !== 1 && "s"} for &quot;{lookupTitle}&quot; — select the correct game
                  </p>
                </div>
                <button onClick={resetLookup} className="flex items-center gap-1.5 text-xs text-secondary hover:text-foreground transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> New Search
                </button>
              </div>

              {/* Source filter tabs */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSourceFilter(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${!sourceFilter ? "bg-accent/20 border-accent/40 text-accent" : "bg-surface-2 border-border text-tertiary hover:text-secondary"}`}
                >
                  All ({candidates.length})
                </button>
                {sourceCounts.rawg > 0 && (
                  <button
                    onClick={() => setSourceFilter("rawg")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${sourceFilter === "rawg" ? "bg-blue-500/20 border-blue-500/40 text-blue-400" : "bg-surface-2 border-border text-tertiary hover:text-secondary"}`}
                  >
                    <Gamepad2 className="w-3 h-3" /> RAWG ({sourceCounts.rawg})
                  </button>
                )}
                {sourceCounts.google_play > 0 && (
                  <button
                    onClick={() => setSourceFilter("google_play")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${sourceFilter === "google_play" ? "bg-green-500/20 border-green-500/40 text-green-400" : "bg-surface-2 border-border text-tertiary hover:text-secondary"}`}
                  >
                    <Smartphone className="w-3 h-3" /> Google Play ({sourceCounts.google_play})
                  </button>
                )}
                {sourceCounts.app_store > 0 && (
                  <button
                    onClick={() => setSourceFilter("app_store")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${sourceFilter === "app_store" ? "bg-sky-500/20 border-sky-500/40 text-sky-400" : "bg-surface-2 border-border text-tertiary hover:text-secondary"}`}
                  >
                    <Store className="w-3 h-3" /> App Store ({sourceCounts.app_store})
                  </button>
                )}
              </div>

              <div className="grid gap-3">
                {filteredCandidates.map((c, idx) => (
                  <button
                    key={`${c.source}-${c.rawgId || c.appId || c.trackId || idx}`}
                    onClick={() => !c.alreadyInDb && selectCandidate(c)}
                    disabled={c.alreadyInDb}
                    className={`group relative flex items-start gap-4 p-3 rounded-xl border text-left transition-all ${
                      c.alreadyInDb
                        ? "border-border/50 opacity-60 cursor-not-allowed bg-surface"
                        : "border-border hover:border-accent/40 hover:bg-accent/[0.03] cursor-pointer bg-surface"
                    }`}
                  >
                    {/* Thumbnail / Icon */}
                    <div className="w-20 h-28 sm:w-24 sm:h-32 rounded-lg overflow-hidden bg-surface-2 shrink-0 relative">
                      {(c.backgroundImage || c.icon) ? (
                        <Image
                          src={(c.backgroundImage || c.icon)!}
                          alt={c.name}
                          fill
                          className={c.source !== "rawg" ? "object-contain p-2" : "object-cover"}
                          sizes="96px"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-tertiary">
                          {c.source === "google_play" ? <Smartphone className="w-8 h-8" /> :
                           c.source === "app_store" ? <Store className="w-8 h-8" /> :
                           <Gamepad2 className="w-8 h-8" />}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 py-0.5">
                      <div className="flex items-start gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-foreground truncate">{c.name}</h4>
                        {/* Source badge */}
                        <span className={`shrink-0 px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wider ${SOURCE_COLORS[c.source]}`}>
                          {SOURCE_LABELS[c.source]}
                        </span>
                        {c.alreadyInDb && (
                          <span className="shrink-0 px-2 py-0.5 rounded-md bg-success/10 text-success text-[10px] font-semibold uppercase tracking-wider">
                            In DB
                          </span>
                        )}
                      </div>

                      {/* Developer (mobile stores) */}
                      {c.developer && (
                        <p className="text-xs text-secondary mt-0.5 truncate">by {c.developer}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-secondary">
                        {c.released && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {c.released}
                          </span>
                        )}
                        {/* RAWG rating */}
                        {c.rating != null && c.rating > 0 && (
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500" /> {c.rating.toFixed(1)}{c.ratingsCount != null ? ` (${c.ratingsCount.toLocaleString()})` : ""}
                          </span>
                        )}
                        {/* Store score (5-star) */}
                        {c.score != null && c.score > 0 && (
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500" /> {c.score.toFixed(1)}/5
                          </span>
                        )}
                        {c.metacritic && (
                          <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent font-semibold text-[10px]">
                            MC {c.metacritic}
                          </span>
                        )}
                        {c.installs && (
                          <span className="flex items-center gap-1">
                            <Download className="w-3 h-3" /> {c.installs}
                          </span>
                        )}
                      </div>

                      {c.platforms.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {c.platforms.slice(0, 5).map((p) => (
                            <span key={p} className="px-1.5 py-0.5 rounded bg-white/5 border border-border text-[10px] text-tertiary">
                              {p}
                            </span>
                          ))}
                          {c.platforms.length > 5 && (
                            <span className="px-1.5 py-0.5 text-[10px] text-tertiary">+{c.platforms.length - 5}</span>
                          )}
                        </div>
                      )}

                      {c.genres.length > 0 && (
                        <p className="text-[11px] text-tertiary mt-1.5 truncate">{c.genres.join(", ")}</p>
                      )}
                    </div>

                    {/* Select indicator */}
                    {!c.alreadyInDb && (
                      <div className="shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                          <Check className="w-4 h-4 text-accent" />
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Confirm & Edit before ingest */}
          {(step === "confirm" || step === "ingesting") && selectedCandidate && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Confirm &amp; Ingest</h3>
                  <p className="text-xs text-tertiary mt-0.5">
                    Review the selected game and edit the title if needed before ingesting
                    {selectedCandidate.source !== "rawg" && (
                      <span className="text-yellow-400/80"> — mobile store data will be fetched automatically</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setStep("candidates")}
                  disabled={step === "ingesting"}
                  className="flex items-center gap-1.5 text-xs text-secondary hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Results
                </button>
              </div>

              {/* Selected game card */}
              <div className="flex gap-4 p-4 rounded-xl border border-accent/30 bg-accent/[0.03]">
                <div className={`rounded-lg overflow-hidden bg-surface-2 shrink-0 relative ${selectedCandidate.source !== "rawg" ? "w-20 h-20 sm:w-24 sm:h-24" : "w-24 h-32 sm:w-28 sm:h-36"}`}>
                  {(selectedCandidate.backgroundImage || selectedCandidate.icon) ? (
                    <Image
                      src={(selectedCandidate.backgroundImage || selectedCandidate.icon)!}
                      alt={selectedCandidate.name}
                      fill
                      className={selectedCandidate.source !== "rawg" ? "object-contain p-1" : "object-cover"}
                      sizes="112px"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-tertiary">
                      <Gamepad2 className="w-10 h-10" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start gap-2 flex-wrap">
                    <h4 className="text-base font-bold text-foreground">{selectedCandidate.name}</h4>
                    <span className={`shrink-0 px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wider ${SOURCE_COLORS[selectedCandidate.source]}`}>
                      {SOURCE_LABELS[selectedCandidate.source]}
                    </span>
                  </div>
                  {selectedCandidate.developer && (
                    <p className="text-xs text-secondary">by {selectedCandidate.developer}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary">
                    {selectedCandidate.released && (
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {selectedCandidate.released}</span>
                    )}
                    {selectedCandidate.rating != null && selectedCandidate.rating > 0 && (
                      <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500" /> {selectedCandidate.rating.toFixed(1)}</span>
                    )}
                    {selectedCandidate.score != null && selectedCandidate.score > 0 && (
                      <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500" /> {selectedCandidate.score.toFixed(1)}/5</span>
                    )}
                    {selectedCandidate.metacritic && (
                      <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent font-semibold text-[10px]">MC {selectedCandidate.metacritic}</span>
                    )}
                    {selectedCandidate.installs && (
                      <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {selectedCandidate.installs}</span>
                    )}
                  </div>
                  {selectedCandidate.platforms.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedCandidate.platforms.map((p) => (
                        <span key={p} className="px-1.5 py-0.5 rounded bg-white/5 border border-border text-[10px] text-tertiary">{p}</span>
                      ))}
                    </div>
                  )}
                  {selectedCandidate.genres.length > 0 && (
                    <p className="text-[11px] text-tertiary">{selectedCandidate.genres.join(", ")}</p>
                  )}
                  {/* Source-specific link */}
                  {selectedCandidate.source === "rawg" && (
                    <a
                      href={`https://rawg.io/games/${selectedCandidate.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                    >
                      View on RAWG <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {selectedCandidate.storeUrl && (
                    <a
                      href={selectedCandidate.storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                    >
                      View on {SOURCE_LABELS[selectedCandidate.source]} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Editable title */}
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">
                  Ingest Title <span className="text-tertiary">(edit if needed)</span>
                </label>
                <input
                  value={editedTitle}
                  onChange={e => setEditedTitle(e.target.value)}
                  className={inputCls}
                  disabled={step === "ingesting"}
                />
              </div>

              {/* Ingest button */}
              <button
                onClick={handleIngest}
                disabled={loading || step === "ingesting"}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {step === "ingesting" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {selectedCandidate.source === "rawg" ? "Ingesting & Enriching..." : "Creating from Store Data..."}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {selectedCandidate.source === "rawg" ? "Confirm & Ingest Game" : `Create from ${SOURCE_LABELS[selectedCandidate.source]}`}
                  </>
                )}
              </button>
            </div>
          )}

          {/* Status Messages */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 rounded-xl bg-success/10 border border-success/20 px-4 py-3 text-sm text-success">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ URL MODE ═══════════ */}
      {mode === "url" && (
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-5">
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
                className={inputCls}
              />
            </div>
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 rounded-xl bg-success/10 border border-success/20 px-4 py-3 text-sm text-success">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /><span>{success}</span>
            </div>
          )}
          <button
            onClick={handleOtherSubmit}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Import from URL
          </button>
        </div>
      )}

      {/* ═══════════ PROVISIONAL MODE ═══════════ */}
      {mode === "provisional" && (
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-5">
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
                  className={inputCls}
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
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">Developer</label>
                <input
                  value={form.developer}
                  onChange={e => setForm(f => ({ ...f, developer: e.target.value }))}
                  placeholder="Studio name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">Publisher</label>
                <input
                  value={form.publisher}
                  onChange={e => setForm(f => ({ ...f, publisher: e.target.value }))}
                  placeholder="Publisher name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">Release Date</label>
                <input
                  type="date"
                  value={form.releaseDate}
                  onChange={e => setForm(f => ({ ...f, releaseDate: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">Release Status</label>
                <select
                  value={form.releaseStatus}
                  onChange={e => setForm(f => ({ ...f, releaseStatus: e.target.value }))}
                  className={inputCls}
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
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Brief game description..."
                className={`${inputCls} resize-none`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">Cover Image URL</label>
              <input
                value={form.coverImage}
                onChange={e => setForm(f => ({ ...f, coverImage: e.target.value }))}
                placeholder="https://..."
                className={inputCls}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 rounded-xl bg-success/10 border border-success/20 px-4 py-3 text-sm text-success">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /><span>{success}</span>
            </div>
          )}

          <button
            onClick={handleOtherSubmit}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileEdit className="w-4 h-4" />}
            Create Provisional Page
          </button>
        </div>
      )}
    </div>
  );
}

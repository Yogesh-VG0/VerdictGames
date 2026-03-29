"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Save, Eye, EyeOff, Star, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const VERDICT_OPTIONS = ["MUST PLAY", "WORTH IT", "MIXED", "SKIP", "COMING SOON"];

async function fetchEditorialReview(id: string) {
  const res = await fetch(`/api/admin/editorial-reviews/${id}`);
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error ?? "Failed to fetch review");
}

async function updateEditorialReview(id: string, data: Record<string, unknown>) {
  const res = await fetch(`/api/admin/editorial-reviews/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.error ?? "Failed to update review");
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

export default function EditEditorialReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [saveMsg, setSaveMsg] = useState("");

  const review = useQuery({
    queryKey: ["admin-editorial-review", id],
    queryFn: () => fetchEditorialReview(id),
  });

  const [form, setForm] = useState({
    title: "",
    content: "",
    score: null as number | null,
    verdict_label: "",
    pros: [] as string[],
    cons: [] as string[],
    playtime_hours: null as number | null,
    platform_played: "",
    version_reviewed: "",
    is_published: false,
    is_featured: false,
  });

  const [prosText, setProsText] = useState("");
  const [consText, setConsText] = useState("");

  useEffect(() => {
    if (review.data) {
      const r = review.data;
      setForm({
        title: r.title || "",
        content: r.content || "",
        score: r.score,
        verdict_label: r.verdict_label || "",
        pros: r.pros || [],
        cons: r.cons || [],
        playtime_hours: r.playtime_hours,
        platform_played: r.platform_played || "",
        version_reviewed: r.version_reviewed || "",
        is_published: r.is_published,
        is_featured: r.is_featured,
      });
      setProsText((r.pros || []).join("\n"));
      setConsText((r.cons || []).join("\n"));
    }
  }, [review.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const pros = prosText.split("\n").map((s) => s.trim()).filter(Boolean);
      const cons = consText.split("\n").map((s) => s.trim()).filter(Boolean);
      return updateEditorialReview(id, { ...form, pros, cons });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-editorial-review", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-editorial-reviews"] });
      setSaveMsg("Saved successfully!");
      setTimeout(() => setSaveMsg(""), 3000);
    },
    onError: (err) => {
      setSaveMsg("Error: " + (err as Error).message);
    },
  });

  const setField = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  if (review.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-white/5 rounded-lg animate-pulse w-1/3" />
        <div className="h-64 bg-white/5 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!review.data) {
    return <p className="text-secondary text-sm">Editorial review not found</p>;
  }

  const game = review.data.games;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          {game.cover_image && (
            <div className="w-16 h-20 rounded-xl overflow-hidden bg-surface-2 shrink-0 relative">
              <Image src={game.cover_image} alt="" fill className="object-cover" sizes="64px" />
            </div>
          )}
          <div>
            <Link href="/admin/editorial" className="text-xs text-tertiary hover:text-accent transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              Back to Editorial Reviews
            </Link>
            <div className="flex items-center gap-2 mt-0.5">
              <h1 className="text-xl font-bold text-foreground">{game.title}</h1>
              <Link
                href={`/game/${game.slug}`}
                target="_blank"
                className="text-secondary hover:text-accent transition-colors"
                title="View game page"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
            <p className="text-xs text-tertiary">Editorial Review</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => {
              setField("is_published", !form.is_published);
            }}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5",
              form.is_published
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : "bg-surface-2 text-secondary border border-border"
            )}
          >
            {form.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {form.is_published ? "Published" : "Draft"}
          </button>
          <button
            onClick={() => {
              setField("is_featured", !form.is_featured);
            }}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5",
              form.is_featured
                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/20"
                : "bg-surface-2 text-secondary border border-border"
            )}
          >
            <Star className="w-4 h-4" />
            {form.is_featured ? "Featured" : "Feature"}
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-accent text-white shadow-sm shadow-accent/20 hover:bg-accent-hover transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
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

        <Field label="Review Content">
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
      </div>
    </div>
  );
}

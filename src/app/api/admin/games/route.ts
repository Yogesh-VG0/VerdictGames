import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { mapGameRow } from "@/lib/db/mappers";
import type { GameRow } from "@/lib/supabase/types";
import { slugify } from "@/lib/utils/slugify";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const supabase = getServerSupabase();
  const params = request.nextUrl.searchParams;
  const q = params.get("q") ?? "";
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));
  const limit = 20;
  const offset = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = supabase.from("games").select("*", { count: "exact" }) as any;

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  query = query.order("updated_at", { ascending: false }).range(offset, offset + limit - 1);
  const { data, count } = await query;

  return jsonOk({
    games: ((data ?? []) as GameRow[]).map(mapGameRow),
    total: count ?? 0,
    page,
    pageSize: limit,
  });
}

/** POST — Create a new game (3 modes: provisional, lookup, manual) */
export async function POST(request: NextRequest) {
  const { user, error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const body = await request.json();
  const supabase = getServerSupabase();

  // Mode 1: Ingest via title lookup
  if (body.mode === "lookup" && body.title) {
    const { ingestGame } = await import("@/lib/services/ingest");
    const result = await ingestGame({ query: body.title });
    if (result.success) {
      return jsonOk({ gameId: result.gameId, slug: result.slug, message: result.message });
    }
    return jsonError(result.message, 400);
  }

  // Mode 2: Ingest via source URL (extract title from URL slug)
  if (body.mode === "url" && body.url) {
    const urlSlug = new URL(body.url).pathname.split("/").pop() ?? "";
    const title = urlSlug.replace(/-/g, " ").replace(/_/g, " ");
    if (!title) return jsonError("Could not extract title from URL", 400);
    const { ingestGame } = await import("@/lib/services/ingest");
    const result = await ingestGame({ query: title });
    if (result.success) {
      return jsonOk({ gameId: result.gameId, slug: result.slug, message: result.message });
    }
    return jsonError(result.message, 400);
  }

  // Mode 3: Create provisional/manual entry
  if (!body.title) return jsonError("Title is required", 400);

  const slug = body.slug || slugify(body.title);

  // Duplicate check: slug
  const { data: existingSlug } = await supabase
    .from("games")
    .select("id, slug, title")
    .eq("slug", slug)
    .maybeSingle();
  if (existingSlug) {
    return jsonError(`A game with slug "${slug}" already exists: "${(existingSlug as { title: string }).title}"`, 409);
  }

  // Duplicate check: normalized title
  const normalTitle = body.title.toLowerCase().replace(/[^a-z0-9]/g, "");
  const { data: existingTitle } = await supabase
    .from("games")
    .select("id, slug, title")
    .ilike("title", body.title)
    .maybeSingle();
  if (existingTitle && slugify((existingTitle as { title: string }).title).replace(/-/g, "") === normalTitle) {
    return jsonError(`A game with title "${(existingTitle as { title: string }).title}" already exists`, 409);
  }

  const record = {
    slug,
    title: body.title,
    subtitle: body.subtitle || null,
    cover_image: body.coverImage || "",
    header_image: body.headerImage || "",
    screenshots: body.screenshots || [],
    platforms: body.platforms || [],
    genres: body.genres || [],
    tags: body.tags || [],
    developer: body.developer || "",
    publisher: body.publisher || "",
    release_date: body.releaseDate || null,
    description: body.description || "This game page is awaiting data enrichment.",
    score: 0,
    verdict_label: "COMING SOON",
    verdict_summary: "",
    pros: [],
    cons: [],
    monetization: "",
    performance_notes: "",
    monetization_notes: "",
    review_count: 0,
    featured: false,
    trending: false,
    score_source: "provisional",
    enrichment_sources: [],
    price_currency: "USD",
    is_free: false,
    is_provisional: true,
    release_status: body.releaseStatus || "upcoming",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (supabase.from("games") as any)
    .insert(record)
    .select("*")
    .single() as { data: GameRow | null; error: { message: string } | null };

  if (error || !inserted) {
    return jsonError("Failed to create game: " + (error?.message ?? "Unknown error"), 500);
  }

  // Write audit log
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("admin_audit_log") as any).insert({
      entity_type: "game",
      entity_id: inserted.id,
      action: "create",
      field_changes: { title: { old: null, new: body.title }, mode: body.mode || "provisional" },
      edited_by: user?.email ?? "unknown",
    });
  } catch { /* audit log write is best-effort */ }

  return jsonOk({ gameId: inserted.id, slug: inserted.slug, message: `Game "${body.title}" created successfully.` });
}

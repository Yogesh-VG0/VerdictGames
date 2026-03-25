/**
 * VERDICT.GAMES — Admin: Backfill v2 Scores
 *
 * POST /api/admin/backfill-scores
 *
 * Recomputes community_score, critic_score, confidence, and verdict_score
 * for all existing games in the database using the new scoring engine.
 *
 * For games WITH Steam review data (review_count > 0 + score_source = 'steam'):
 *   Uses the stored score as the Steam positive %, reconstructs approximate
 *   positive/total counts, and applies Wilson Lower Bound.
 *
 * For games WITHOUT Steam data:
 *   Uses RAWG rating as a proxy for community score via Wilson LB.
 *
 * Critic score is always computed from igdb_rating + rawg_metacritic.
 *
 * This is idempotent — safe to run multiple times.
 */

import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import {
  computeCommunityScore,
  computeCriticScore,
  computeConfidence,
  computeVerdictScore,
  getVerdictLabel,
  rawgRatingToPositiveRatio,
} from "@/lib/utils/scoring";

export async function POST() {
  // Require admin authentication
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const supabase = getServerSupabase();

  // Fetch ALL games — paginate to bypass Supabase's default 1000 row limit
  const PAGE_SIZE = 1000;
  const games: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("games")
      .select("id, title, score, score_source, review_count, igdb_rating, rawg_metacritic, rawg_rating, steam_app_id, steam_positive_count, steam_total_count, release_date, verdict_label")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) break;
    games.push(...data);
    if (data.length < PAGE_SIZE) break; // last page
    from += PAGE_SIZE;
  }

  if (games.length === 0) {
    return NextResponse.json({ message: "No games found", updated: 0 });
  }

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];
  const examples: { title: string; old: number; new: number; confidence: number; label: string }[] = [];

  // Process in batches of 50 to avoid overwhelming the DB
  const BATCH_SIZE = 50;

  for (let i = 0; i < games.length; i += BATCH_SIZE) {
    const batch = games.slice(i, i + BATCH_SIZE);
    const updates = [];

    for (const game of batch) {
      try {
        const reviewCount = game.review_count ?? 0;
        const oldScore = game.score ?? 0;

        // ── Community Score ──
        let communityScore: number | null = null;
        let steamPositiveCount = game.steam_positive_count ?? null;
        let steamTotalCount = game.steam_total_count ?? null;

        if (steamPositiveCount != null && steamTotalCount != null && steamTotalCount > 0) {
          // Have actual Steam counts from v2 ingest
          communityScore = computeCommunityScore(steamPositiveCount, steamTotalCount);
        } else if (game.score_source === "steam" && reviewCount > 0 && oldScore > 0) {
          // Reconstruct approximate Steam counts from legacy score + review_count
          // score = round(positive / total * 100), so positive ≈ score/100 * total
          steamTotalCount = reviewCount;
          steamPositiveCount = Math.round((oldScore / 100) * reviewCount);
          communityScore = computeCommunityScore(steamPositiveCount, steamTotalCount);
        } else if (game.rawg_rating && reviewCount > 0) {
          // RAWG rating fallback
          const { positive, total } = rawgRatingToPositiveRatio(game.rawg_rating, reviewCount);
          communityScore = computeCommunityScore(positive, total);
        }

        // ── Critic Score ──
        const { score: criticScore, sourceCount: criticSourceCount } = computeCriticScore(
          game.igdb_rating ?? null,
          game.rawg_metacritic ?? null
        );

        // ── Confidence ──
        const hasSteamData = game.steam_app_id != null || game.score_source === "steam";
        const confidence = computeConfidence(reviewCount, criticSourceCount, hasSteamData);

        // ── Verdict Score ──
        const verdictScoreValue = computeVerdictScore(communityScore, criticScore, confidence);

        // ── Verdict Label ──
        const releaseDate = game.release_date ?? null;
        const isUpcoming = releaseDate ? new Date(releaseDate) > new Date() : false;
        const isJustReleased = releaseDate
          ? (Date.now() - new Date(releaseDate).getTime()) < 14 * 86400000 && reviewCount < 20
          : false;

        const newLabel = isUpcoming
          ? "COMING SOON"
          : isJustReleased
            ? "JUST RELEASED"
            : verdictScoreValue > 0
              ? getVerdictLabel(verdictScoreValue, confidence, false, false)
              : game.verdict_label;

        updates.push({
          id: game.id,
          steam_positive_count: steamPositiveCount,
          steam_total_count: steamTotalCount,
          community_score: communityScore,
          critic_score: criticScore,
          critic_source_count: criticSourceCount,
          confidence,
          verdict_score: verdictScoreValue > 0 ? verdictScoreValue : null,
          // Also update the legacy score field so DB queries that filter by score still work
          score: verdictScoreValue > 0 ? verdictScoreValue : oldScore,
          verdict_label: newLabel,
        });

        // Collect examples for the response (first 20 + any big changes)
        if (examples.length < 20 || Math.abs((verdictScoreValue || oldScore) - oldScore) > 10) {
          if (examples.length < 50) {
            examples.push({
              title: game.title,
              old: oldScore,
              new: verdictScoreValue || oldScore,
              confidence: Math.round(confidence * 100) / 100,
              label: newLabel,
            });
          }
        }
      } catch (err) {
        errors.push(`${game.title}: ${err instanceof Error ? err.message : String(err)}`);
        skipped++;
      }
    }

    // Execute batch updates
    for (const update of updates) {
      const { id, ...fields } = update;
      const { error: updateError } = await supabase
        .from("games")
        .update(fields)
        .eq("id", id);

      if (updateError) {
        errors.push(`Update ${update.id}: ${updateError.message}`);
        skipped++;
      } else {
        updated++;
      }
    }
  }

  return NextResponse.json({
    message: `Backfill complete: ${updated} updated, ${skipped} skipped`,
    updated,
    skipped,
    total: games.length,
    errors: errors.slice(0, 20),
    examples: examples.slice(0, 30),
  });
}

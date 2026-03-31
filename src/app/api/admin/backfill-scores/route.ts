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
  resolveCommunityEvidenceSource,
} from "@/lib/utils/scoring";

export async function POST(request: Request) {
  // Require admin authentication
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const supabase = getServerSupabase();

  // Support ?force=true to re-score ALL games (not just unscored)
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";
  const CHUNK = 200; // stay well within Vercel's 10s timeout

  // Fetch a chunk of games — only unscored unless force=true
  let query = supabase
    .from("games")
    .select("id, title, score, score_source, review_count, igdb_rating, rawg_metacritic, rawg_rating, steam_app_id, steam_positive_count, steam_total_count, release_date, verdict_label")
    .order("id")
    .limit(CHUNK);

  if (!force) {
    query = query.is("verdict_score", null);
  }

  const { data: games, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!games || games.length === 0) {
    // Count total to confirm all scored
    const { count } = await supabase
      .from("games")
      .select("id", { count: "exact", head: true });
    const { count: scored } = await supabase
      .from("games")
      .select("id", { count: "exact", head: true })
      .not("verdict_score", "is", null);
    return NextResponse.json({
      message: "All games scored!",
      updated: 0,
      remaining: 0,
      totalGames: count,
      totalScored: scored,
    });
  }

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Compute scores for all games in this chunk
  const updatePromises: PromiseLike<void>[] = [];

  for (const game of games) {
    try {
      const reviewCount = game.review_count ?? 0;
      const oldScore = game.score ?? 0;

      // ── Community Score ──
      let communityScore: number | null = null;
      let steamPositiveCount = game.steam_positive_count ?? null;
      let steamTotalCount = game.steam_total_count ?? null;

      if (steamPositiveCount != null && steamTotalCount != null && steamTotalCount > 0) {
        communityScore = computeCommunityScore(steamPositiveCount, steamTotalCount);
      } else if (game.score_source === "steam" && reviewCount > 0 && oldScore > 0) {
        steamTotalCount = reviewCount;
        steamPositiveCount = Math.round((oldScore / 100) * reviewCount);
        communityScore = computeCommunityScore(steamPositiveCount, steamTotalCount);
      } else if (game.rawg_rating && reviewCount > 0) {
        const { positive, total } = rawgRatingToPositiveRatio(game.rawg_rating, reviewCount);
        communityScore = computeCommunityScore(positive, total);
      }

      // ── Critic Score ──
      const { score: criticScore, sourceCount: criticSourceCount } = computeCriticScore(
        game.igdb_rating ?? null,
        game.rawg_metacritic ?? null
      );

      // ── Confidence ──
      const communitySource = resolveCommunityEvidenceSource({
        steamTotalCount: steamTotalCount,
        hasSteamData: game.steam_app_id != null || game.score_source === "steam",
        rawgRating: game.rawg_rating ?? null,
        reviewCount,
      });
      const confidence = computeConfidence(reviewCount, criticSourceCount, communitySource);

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

      const fields = {
        steam_positive_count: steamPositiveCount,
        steam_total_count: steamTotalCount,
        community_score: communityScore,
        critic_score: criticScore,
        critic_source_count: criticSourceCount,
        confidence,
        verdict_score: verdictScoreValue > 0 ? verdictScoreValue : 0,
        score: verdictScoreValue > 0 ? verdictScoreValue : oldScore,
        verdict_label: newLabel,
      };

      // Queue the update — run up to 10 in parallel
      updatePromises.push(
        supabase
          .from("games")
          .update(fields)
          .eq("id", game.id)
          .then(({ error: updateError }) => {
            if (updateError) {
              errors.push(`${game.title}: ${updateError.message}`);
              skipped++;
            } else {
              updated++;
            }
          })
      );

      // Flush every 10 to limit concurrency
      if (updatePromises.length >= 10) {
        await Promise.all(updatePromises);
        updatePromises.length = 0;
      }
    } catch (err) {
      errors.push(`${game.title}: ${err instanceof Error ? err.message : String(err)}`);
      skipped++;
    }
  }

  // Flush remaining
  if (updatePromises.length > 0) {
    await Promise.all(updatePromises);
  }

  // Count remaining unscored games
  const { count: remaining } = await supabase
    .from("games")
    .select("id", { count: "exact", head: true })
    .is("verdict_score", null);

  return NextResponse.json({
    message: remaining
      ? `Backfill chunk done: ${updated} updated. ${remaining} remaining — run again!`
      : `Backfill complete: ${updated} updated. All games scored!`,
    updated,
    skipped,
    remaining: remaining ?? 0,
    errors: errors.slice(0, 10),
  });
}

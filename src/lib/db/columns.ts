/**
 * VERDICT.GAMES — Shared Column Selection Constants
 *
 * Avoids `select("*")` on the games table which transfers 60+ columns
 * including large text fields (description, performance_notes, etc.).
 * Card/list contexts only need ~30 display-critical columns.
 */

/**
 * Columns needed for game card display (homepage, search, lists, library, calendar, recommendations).
 * Excludes heavy columns only used on the game detail page:
 * - description, performance_notes, monetization_notes, wikipedia_excerpt, igdb_summary
 * - screenshots, pros, cons
 * - Various external URLs and IDs
 */
export const GAME_CARD_COLUMNS = [
  "id", "slug", "title", "subtitle",
  "cover_image", "header_image",
  "platforms", "genres", "tags",
  "developer", "publisher", "release_date",
  "score", "verdict_score", "verdict_label", "verdict_summary",
  "confidence", "review_count", "monetization",
  "price_current", "price_currency", "is_free", "price_deal_url", "price_lowest",
  "current_players", "peak_players_24h", "momentum",
  "trending", "featured", "is_featured_manual", "is_trending_manual",
  "is_provisional", "release_status",
  "community_score", "critic_score", "score_source",
  "user_score", "steam_rating_label",
  "rawg_metacritic", "rawg_rating",
  "steam_app_id",
  "created_at", "updated_at",
].join(",");

/**
 * Same as GAME_CARD_COLUMNS but also includes description (needed for quality filtering).
 * Used by endpoints that run isQualityGame() / filterQualityGames() on the result.
 */
export const GAME_CARD_COLUMNS_WITH_DESC = GAME_CARD_COLUMNS + ",description";

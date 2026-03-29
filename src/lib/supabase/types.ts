/**
 * VERDICT.GAMES — Supabase Database Types
 *
 * Generated from the SQL schema. Provides type safety for all queries.
 * Regenerate with `npx supabase gen types typescript` when schema changes.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      games: {
        Row: {
          id: string;
          slug: string;
          title: string;
          subtitle: string | null;
          cover_image: string;
          header_image: string;
          screenshots: string[];
          platforms: string[];
          genres: string[];
          tags: string[];
          developer: string;
          publisher: string;
          release_date: string | null;
          description: string;
          score: number;
          verdict_label: string;
          verdict_summary: string;
          pros: string[];
          cons: string[];
          monetization: string;
          performance_notes: string;
          monetization_notes: string;
          steam_url: string | null;
          play_store_url: string | null;
          review_count: number;
          user_score: number | null;
          featured: boolean;
          trending: boolean;
          rawg_id: number | null;
          steam_app_id: number | null;

          // Multi-source fields (migration 001)
          price_current: number | null;
          price_currency: string;
          price_lowest: number | null;
          price_deal_url: string | null;
          is_free: boolean;
          current_players: number | null;
          peak_players_24h: number | null;
          players_updated_at: string | null;
          trailer_url: string | null;
          trailer_thumbnail: string | null;
          igdb_id: number | null;
          igdb_url: string | null;
          igdb_rating: number | null;
          igdb_summary: string | null;
          wikipedia_url: string | null;
          wikipedia_excerpt: string | null;
          metacritic_url: string | null;
          website_url: string | null;
          reddit_url: string | null;
          cheapshark_id: string | null;
          steam_rating_label: string | null;
          rawg_metacritic: number | null;
          rawg_rating: number | null;
          score_source: string;
          last_enriched_at: string | null;
          is_refreshing?: boolean;
          refresh_started_at?: string | null;
          enrichment_sources: string[];

          // HLTB fields (migration 004)
          hltb_main: number | null;
          hltb_extras: number | null;
          hltb_completionist: number | null;
          hltb_last_fetched: string | null;
          franchise: string | null;

          // Momentum tracking (migration 002)
          momentum: number;

          // Admin overrides (migration 006)
          is_featured_manual: boolean;
          is_trending_manual: boolean;
          manual_score: number | null;

          // Provisional/upcoming fields (migration 009)
          is_provisional: boolean;
          release_status: string | null;

          // Verdict Scoring v2 (migration 015)
          steam_positive_count: number | null;
          steam_total_count: number | null;
          community_score: number | null;
          critic_score: number | null;
          critic_source_count: number;
          confidence: number;
          verdict_score: number | null;

          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          subtitle?: string | null;
          cover_image: string;
          header_image: string;
          screenshots: string[];
          platforms: string[];
          genres: string[];
          tags: string[];
          developer: string;
          publisher: string;
          release_date?: string | null;
          description: string;
          score: number;
          verdict_label: string;
          verdict_summary: string;
          pros: string[];
          cons: string[];
          monetization: string;
          performance_notes: string;
          monetization_notes: string;
          steam_url?: string | null;
          play_store_url?: string | null;
          review_count: number;
          user_score?: number | null;
          featured: boolean;
          trending: boolean;
          rawg_id?: number | null;
          steam_app_id?: number | null;
          price_current?: number | null;
          price_currency: string;
          price_lowest?: number | null;
          price_deal_url?: string | null;
          is_free: boolean;
          current_players?: number | null;
          peak_players_24h?: number | null;
          players_updated_at?: string | null;
          trailer_url?: string | null;
          trailer_thumbnail?: string | null;
          igdb_id?: number | null;
          igdb_url?: string | null;
          igdb_rating?: number | null;
          igdb_summary?: string | null;
          wikipedia_url?: string | null;
          wikipedia_excerpt?: string | null;
          metacritic_url?: string | null;
          website_url?: string | null;
          reddit_url?: string | null;
          cheapshark_id?: string | null;
          steam_rating_label?: string | null;
          rawg_metacritic?: number | null;
          rawg_rating?: number | null;
          score_source: string;
          last_enriched_at?: string | null;
          enrichment_sources: string[];
          hltb_main?: number | null;
          hltb_extras?: number | null;
          hltb_completionist?: number | null;
          hltb_last_fetched?: string | null;
          franchise?: string | null;
          momentum?: number;
          is_featured_manual?: boolean;
          is_trending_manual?: boolean;
          manual_score?: number | null;
          is_provisional?: boolean;
          release_status?: string | null;
          // Verdict Scoring v2 (migration 015)
          steam_positive_count?: number | null;
          steam_total_count?: number | null;
          community_score?: number | null;
          critic_score?: number | null;
          critic_source_count?: number;
          confidence?: number;
          verdict_score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          subtitle?: string | null;
          cover_image?: string;
          header_image?: string;
          screenshots?: string[];
          platforms?: string[];
          genres?: string[];
          tags?: string[];
          developer?: string;
          publisher?: string;
          release_date?: string | null;
          description?: string;
          score?: number;
          verdict_label?: string;
          verdict_summary?: string;
          pros?: string[];
          cons?: string[];
          monetization?: string;
          performance_notes?: string;
          monetization_notes?: string;
          steam_url?: string | null;
          play_store_url?: string | null;
          review_count?: number;
          user_score?: number | null;
          featured?: boolean;
          trending?: boolean;
          rawg_id?: number | null;
          steam_app_id?: number | null;
          price_current?: number | null;
          price_currency?: string;
          price_lowest?: number | null;
          price_deal_url?: string | null;
          is_free?: boolean;
          current_players?: number | null;
          peak_players_24h?: number | null;
          players_updated_at?: string | null;
          trailer_url?: string | null;
          trailer_thumbnail?: string | null;
          igdb_id?: number | null;
          igdb_url?: string | null;
          igdb_rating?: number | null;
          igdb_summary?: string | null;
          wikipedia_url?: string | null;
          wikipedia_excerpt?: string | null;
          metacritic_url?: string | null;
          website_url?: string | null;
          reddit_url?: string | null;
          cheapshark_id?: string | null;
          steam_rating_label?: string | null;
          rawg_metacritic?: number | null;
          rawg_rating?: number | null;
          score_source?: string;
          last_enriched_at?: string | null;
          is_refreshing?: boolean;
          refresh_started_at?: string | null;
          enrichment_sources?: string[];
          hltb_main?: number | null;
          hltb_extras?: number | null;
          hltb_completionist?: number | null;
          hltb_last_fetched?: string | null;
          franchise?: string | null;
          momentum?: number;
          is_featured_manual?: boolean;
          is_trending_manual?: boolean;
          manual_score?: number | null;
          is_provisional?: boolean;
          release_status?: string | null;
          // Verdict Scoring v2 (migration 015)
          steam_positive_count?: number | null;
          steam_total_count?: number | null;
          community_score?: number | null;
          critic_score?: number | null;
          critic_source_count?: number;
          confidence?: number;
          verdict_score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_audit_log: {
        Row: {
          id: string;
          entity_type: string;
          entity_id: string;
          action: string;
          field_changes: Json;
          edited_by: string | null;
          edited_at: string;
          reason: string | null;
        };
        Insert: {
          id?: string;
          entity_type: string;
          entity_id: string;
          action: string;
          field_changes?: Json;
          edited_by?: string | null;
          edited_at?: string;
          reason?: string | null;
        };
        Update: {
          id?: string;
          entity_type?: string;
          entity_id?: string;
          action?: string;
          field_changes?: Json;
          edited_by?: string | null;
          edited_at?: string;
          reason?: string | null;
        };
        Relationships: [];
      };
      editorial_reviews: {
        Row: {
          id: string;
          game_id: string;
          author_id: string;
          title: string | null;
          content: string;
          score: number | null;
          verdict_label: string | null;
          pros: string[];
          cons: string[];
          playtime_hours: number | null;
          platform_played: string | null;
          version_reviewed: string | null;
          is_published: boolean;
          is_featured: boolean;
          created_at: string;
          updated_at: string;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          game_id: string;
          author_id: string;
          title?: string | null;
          content: string;
          score?: number | null;
          verdict_label?: string | null;
          pros?: string[];
          cons?: string[];
          playtime_hours?: number | null;
          platform_played?: string | null;
          version_reviewed?: string | null;
          is_published?: boolean;
          is_featured?: boolean;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          game_id?: string;
          author_id?: string;
          title?: string | null;
          content?: string;
          score?: number | null;
          verdict_label?: string | null;
          pros?: string[];
          cons?: string[];
          playtime_hours?: number | null;
          platform_played?: string | null;
          version_reviewed?: string | null;
          is_published?: boolean;
          is_featured?: boolean;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
        };
        Relationships: [];
      };
      game_sources: {
        Row: {
          id: string;
          game_id: string;
          source_name: string;
          source_game_id: string;
          source_url: string | null;
          last_synced_at: string;
          raw_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          source_name: string;
          source_game_id: string;
          source_url?: string | null;
          last_synced_at?: string;
          raw_data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          source_name?: string;
          source_game_id?: string;
          source_url?: string | null;
          last_synced_at?: string;
          raw_data?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          game_id: string;
          profile_id: string;
          rating: number;
          title: string;
          body: string;
          pros: string[];
          cons: string[];
          platform: string;
          helpful: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          profile_id: string;
          rating: number;
          title: string;
          body: string;
          pros: string[];
          cons: string[];
          platform: string;
          helpful?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          profile_id?: string;
          rating?: number;
          title?: string;
          body?: string;
          pros?: string[];
          cons?: string[];
          platform?: string;
          helpful?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      review_comments: {
        Row: {
          id: string;
          review_id: string;
          profile_id: string;
          body: string;
          parent_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          review_id: string;
          profile_id: string;
          body: string;
          parent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          review_id?: string;
          profile_id?: string;
          body?: string;
          parent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      review_votes: {
        Row: {
          id: string;
          review_id: string;
          profile_id: string;
          value: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          review_id: string;
          profile_id: string;
          value: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          review_id?: string;
          profile_id?: string;
          value?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      lists: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string;
          cover_image: string;
          curated_by: string;
          tags: string[];
          owner_id: string | null;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description: string;
          cover_image: string;
          curated_by: string;
          tags: string[];
          owner_id?: string | null;
          is_public: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          description?: string;
          cover_image?: string;
          curated_by?: string;
          tags?: string[];
          owner_id?: string | null;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      list_items: {
        Row: {
          id: string;
          list_id: string;
          game_id: string;
          position: number;
          added_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          game_id: string;
          position: number;
          added_at?: string;
        };
        Update: {
          id?: string;
          list_id?: string;
          game_id?: string;
          position?: number;
          added_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          auth_id: string | null;
          username: string;
          display_name: string;
          avatar_url: string;
          bio: string;
          favorite_genres: string[];
          role: string;
          joined_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_id?: string | null;
          username: string;
          display_name: string;
          avatar_url: string;
          bio: string;
          favorite_genres: string[];
          role?: string;
          joined_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_id?: string | null;
          username?: string;
          display_name?: string;
          avatar_url?: string;
          bio?: string;
          favorite_genres?: string[];
          joined_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_games: {
        Row: {
          id: string;
          user_id: string;
          game_id: string;
          status: string;
          personal_rating: number | null;
          hours_played: number;
          notes: string;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          game_id: string;
          status: string;
          personal_rating?: number | null;
          hours_played?: number;
          notes?: string;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          game_id?: string;
          status?: string;
          personal_rating?: number | null;
          hours_played?: number;
          notes?: string;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      follows: {
        Row: {
          id: string;
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          follower_id?: string;
          following_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      player_snapshots: {
        Row: {
          id: string;
          game_id: string;
          player_count: number;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          player_count: number;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          player_count?: number;
          recorded_at?: string;
        };
        Relationships: [];
      };
      steam_reviews: {
        Row: {
          id: string;
          game_id: string;
          steam_app_id: number;
          recommendation_id: string;
          language: string;
          voted_up: boolean;
          review_text: string;
          playtime_at_review: number;
          playtime_forever: number;
          author_steam_id: string | null;
          author_playtime_forever: number;
          authored_at: string | null;
          updated_at: string | null;
          votes_up: number;
          votes_funny: number;
          weighted_vote_score: number;
          steam_purchase: boolean;
          received_for_free: boolean;
          fetched_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          steam_app_id: number;
          recommendation_id: string;
          language?: string;
          voted_up: boolean;
          review_text: string;
          playtime_at_review?: number;
          playtime_forever?: number;
          author_steam_id?: string | null;
          author_playtime_forever?: number;
          authored_at?: string | null;
          updated_at?: string | null;
          votes_up?: number;
          votes_funny?: number;
          weighted_vote_score?: number;
          steam_purchase?: boolean;
          received_for_free?: boolean;
          fetched_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          steam_app_id?: number;
          recommendation_id?: string;
          language?: string;
          voted_up?: boolean;
          review_text?: string;
          playtime_at_review?: number;
          playtime_forever?: number;
          author_steam_id?: string | null;
          author_playtime_forever?: number;
          authored_at?: string | null;
          updated_at?: string | null;
          votes_up?: number;
          votes_funny?: number;
          weighted_vote_score?: number;
          steam_purchase?: boolean;
          received_for_free?: boolean;
          fetched_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      ingest_runs: {
        Row: {
          id: string;
          run_type: string;
          status: string;
          started_at: string;
          finished_at: string | null;
          games_processed: number;
          games_created: number;
          games_updated: number;
          errors: number;
          error_details: Json;
          metadata: Json;
        };
        Insert: {
          id?: string;
          run_type: string;
          status?: string;
          started_at?: string;
          finished_at?: string | null;
          games_processed?: number;
          games_created?: number;
          games_updated?: number;
          errors?: number;
          error_details?: Json;
          metadata?: Json;
        };
        Update: {
          id?: string;
          run_type?: string;
          status?: string;
          started_at?: string;
          finished_at?: string | null;
          games_processed?: number;
          games_created?: number;
          games_updated?: number;
          errors?: number;
          error_details?: Json;
          metadata?: Json;
        };
        Relationships: [];
      };
      mobile_store_listings: {
        Row: {
          id: string;
          game_id: string;
          store: string;
          external_id: string;
          store_url: string | null;
          title: string;
          developer: string | null;
          icon_url: string | null;
          header_image_url: string | null;
          screenshots: string[];
          rating_average: number | null;
          rating_count: number;
          review_count: number;
          installs: string | null;
          real_installs: number | null;
          price: number;
          currency: string;
          is_free: boolean;
          offers_iap: boolean;
          iap_range: string | null;
          genre: string | null;
          genre_id: string | null;
          content_rating: string | null;
          version: string | null;
          released_at: string | null;
          last_updated_at: string | null;
          is_verified: boolean;
          last_verified_at: string;
          raw_data: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          store: string;
          external_id: string;
          store_url?: string | null;
          title: string;
          developer?: string | null;
          icon_url?: string | null;
          header_image_url?: string | null;
          screenshots?: string[];
          rating_average?: number | null;
          rating_count?: number;
          review_count?: number;
          installs?: string | null;
          real_installs?: number | null;
          price?: number;
          currency?: string;
          is_free?: boolean;
          offers_iap?: boolean;
          iap_range?: string | null;
          genre?: string | null;
          genre_id?: string | null;
          content_rating?: string | null;
          version?: string | null;
          released_at?: string | null;
          last_updated_at?: string | null;
          is_verified?: boolean;
          last_verified_at?: string;
          raw_data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          store?: string;
          external_id?: string;
          store_url?: string | null;
          title?: string;
          developer?: string | null;
          icon_url?: string | null;
          header_image_url?: string | null;
          screenshots?: string[];
          rating_average?: number | null;
          rating_count?: number;
          review_count?: number;
          installs?: string | null;
          real_installs?: number | null;
          price?: number;
          currency?: string;
          is_free?: boolean;
          offers_iap?: boolean;
          iap_range?: string | null;
          genre?: string | null;
          genre_id?: string | null;
          content_rating?: string | null;
          version?: string | null;
          released_at?: string | null;
          last_updated_at?: string | null;
          is_verified?: boolean;
          last_verified_at?: string;
          raw_data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      auth_profile_id: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
}

/** Convenience type aliases */
export type GameRow = Database["public"]["Tables"]["games"]["Row"];
export type GameInsert = Database["public"]["Tables"]["games"]["Insert"];
export type ReviewRow = Database["public"]["Tables"]["reviews"]["Row"];
export type ReviewCommentRow = Database["public"]["Tables"]["review_comments"]["Row"];
export type ReviewVoteRow = Database["public"]["Tables"]["review_votes"]["Row"];
export type ListRow = Database["public"]["Tables"]["lists"]["Row"];
export type ListItemRow = Database["public"]["Tables"]["list_items"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type GameSourceRow = Database["public"]["Tables"]["game_sources"]["Row"];
export type UserGameRow = Database["public"]["Tables"]["user_games"]["Row"];
export type FollowRow = Database["public"]["Tables"]["follows"]["Row"];
export type AuditLogRow = Database["public"]["Tables"]["admin_audit_log"]["Row"];
export type AuditLogInsert = Database["public"]["Tables"]["admin_audit_log"]["Insert"];
export type SteamReviewRow = Database["public"]["Tables"]["steam_reviews"]["Row"];
export type IngestRunRow = Database["public"]["Tables"]["ingest_runs"]["Row"];
export type MobileStoreListingRow = Database["public"]["Tables"]["mobile_store_listings"]["Row"];
export type MobileStoreListingInsert = Database["public"]["Tables"]["mobile_store_listings"]["Insert"];

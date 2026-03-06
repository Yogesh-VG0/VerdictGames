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
          enrichment_sources: string[];

          // HLTB fields (migration 003)
          hltb_main: number | null;
          hltb_extras: number | null;
          hltb_completionist: number | null;
          hltb_last_fetched: string | null;
          franchise: string | null;

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
          enrichment_sources?: string[];
          hltb_main?: number | null;
          hltb_extras?: number | null;
          hltb_completionist?: number | null;
          hltb_last_fetched?: string | null;
          franchise?: string | null;
          created_at?: string;
          updated_at?: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
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

/**
 * VERDICT.GAMES — Supabase Server Client
 *
 * Uses the SERVICE_ROLE key for full database access.
 * ONLY import this in server-side code (route handlers, server components).
 * Never import in client components.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { currentHomepageSignal } from '@/lib/services/homepage-budget';

let _serverClient: SupabaseClient<Database> | null = null;

export function getServerSupabase(): SupabaseClient<Database> {
  if (_serverClient) return _serverClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  _serverClient = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const budget = currentHomepageSignal();
      if (!budget) return fetch(input, init);
      return fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, budget]) : budget });
    } },
  });

  return _serverClient;
}

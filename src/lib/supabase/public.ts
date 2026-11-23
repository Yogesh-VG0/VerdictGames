import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { homepageSignal } from '@/lib/services/homepage-budget';

export const PUBLIC_SUPABASE_FETCH_TIMEOUT_MS = 5_000;

let _publicClient: SupabaseClient<Database> | null = null;

export function hasPublicSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getPublicSupabase(): SupabaseClient<Database> {
  if (_publicClient) return _publicClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  _publicClient = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, {
        ...init,
        signal: homepageSignal(init?.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(PUBLIC_SUPABASE_FETCH_TIMEOUT_MS)])
          : AbortSignal.timeout(PUBLIC_SUPABASE_FETCH_TIMEOUT_MS)),
      }),
    },
  });

  return _publicClient;
}

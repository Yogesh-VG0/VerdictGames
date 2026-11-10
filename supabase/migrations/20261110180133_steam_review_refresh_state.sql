CREATE TABLE IF NOT EXISTS public.steam_review_refresh_state (
  game_id uuid PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  failures integer NOT NULL DEFAULT 0 CHECK (failures >= 0)
);
ALTER TABLE public.steam_review_refresh_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.steam_review_refresh_state FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.steam_review_refresh_state TO service_role;
CREATE INDEX IF NOT EXISTS steam_review_refresh_due_idx
  ON public.steam_review_refresh_state (next_attempt_at);

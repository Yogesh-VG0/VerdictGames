BEGIN;

CREATE TABLE public.maintenance_item_due_state (
  job text NOT NULL CHECK (job IN ('re-enrich', 'google_play', 'app_store')),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  next_attempt_at timestamptz NOT NULL,
  failures integer NOT NULL DEFAULT 0 CHECK (failures BETWEEN 0 AND 10),
  PRIMARY KEY (job, game_id)
);
CREATE INDEX maintenance_item_due_game_idx ON public.maintenance_item_due_state (game_id);
ALTER TABLE public.maintenance_item_due_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.maintenance_item_due_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_item_due_state TO service_role;
CREATE POLICY maintenance_item_due_service ON public.maintenance_item_due_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;

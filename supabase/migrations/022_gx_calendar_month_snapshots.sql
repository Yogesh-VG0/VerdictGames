CREATE TABLE IF NOT EXISTS gx_calendar_month_snapshots (
  month_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  game_count integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'gx',
  snapshot_version integer NOT NULL DEFAULT 1,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gx_calendar_month_snapshots_fetched_at
  ON gx_calendar_month_snapshots (fetched_at DESC);

ALTER TABLE gx_calendar_month_snapshots ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE gx_calendar_month_snapshots IS 'Durable GX calendar snapshots keyed by month for stable release-calendar reads.';
COMMENT ON COLUMN gx_calendar_month_snapshots.month_key IS 'Calendar month key in YYYY-MM format.';
COMMENT ON COLUMN gx_calendar_month_snapshots.payload IS 'Serialized GX calendar public payload for the month.';
COMMENT ON COLUMN gx_calendar_month_snapshots.game_count IS 'Number of GX calendar entries stored for the month snapshot.';
COMMENT ON COLUMN gx_calendar_month_snapshots.snapshot_version IS 'Contract version for GX month snapshots.';

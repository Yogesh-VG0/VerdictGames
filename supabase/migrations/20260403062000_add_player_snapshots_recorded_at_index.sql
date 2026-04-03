create index if not exists idx_player_snapshots_recorded_at
  on public.player_snapshots (recorded_at desc);

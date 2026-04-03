drop policy if exists "Public read player_snapshots" on public.player_snapshots;
drop policy if exists "Public read scheduler_runs" on public.scheduler_runs;

create index if not exists idx_scheduler_runs_started_at
  on public.scheduler_runs (started_at desc);

create index if not exists idx_scheduler_runs_status_started_at
  on public.scheduler_runs (status, started_at desc);

create or replace function public.refresh_recent_game_momentum()
returns integer
language sql
set search_path = ''
as $$
  with ranked as (
    select
      ps.game_id,
      ps.player_count,
      row_number() over (
        partition by ps.game_id
        order by ps.recorded_at desc
      ) as rn
    from public.player_snapshots ps
    where ps.recorded_at >= now() - interval '7 days'
  ),
  pairs as (
    select
      current_snapshot.game_id,
      current_snapshot.player_count as current_count,
      previous_snapshot.player_count as previous_count
    from ranked current_snapshot
    join ranked previous_snapshot
      on previous_snapshot.game_id = current_snapshot.game_id
     and previous_snapshot.rn = 2
    where current_snapshot.rn = 1
  ),
  updated as (
    update public.games g
    set momentum = round((ln(p.current_count + 1) - ln(p.previous_count + 1))::numeric, 4)::real
    from pairs p
    where g.id = p.game_id
    returning g.id
  )
  select count(*)::integer from updated;
$$;

revoke all on function public.refresh_recent_game_momentum() from public;
revoke all on function public.refresh_recent_game_momentum() from anon;
revoke all on function public.refresh_recent_game_momentum() from authenticated;
grant execute on function public.refresh_recent_game_momentum() to service_role;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where auth_id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin_user() from public;
grant execute on function public.is_admin_user() to anon;
grant execute on function public.is_admin_user() to authenticated;
grant execute on function public.is_admin_user() to service_role;

revoke all on table public.editorial_reviews from anon;
revoke all on table public.editorial_reviews from authenticated;
grant select on table public.editorial_reviews to anon;
grant select, insert, update, delete on table public.editorial_reviews to authenticated;
grant all on table public.editorial_reviews to service_role;

drop policy if exists "Public can read published editorial reviews" on public.editorial_reviews;
drop policy if exists "Admins can manage editorial reviews" on public.editorial_reviews;
drop policy if exists "Admins can insert editorial reviews" on public.editorial_reviews;
drop policy if exists "Admins can update editorial reviews" on public.editorial_reviews;
drop policy if exists "Admins can delete editorial reviews" on public.editorial_reviews;

create policy "Public can read published editorial reviews"
  on public.editorial_reviews
  for select
  to public
  using (
    is_published = true
    or (select public.is_admin_user())
  );

create policy "Admins can insert editorial reviews"
  on public.editorial_reviews
  for insert
  to authenticated
  with check (
    (select public.is_admin_user())
    and author_id = (select public.auth_profile_id())
  );

create policy "Admins can update editorial reviews"
  on public.editorial_reviews
  for update
  to authenticated
  using ((select public.is_admin_user()))
  with check ((select public.is_admin_user()));

create policy "Admins can delete editorial reviews"
  on public.editorial_reviews
  for delete
  to authenticated
  using ((select public.is_admin_user()));

create or replace function public.update_editorial_review_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.is_published = true and old.is_published = false then
    new.published_at = now();
  end if;
  return new;
end;
$$;

revoke all on table public.gx_calendar_month_snapshots from anon;
revoke all on table public.gx_calendar_month_snapshots from authenticated;
grant all on table public.gx_calendar_month_snapshots to service_role;

drop policy if exists "Service manage gx_calendar_month_snapshots" on public.gx_calendar_month_snapshots;
drop policy if exists "gx_calendar_month_snapshots_service_role_only" on public.gx_calendar_month_snapshots;

create policy "Service manage gx_calendar_month_snapshots"
  on public.gx_calendar_month_snapshots
  for all
  to service_role
  using (true)
  with check (true);

drop index if exists public.idx_admin_audit_log_edited_at;
drop index if exists public.idx_admin_audit_log_entity;
drop index if exists public.idx_msl_game_id;
drop index if exists public.idx_msl_store_verified;

do $$
begin
  if exists (
    select 1
    from pg_class i
    join pg_namespace n on n.oid = i.relnamespace
    where n.nspname = 'public'
      and i.relname = 'idx_mobile_store_listings_store_external_id'
  ) and not exists (
    select 1
    from pg_constraint c
    where c.conname = 'mobile_store_listings_store_external_id_key'
      and c.conrelid = 'public.mobile_store_listings'::regclass
  ) then
    alter table public.mobile_store_listings
      add constraint mobile_store_listings_store_external_id_key
      unique using index idx_mobile_store_listings_store_external_id;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_class i
    join pg_namespace n on n.oid = i.relnamespace
    where n.nspname = 'public'
      and i.relname = 'idx_mobile_store_listings_store_external_id'
  ) and not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.mobile_store_listings'::regclass
      and c.conindid = 'public.idx_mobile_store_listings_store_external_id'::regclass
  ) then
    execute 'drop index public.idx_mobile_store_listings_store_external_id';
  end if;
end
$$;

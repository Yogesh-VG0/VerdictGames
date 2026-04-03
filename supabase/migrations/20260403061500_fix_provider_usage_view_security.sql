alter view public.api_provider_daily_usage set (security_invoker = true);

revoke all privileges on table public.api_provider_daily_usage from public;
revoke all privileges on table public.api_provider_daily_usage from anon;
revoke all privileges on table public.api_provider_daily_usage from authenticated;

grant select on table public.api_provider_daily_usage to service_role;

drop policy if exists "Authenticated users can read api_provider_usage" on public.api_provider_usage;
drop policy if exists "Authenticated users can read api_provider_budgets" on public.api_provider_budgets;

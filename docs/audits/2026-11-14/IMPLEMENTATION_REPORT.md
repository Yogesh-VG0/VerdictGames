# Validated remediation implementation

Branch: `remediation/validated-security-and-signal`.

The November 14 `AUDIT_VALIDATION.md` governs conflicting recommendations. Production infrastructure, billing, migration history, application deployment, and `main` are unchanged. Local Docker/Supabase verification uses disposable fixtures and never resets or deletes existing local data.

## Status register

Status applies to the production outcome. Local verification is recorded separately; it does not imply that a fix is live.

| Finding / work | Status | Reason / next requirement |
| --- | --- | --- |
| VG-002 personalized response caching | Fixed but Awaiting Verification | Branch code and local identity tests pass. Needs approved deployment, affected CDN invalidation, and live header/two-session checks. |
| VG-005 private library/profile information | Fixed but Awaiting Verification | Migration and matching app changes pass local identity tests; hosted application and permissions unchanged. |
| VG-007 avatar ownership | Fixed but Awaiting Verification | Local legacy/folder upload and overwrite/upsert tests pass; hosted policy migration awaits approval. |
| VG-006 database privileges | Fixed but Awaiting Verification | Effective local privileges tested; hosted grants unchanged. |
| VG-001 reliability, section caches, region | Partially Fixed | Branch cache admission/budgets verified locally. Tokyo is evaluated/proposed, not applied; live latency/CDN verification remains. |
| VG-011 advisory locks | Fixed but Awaiting Verification | Unexpected lock errors now abort; unit coverage passes. Needs approved scheduler release. |
| VG-008 RAWG recovery / maintenance visibility | Fixed but Awaiting Verification | Recovery/concurrency tests and real local outage simulation pass; needs approved scheduler release and production observation. |
| VG-003 build checks / branch protection / dependency alerts | Unresolved | Production settings require explicit approval. |
| VG-004 migration consistency | Unresolved | Reconcile exact SQL/state before history changes. |
| Backup and restore verification | Unresolved | Recovery documentation and a safe local restore drill remain. |
| VG-009 duplicate Steam mappings | Unresolved | Review relationships and slugs; no automatic merge/deletion. |
| VG-010 deletion behavior | Unresolved | Clarify request flow or implement and test deletion separately. |
| FE-002 stored Early Access claims | Unresolved | Derivation and existing-data repair remain. |
| FE-009 calendar advertising | Unresolved | Filtering and stored-snapshot repair remain. |
| FE-001, FE-004–008, FE-010–015 and Signal polish | Unresolved | Targeted UX implementation and rendered verification remain. |
| FE-003 remove discovery rails / Explore | Not Applicable | Rejected by validation; preserve working discovery. |
| VG-014 paid leaked-password checking | Deferred | Pro-only feature; no paid plan authorized. |
| VG-012 CSP nonce redesign / VG-013 optional hardening / VG-015 cleanup | Deferred | Lower priority; preserve existing protections. |
| VG-016–018 | Not Applicable | Informational observations; no blanket verification claim. |

## Change set 1 — VG-002: isolate personalized JSON responses

### Problem and implementation

Global reviews and recommendations explicitly requested shared caching despite including the caller's vote or library-derived preferences. Other identity-dependent endpoints relied on default behavior rather than an explicit policy.

- Added `jsonPrivateOk` and a single private header policy in `src/lib/api/response.ts`.
- The policy sets `Cache-Control: private, no-store, max-age=0`, `CDN-Cache-Control: private, no-store`, and `Vercel-CDN-Cache-Control: private, no-store`, with `Vary: Cookie`.
- Switched recommendations, all three personalized review feeds, library, library statistics, and own-profile responses to the private helper. Recommendations and the global review feed explicitly use dynamic rendering. Error responses are also no-store.
- Preserved the existing `jsonOk` public cache opt-in and custom public TTLs. No public catalogue cache was disabled to implement privacy.
- Scoped library, library-statistics, and personalized review React Query keys by current identity, including the optimistic library cache. Review vote state remounts on identity changes. Anonymous SSR review data is not reused as signed-in initial state. Existing invalidation prefixes continue to match.
- Added `src/lib/api/response.test.ts`, `scripts/with-local-supabase.mjs`, and `scripts/test-local-security.mjs`. The launcher validates loopback service URLs, captures local credentials without printing them, and clears application environment-file values before assigning local test configuration.

### Verification

- Unit suite: **167 tests / 22 files passed** (includes six cache-policy cases).
- TypeScript: `npx tsc --noEmit` passed.
- Lint: zero errors, 12 existing warnings. No warning count increase.
- Production build against local Supabase: passed; 69 static pages generated. Review/recommendation handlers are dynamic. No production credentials or ingestion were used.
- Real HTTP integration against the built application with two disposable authenticated identities and anonymous access: **70 assertions passed**. A and B received opposite own votes on the same review from all three review feeds; anonymous received zero. Non-empty recommendations respected each caller's different library genre and excluded their owned game. Own-profile endpoints returned the matching identity and anonymous access returned 401. All targeted responses carried no-store at each cache-header level.
- Fixtures (two auth users, five games, review/votes/library rows) were removed by ID in `finally`; existing local data was retained.
- Browser smoke: local built `/library` rendered its signed-out sign-in action; browser `/api/auth/me` returned 401 and private/no-store. Full signed-in UI switching remains to be exercised in the next auth change set.
- Initial sandboxed Vitest execution failed because child-process startup was denied. The same suite passed with authorized process execution. This was an environment failure, not a passing test.

### Cache precedence, release gate, and remaining risk

[Vercel documents](https://vercel.com/docs/caching/cache-control-headers) that `Vercel-CDN-Cache-Control` overrides `CDN-Cache-Control`, which overrides `Cache-Control`. Returning all three on personalized data prevents a lower-priority private header from being overridden by a targeted cache header in deployment configuration. Current Next/Vercel configuration was checked for competing cache policies.

No deployment or production purge has occurred. Response headers cannot retroactively remove an already stored response before a request reaches the new code. The approved release must invalidate the affected review/recommendation cache entries using supported Vercel cache controls, then probe both identities and anonymous access against production, checking `x-vercel-cache` and response bodies. Do not mark VG-002 Fixed and Verified until this release check passes. Client query identities are isolated; removal of inactive private cache entries on sign-out is part of the next auth change set.

### Rollback

The change is isolated to response construction and two rendering declarations; no database migration is involved. Reverting it restores the vulnerable cache behavior and is therefore not a safe production rollback. If a release has an unrelated regression, keep these privacy headers and revert only the unrelated regression. The original branch remains undeployed.

## Change set 2 — VG-005 / VG-006 / VG-007: private data and ownership

### Implementation and reasons

- Migration `20261114121612_isolate_private_profile_library_and_avatars.sql` removes table-level and residual column privileges from profiles, then grants only named public fields. Auth IDs and roles remain available to the trusted server, not raw anonymous/authenticated profile SELECTs.
- `public.user_games` now permits owner-scoped authenticated reads. Anonymous access is revoked. Owner mutation policies and the service role remain available. Public profile statistics/activity use explicit server-side projections that never select private notes, play time, or private dates.
- Own-profile resolution verifies the Auth session first, then reads private identity/role columns with the service role. The browser uses `/api/auth/me` and retains server bootstrap for missing OAuth profiles. Profile responses are matched against the expected auth identity; stale in-flight profile responses cannot replace a newer session. Private React Query scopes are cancelled/removed when identity changes.
- Restricted no-argument helpers in the unexposed `app_private` schema support existing owner/admin RLS without exposing private columns. They use a fixed empty search path and caller `auth.uid()` predicates; public wrappers are invokers with explicit execution grants. Anonymous callers cannot execute the administrator helper.
- Editorial policies are updated to use those helpers, preserving published public reads, unpublished admin reads, and owner-scoped administrator writes. Historical inline-role policies are removed for replay compatibility. The editorial timestamp function has a fixed search path.
- Avatar INSERT/UPDATE/DELETE policies match a complete caller UUID filename or UUID folder. Both UPDATE visibility and its new path are checked. Existing UUID.ext public URLs remain valid.
- Unused anonymous mutation privileges and dangerous table commands are removed from the specified catalogue/community tables. Authenticated owner operations retain their existing RLS-protected commands. Profile updates, votes, and follows now explicitly return private/no-store JSON.
- Matching files: `src/hooks/useAuth.tsx`, `src/lib/supabase/auth.ts`, `src/lib/db/columns.ts`, `src/lib/db/mappers.ts`, `src/lib/services/public-profile.ts`, profile/settings/follow/vote route handlers, and the local verification scripts.

### Tests and results

- Full unit suite: **167 tests / 22 files passed**. TypeScript and the local production build passed. Lint: zero errors, the same 12 pre-existing warnings.
- Real two-user/anonymous local HTTP + PostgREST + Storage suite: **117 assertions passed**. Includes effective `has_column_privilege`/`has_table_privilege` checks, owner notes/hours, denied foreign notes, hidden auth IDs/roles, denied role escalation, private-list isolation, avatar overwrite/upsert denial, owner replacement, legacy public URLs, caller admin helpers, published/unpublished editorial visibility, and all change-set-1 cache assertions.
- Review creation, voting, comments, follow ownership, presentation updates, and role-smuggling rejection passed through guarded application mutations. Public profile library counts and owner statistics remain available.
- Real Chrome browser: login A → confirmed logout → login B → confirmed logout on the same `/library` page passed. Each account saw only its own game; cookie identity matched `/api/auth/me`; private content disappeared at logout; no browser JavaScript errors occurred.
- Settled screenshots: `screenshots/privacy-library-a.png`, `screenshots/privacy-library-b.png`. These contain only fictional local fixtures. No visual redesign is claimed by this change set.
- Supabase local advisor: no security/error findings; one existing multiple-permissive-policy performance warning on the deliberately separate public/admin editorial SELECT policies. Helpers are owned by postgres with fixed empty search paths.
- Test fixtures were cleaned by tracked IDs, including avatars and lists, even on test failure. Count check returned the original one local auth user, zero games, and zero avatars.
- The first browser attempt lacked a bundled headless executable; verification used installed Chrome instead. A first logout test omitted the existing confirmation dialog; after including confirmation, the actual flow passed. Neither failure was recorded as a passing run.

### Production rollout, remaining verification, and rollback

No hosted permissions or data have changed. The new app works with the existing schema and must be deployed **before** restricting profile columns, so the browser no longer depends on those columns. For an approved release: (1) deploy the compatible app and invalidate affected personalized CDN responses; (2) save the current policies/grants and apply the reviewed permission migration atomically; (3) rerun effective privilege and two-session checks, public profiles, editorial reviews, normal mutations, avatars, and admin access. Do not mark these findings Fixed and Verified before that release check.

This migration does not delete records or change migration history. Do not roll back by re-exposing notes/roles or granting anonymous writes. If an application regression occurs, retain the compatible private-profile lookup and cache policy while reverting the unrelated change. A pre-privacy application build is not compatible with the restricted raw profile columns. Fix ownership helpers/projections forward inside a transaction if a database regression is found, preserving private access boundaries.

## Change set 3 — VG-001 / VG-008 / VG-011: cache and maintenance reliability

### Actual changes

- Unexpected advisory-lock errors now throw instead of returning true. Genuine lock contention still skips safely, and suitable infrastructure retries remain bounded.
- RAWG's circuit now has a 60-second default cooldown, permits one half-open request at a time, closes on a successful probe, and reopens after a failed probe. A recovery probe has one attempt; concurrent/late pre-outage responses cannot incorrectly close the open circuit.
- Health checks record `deferred` separately from success/error and require durable logging. A transient provider deferral skips ingestion and exits successfully with an explicit warning/summary. Three consecutive deferrals cause an actionable workflow failure. Permanent provider/config errors and failed required logging remain failures. Steam-only maintenance stays outside RAWG gating.
- Corrected double-encoded run metadata: the Postgres JSON serializer receives objects instead of already-stringified JSON. The admin API reads both old string and current object formats. The scheduler UI shows deferred counts/status and the last successful run in its seven-day window. Historical records are not rewritten.
- Successful homepage rails now have individual five-minute caches. The aggregate rejects any failed requested section instead of storing its empty fallback. Existing successful section/aggregate snapshots remain eligible for stale serving. A cold partial read can still display its available data, with no-store at all CDN header levels; a fully unavailable cold API returns an uncached 503. Successful empty queries are distinguished from failures. The homepage displays a recoverable availability notice for degraded cold reads.
- Added 30-second execution budgets to the homepage and the principal public/authenticated data routes/pages that previously inherited the long platform default. Sitemap remains at 60 seconds; existing secret/admin maintenance handlers retain their separate limits. No Vercel cron was added.
- Deduplicated concurrent own-profile requests while retaining identity checks, stale-response protection, and sign-out cache clearing.

### Verification and measurements

- Unit suite: **187 tests / 26 files passed**. Includes circuit cooldown, exclusive probe, re-open behavior, lock contention/error paths, strict logging, historical metadata, failed cache admission, genuine empty reads, and partial/complete-outage API policies.
- TypeScript and production build using local-only configuration passed. Lint: zero errors and the same 12 existing warnings.
- Real local outage simulation passed: two deferred records/zero ingestion, third deferral alerts, permanent 401 fails, Steam job bypasses RAWG gating. Its generated scheduler records and temp files were removed.
- Local privacy/owner-flow regression: **118 assertions passed**, including the existing authentication limiter rejecting the eleventh request. Security controls were not disabled. Distinct loopback client addresses prevent separate suites from sharing the same per-IP bucket.
- Browser account-switch and scheduler-dashboard regression passed with no JavaScript errors. Screenshot: `screenshots/maintenance-deferred-local.png`.
- Same browser journey, before/after concurrent profile-read deduplication: **8 → 6 own-profile HTTP requests (25% fewer)**. This is a measured request-count reduction; no production latency improvement is claimed from it.
- Read-only production `EXPLAIN (ANALYZE, BUFFERS)` on a representative top-rated selection (narrower projection, limit 320 rather than the service's 180) used `idx_games_homepage_top_rated_pool`; execution was **448.65 ms**, planning 39.508 ms, 363 shared-hit blocks and zero read blocks. This single sample is a diagnostic baseline, not a before/after benchmark or p95. It does not justify a new index or establish a root cause for past 300-second failures.

### Region proposal and limits

Current production deployment metadata remains `iad1`, while Supabase is Tokyo. A single `hnd1` function region is the proposed colocation change and is compatible with the one-region Hobby architecture. No region change or production deployment has been made. Measure actual function-region headers, cache-hit/miss latency, query duration, error rate, CPU and memory usage after an approved preview/production change before claiming improvement. Network colocation does not repair expensive SQL, schema-cache failures, or provider outages.

Live CDN cache behavior, stale retention across an actual production failure, and hosted 30-second enforcement await an approved release. The cold/partial failure policy is covered by branch unit tests, not misrepresented as a live CDN fault-injection result. Five additional public rail snapshots add bounded framework-cache entries; no new service or continuous polling is introduced.

### Rollback

No schema/history changes are required by this change set. Keep the prior privacy commits. Revert only the reliability commit if needed; that restores the old cache/logging behavior, so inspect cache admission before using that rollback. Existing/new metadata formats are backward-readable by the prior scheduler parser. A dashboard rollback may display `deferred` without its newer styling; no job or game data is deleted. Do not restore fail-open locking or permanently disable the RAWG circuit to make a job run.

## Pending approvals / manual actions

- Production deployment and cache invalidation: explicit approval required.
- Hosted permission/policy migration: prepare and test locally first; do not apply without explicit approval for the concrete migration.
- Production region, branch protections, dependency-alert settings, or migration-history repair: present exact changes before requesting approval.
- No merge, paid upgrade, destructive game merge, or production data deletion has been performed.

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
| VG-003 build checks / branch protection / dependency alerts | Partially Fixed | Repository checks/local equivalents pass; hosted CI and dashboard settings await review/release. |
| VG-004 migration consistency | Partially Fixed | Exact recorded SQL, type/backfill, fresh replay reconciled; proposed hosted history repair not applied. |
| Backup and restore verification | Partially Fixed | Synthetic local export/restore passes and runbook exists; actual production backup/restore is unverified. |
| VG-009 duplicate Steam mappings | Partially Fixed | 54 groups reviewed and provider calls grouped; merging editions/relationships is Deferred. |
| VG-010 deletion behavior | Fixed but Awaiting Verification | Accurate email-request flow implemented; no destructive automation claimed. |
| FE-001 hero contrast | Fixed but Awaiting Verification | Existing scrims retained after sampled Hades/Schedule I/Clair Obscur checks in both themes. Not every possible artwork is certified. |
| FE-002 stored Early Access claims | Partially Fixed | Both generators and legacy presentation corrected; 319-row stored repair preview awaits approval. |
| FE-003 discovery / wishlist counts | Fixed but Awaiting Verification | Unknown zero counts hidden; deleting Explore/rails is Not Applicable under approved direction. |
| FE-004 search | Fixed but Awaiting Verification | One search context, compact phone filters, measured control contrast, loading/error/recovery tests pass locally. |
| FE-005 verdict correctness | Partially Fixed | Unsupported generated con suppressed and empty state clarified; stored repair remains. Existing useful tags retained. |
| FE-006 reviews | Fixed but Awaiting Verification | Named loading, source selection semantics, corrected icon/text, cohesive controls tested locally. |
| FE-007 lists | Fixed but Awaiting Verification | Copy includes editors and players; mosaics preserved and rendered. |
| FE-008 Compare | Fixed but Awaiting Verification | Contextual entry, one-game preview, keyboard selection and two-game URL flow tested. |
| FE-009 calendar advertising | Fixed but Awaiting Verification | Live/stored/final output filtering and namespace change implemented; approved CDN rollout still needed. |
| FE-010 navigation | Fixed but Awaiting Verification | Tablet fits and phone destinations stay stable, signed in and out. |
| FE-011 auth flow | Fixed but Awaiting Verification | Task copy, stronger scrim, focus capture/wrap/Escape/return tested; OAuth/email delivery not exercised by local identities. |
| FE-012 Signal consistency | Fixed but Awaiting Verification | Static headings, neutral primary actions, readable theme-specific scores; artwork/brand/discovery preserved. |
| FE-013 motion | Fixed but Awaiting Verification | Primary content visible, height/gradient loops removed, explicit timer/stroke/opacity/scroll preferences tested. |
| FE-014 scrollers | Fixed but Awaiting Verification | Focused final Explore/month controls reachable; filters have arrow-key radio behavior. |
| FE-015 themes / visual testing | Partially Fixed | Scripted responsive/theme/contrast checks and screenshots pass; production field data and external-human testing remain unverified. |
| VG-014 paid leaked-password checking | Deferred | Pro-only feature; no paid plan authorized. |
| VG-012 CSP nonce redesign / VG-013 optional hardening | Deferred | No demonstrated bypass. A nonce/cache design and optional constant-time comparison remain separate hardening; trusted IP handling and active protections are preserved. |
| VG-015 unused-code cleanup | Fixed and Verified | Unused internal helpers/imports/values removed; unit/type/build checks pass and lint is clean. No production behavior change is required. |
| VG-016 sitemap / rendering inventory | Partially Fixed | Build inventory retained; eligible local fixture URLs included and private/safety exclusions preserved. Full live catalogue XML needs release-time verification. |
| VG-017 scoring rewrite | Not Applicable | No justified scoring rewrite; existing scoring tests/semantics preserved. |
| VG-018 existing controls | Not Applicable | Positive/informational observations preserved; package pins Node 24 while dashboard default 26 remains a manual alignment proposal. |

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

## Change set 4 — VG-003 / VG-004: release safety and recovery

**Status: Partially Fixed.** Repository checks and local replay are verified; hosted CI, settings, actual production backup recovery, and history repair remain pending.

- Quality CI now builds with application credentials explicitly blanked, preserving the unit/type/lint/dependency checks. Verification prebuilt output must never be promoted to production.
- Added a separate least-privilege local-Supabase workflow: real identity/Storage/API tests, maintenance outages, browser account switching, full migration replay, and synthetic restore. Its pinned CLI/browser tools install outside the application; no application dependencies or production secrets were added. Hosted execution awaits a pushed branch/PR.
- Added weekly Dependabot proposals without automerge. `proposals/main-protection.json` specifies required `check` and `security-regression` checks, strict freshness, PRs, resolved conversations, linear history, and no force-push/deletion. Zero mandatory peer approvals preserves solo-owner operability. Branch settings and dependency alerts were **not** changed; explicit dashboard approval is required after the new check exists.
- Recovered missing remote migration SQL, reconciled the identical username migration version, and fixed two fresh-replay guards without changing hosted history. See `MIGRATION_RECONCILIATION.md` and archived SQL. The unrecorded player-freshness migration's resulting type/backfill were checked, rather than inferred from column existence alone.
- Added `RECOVERY_RUNBOOK.md`. Hosted backup listing has no listed backups and no PITR. No real production backup was exported. The local drill proves synthetic export/restore and preservation of privacy privileges, not recoverability of the hosted data or Storage binaries.

Verification: **187 unit tests passed**, TypeScript passed, isolated production build passed (69 prerendered routes), all three YAML files parsed, and `npm audit` reported **0 vulnerabilities**. All **42 migrations** replayed and the synthetic restore passed. Lint retains the existing warnings; no unrelated source cleanup was staged. Local identity/browser suites passed in change sets 2–3; the new GitHub-hosted workflow is not claimed as executed.

Rollback: revert this repository-only change set. Existing production remains unchanged. Retain a record of the recovered migration identity corrections before reverting them. Never restore a database over production as a rollback experiment. Required manual actions are explicitly listed above and in the recovery runbook.

## Change set 5 — VG-009 / VG-010 / FE-002 / FE-005 / FE-009: product truth

**Status: Fixed but Awaiting Verification** for application behavior; **Partially Fixed** for stored cons; **Deferred** for game merges. No hosted game/user/snapshot data was modified.

- Both ingestion paths no longer derive current Early Access from a historical RAWG tag. The mapper suppresses only the exact legacy generated sentence, preserving editorial/user prose. Empty drawbacks now say no specific drawbacks have been verified. The read-only affected-row preview and rollback-by-default SQL are in `proposals/`; stored repair awaits approval.
- Calendar filtering recognizes explicit advertising tags, the observed ASUS/ROG/ProArt campaign patterns, and vendor event URLs. It preserves genuine GX-only games, including similarly named titles. Existing durable snapshots are filtered on read; a new framework namespace prevents stale merged values. CDN invalidation remains a release action.
- Settings now accurately offers **Request account deletion by email**, explaining ownership verification and that opening an email does not delete data. No false deletion confirmation or automated destructive workflow is introduced.
- Steam player refresh groups provider calls by app ID and updates all original row identities. Reviewed all 54 duplicate groups with provider IDs, slugs and aggregate references; edition differences and existing relationships preclude automatic merges. See `proposals/GAME_DATA_REVIEW.md`.
- Fixed an additional preservation defect: a status-only library edit previously reset omitted private notes/hours/rating/dates. Existing rows now update only supplied fields, new rows use defaults, and a concurrent first insert retries a partial update. Added input validation and actual owner-boundary regression.

Verification: **205 unit tests / 28 files passed**; TypeScript, local production build, lint (zero errors / 12 existing warnings), maintenance-outage regression passed. Real two-identity/anonymous HTTP/Data API/Storage suite: **120 assertions passed**, including preservation of notes/hours after a status change. Browser redesign tests belong to the next change set. No production data cleanup, full scheduler pass, or live cache invalidation is claimed.

Rollback: revert this application/scheduler change set while retaining privacy commits. It performs no schema changes or automatic destructive repair. Keep the mapping preview for later review. Reverting ingestion restores the unsupported claim, so prefer a forward fix if only one UI behavior regresses.

## Change set 6 — FE-003 / FE-004 / FE-006 / FE-007 / FE-008 / FE-010 / FE-011 / FE-014: user journeys

**Status: Fixed but Awaiting Verification** in production; branch browser checks passed.

- Tablet uses a compact header/menu below 1100px, with a visible Sign In action; the full desktop row remains above that width. Phone destinations stay Home, Explore, Search, Library, You before and after authentication. Library retains its signed-out task prompt; You opens sign-in or the caller's profile. Bottom navigation remains available while scrolling and using a keyboard.
- Search has one visible search context. Phone filters/sorting disclose on demand with an active-filter count; desktop filters remain visible. Existing URL filters, query behavior, Browse/Deals/Free routes and reset controls are preserved.
- Compare is linked beside Share. A one-game deep link now shows the selected game using the existing game API; the second field has debounced queries, combobox/listbox semantics, Arrow/Enter/Escape interaction, URL persistence, loading and retry states. No new backend endpoint was added.
- Review placeholders have named busy/status regions, source controls expose selection, and the misleading Steam checkmark was removed. Lists copy includes both editorial and supported player collections. Unknown zero wishlist counts are hidden.
- Actual keyboard testing found that a focused final Explore tab could remain partly outside its scroller. Explore and reusable filter chips now reveal focused controls immediately. Existing auth focus capture/trap, Escape, and focus restoration were tested rather than reimplemented blindly.

Verification: **205 unit tests passed**; TypeScript, production build, lint (0 errors / 12 existing warnings) passed. **54 before and 54 after actual route renders**, nine routes at 390/768/1440 in both themes, with no uncaught JS errors. After checks cover header bounds, overflow, one search field, keyboard comparison, final Explore chip, tablet drawer, and auth focus/trap/return. A first focus assertion raced the existing 100ms focus lifecycle; corrected the test to wait for focus, then reran. The focused-chip failure was an actual issue and was fixed before the passing run.

Actual Chrome login A → confirmed logout → login B → confirmed logout passed again, including mobile stable navigation and signed-in tablet Settings. Anonymous/local identities only; fixture IDs cleaned. Screenshots are in `screenshots/before`, `screenshots/after`, and signed-in library captures. Upstream news/achievement/provider content is stubbed only in the visual suite; this does not certify those services or disable security controls. No external-human usability study or assistive-technology certification has been performed.

Rollback: revert this UI change set; all existing routes/data remain compatible. Keep privacy and reliability commits. No infrastructure, database migration, or billing changes are involved.

## Change set 7 — FE-001 / FE-004 / FE-011–015: Signal and motion

**Status: Fixed but Awaiting Verification** in production; see the more limited FE-015 testing status above.

Implemented the approved Signal direction without new dependencies or fonts. Static foreground headings replace looping gradients. Primary actions use neutral theme-aware fills, retaining violet for brand/focus/navigation and score hues for scores. Form boundaries and placeholders were measured. Artwork score badges keep a bright palette on opaque dark grounds in both themes, while scores on light panels use darker readable hues. Source labels/counts and numeric badges are clearer. Existing heroes, rails, Explore, list mosaics, metadata, authentication methods, and data remain.

`MotionConfig reducedMotion="user"` now supplies the shared policy. Primary page/section content no longer enters hidden. Height disclosure animations were removed from reviews, comments, Explore, free filters and calendar. Hero crossfade is shorter, pauses on hover/focus, exposes a pause control and disables autoplay/progress under reduced motion. Score stroke, modal/media/feedback opacity, and programmatic scrolling have explicit preference handling. Keyboard events on hero controls retain their native button behavior. Card feedback is short and constrained, with reduced-motion/touch guards. `FadeInSection` was already static and was left alone.

Affected files and motion decisions are recorded in `SIGNAL_IMPLEMENTATION.md`; screenshots are indexed in `screenshots/README.md`. UI actions/loading/empty states were checked through actual Chrome rather than just source inspection. Trailer posters render, with a game-art fallback if the poster fails. Auth captures focus independently of animation duration and includes links in its trap.

Verification: **205 unit tests passed**, both credential-free and local production builds passed (69 prerendered routes), TypeScript passed through the build, lint **0 errors / 11 existing warnings**, dependency scan **0 vulnerabilities**. Updated workflow YAML parsed. Final **54 route renders** passed both themes/three widths, plus 320/820/1024/1100px bounds, keyboard comparison/filter selection/scrollers, modal focus wrap/Escape/return, two reduced-motion intervals, missing artwork/long titles, slow/failed search with recovery, and visible loading on delayed game navigation. Actual account-switch browser tests and **120 real privacy/API/Storage assertions** passed again; maintenance outage and **42-migration synthetic restore** also passed again.

Eligible local sitemap game fixtures are present with restricted profile grants; private account routes and the existing safety-excluded fixture stay excluded. An initial test incorrectly assumed the fixture with a Nudity tag was eligible; the assertion was corrected without weakening the safety control. This is not a claim of a full live catalogue count.

Measured field boundary contrast is **4.82:1 dark / 3.60:1 light**, placeholder **6.54:1 / 6.92:1**; sampled primary-action text passes 4.5:1. No new production PageSpeed or latency improvement is claimed from branch-only work. Existing baseline reports remain in `PERFORMANCE.md`. No external-human usability study or complete assistive-technology certification was performed. Upstream provider playback/content and production cache invalidation await release checks.

Some preliminary browser waits/screenshots caught pending provider images or mid-animation/theme frames. Final captures wait for rendered/settled states; those preliminary runs are not marked as passing. The final fixture cleanup check returned the original **1 auth user / 0 games / 0 avatars / 0 scheduler runs**.

Rollback: revert only the Signal change set and retain the compatible privacy/reliability commits. No hosted data, migration history, domain, plan, firewall, or production infrastructure changes were made. Production remains on the original main commit; Vercel plugin inspection and remote-main read confirmed this before review preparation.

## Change set 8 — VG-015: bounded cleanup

Removed unused internal media helper definitions/patterns and unused imports/locals from the scheduler, media repair, admin routes/page, search normalization, IGDB bootstrap and ingestion import. Active media validation, source upgrade logic, authorization and request handling are retained. `buildOptimizedUrl` remains exported and used elsewhere; only an unused duplicate calculation was removed from the admin route.

Verification: **205 tests / 28 files passed**, lint **0 errors / 0 warnings**, credential-free production build and TypeScript passed. No new tests were written to mirror dead-code removal. The preceding browser/security suite covers unchanged runtime paths; the cleanup adds no new behavior or schema dependency. Rollback is a plain revert of this cleanup commit.

## Pending approvals / manual actions

- Production deployment and cache invalidation: explicit approval required.
- Hosted permission/policy migration: prepare and test locally first; do not apply without explicit approval for the concrete migration.
- Production region, branch protections, dependency-alert settings, or migration-history repair: present exact changes before requesting approval.
- No merge, paid upgrade, destructive game merge, or production data deletion has been performed.

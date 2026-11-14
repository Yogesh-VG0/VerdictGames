# Validated remediation implementation

Branch: `remediation/validated-security-and-signal`.

The November 14 `AUDIT_VALIDATION.md` governs conflicting recommendations. Production infrastructure, billing, migration history, application deployment, and `main` are unchanged. Local Docker/Supabase verification uses disposable fixtures and never resets or deletes existing local data.

## Status register

Status applies to the production outcome. Local verification is recorded separately; it does not imply that a fix is live.

| Finding / work | Status | Reason / next requirement |
| --- | --- | --- |
| VG-002 personalized response caching | Fixed but Awaiting Verification | Branch code and local identity tests pass. Needs approved deployment, affected CDN invalidation, and live header/two-session checks. |
| VG-005 private library/profile information | Unresolved | Next privacy change set. |
| VG-007 avatar ownership | Unresolved | Next privacy change set. |
| VG-006 database privileges | Unresolved | Next privacy change set. |
| VG-001 reliability, section caches, region | Partially Fixed | Existing bounded reads are present; failed-section cache handling and region evaluation remain. |
| VG-011 advisory locks | Unresolved | Pending verified privacy boundary. |
| VG-008 RAWG recovery / maintenance visibility | Unresolved | Pending verified privacy boundary. |
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

## Pending approvals / manual actions

- Production deployment and cache invalidation: explicit approval required.
- Hosted permission/policy migration: prepare and test locally first; do not apply without explicit approval for the concrete migration.
- Production region, branch protections, dependency-alert settings, or migration-history repair: present exact changes before requesting approval.
- No merge, paid upgrade, destructive game merge, or production data deletion has been performed.

# Incident remediation — November 11, 2026 (IST)

## Diagnosis

Vercel disabled production after the Hobby Fluid Active CPU allowance was exhausted. The supplied firewall evidence contains substantial automation, but does not prove a targeted attack or establish a human visitor count. Geography, user-agent strings, and Analytics visits do not establish identity. Search Console's zero Google clicks does not exclude direct traffic or other search engines.

The code had concrete compute amplifiers: dynamic game HTML, Steam refresh attempts during public rendering, stale review snapshots, a retired Steam endpoint returning HTML, and expensive search misses. Exact CPU attribution remains unavailable: Vercel's metric queries returned errors and Hobby runtime history is limited. Compare route CPU, function invocations, cache hits, and firewall actions after service resumes; do not infer savings from local latency alone.

## Applied to production services

- Enabled Vercel Bot Protection challenges. Initially enabled AI bot denial, then changed AI Bots to logging with the owner's explicit approval to preserve AI search and assistant discovery. Verified active firewall version 5: AI Bots `log`, Bot Protection `challenge`. See [AI discovery verification](AI_DISCOVERY.md).
- Applied five versioned Supabase migrations. Authenticated users cannot change profile roles, authentication identifiers, or profile identifiers; permitted profile fields remain editable. Private lists and list items are visible only to their owners. Internal trigger functions are inaccessible through public roles, and the administrator helper uses caller privileges.
- Added private Steam refresh-state and atomic API rate-limit tables. Only service-role callers can consume the rate-limit RPC. The first two requests in a two-request test were allowed and the third denied.
- Separated public published-editorial reads from authenticated administrator draft access. Verified anonymous readers can read the two published reviews and zero unpublished reviews.
- Per the owner's instruction, retained two named administrator accounts and demoted the obsolete local administrator to a normal user. No accounts were deleted.
- Successfully refreshed 103 Steam review caches using the replacement API, before the scheduled runner release.

## Application and scheduler changes

- Upgraded Next.js, React, Sharp, Supabase clients, and compatible dependencies; removed an unused vulnerable scaffolding dependency. Final npm audit reports zero known vulnerabilities across production and development dependencies. The lockfile is committed.
- Public Steam reviews now read cached database snapshots only. A GitHub Actions job refreshes bounded batches four times daily, with advisory locking, atomic replacement, persistent backoff, a request timeout, and a three-failure stop. A failed replacement preserves the previous snapshot.
- Game HTML now uses lazy static generation and 15-minute revalidation. Homepage/search data use five-minute caching. Search candidate limits respect the database API's 1,000-row cap and no longer claim an exact count when that cap is reached. Existing search matches do not wait for optional RAWG previews.
- Added shared rate limits for writes and search, normalized resource buckets, mutation Origin checks, safer OAuth redirect paths, header-only cron secrets, a bounded local burst store, and verified TLS for scheduler database connections.
- Restricted image optimization to known image providers, disabled optimizer redirects, removed production `unsafe-eval`, restricted connection destinations, and added CSP frame protection. Inline scripts/styles remain allowed for the existing Next.js rendering strategy; this is not a nonce-based strict CSP.
- Sitemap generation now paginates the full catalog and retains the prior ISR result on query failure. It contains 8,198 URLs in local verification. Canonicals and VideoGame structured data remain; blended third-party scores are no longer represented as native AggregateRating data. Preview pages remain noindex, and missing games return 404/noindex.
- RAWG requests time out and back off; the homepage falls back to stored upcoming games during its outage. Deferred RAWG maintenance now records an error instead of reporting false success. Android checks distinguish a healthy search with no current match from provider failures and preserve confidence checks.

## Verification

- 17 test files / 147 tests passed; TypeScript passed; ESLint has zero errors and 12 existing unused-variable warnings; optimized production build passed.
- Production build classifies `/game/[slug]` as SSG, `/` as static with five-minute revalidation, and `/sitemap.xml` as static with hourly revalidation.
- Initial local browser checks passed for homepage, game detail, and search, including a 390px mobile viewport with no horizontal overflow or application console errors. Later cold-start bursts produced fail-closed 503s for search prefetches; all three direct requests retried successfully with 200 responses. The shared-storage timeout was increased from three to five seconds and safe failure-type logging added. Mobile navigation and game genre links no longer prefetch expensive dynamic search pages merely because they enter the viewport; actual navigation retains the shared rate limit.
- Repeated game requests returned `x-nextjs-cache: HIT` (7–9ms locally). Search, editorial reviews, Steam reviews, robots, and sitemap returned 200. Missing game returned 404/noindex. Cross-origin writes returned 403; unauthenticated writes and cron calls returned 401. One initial rate-limit storage timeout returned the intended fail-closed 503; subsequent authenticated-service RPC and three unauthenticated write checks passed.
- Android provider control searches succeeded. A bounded read-only batch correctly skipped unrelated/delisted titles without creating false matches.
- Supabase security advisors report only disabled leaked-password protection. That service feature requires a paid Supabase plan: [password security documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No paid subscription was purchased.

## Release verification and remaining constraints

Application fixes were committed and pushed to `main` as `50f3eebc0dd006843d0df27f4a1486564965841e`. The released [GitHub Actions run](https://github.com/Yogesh-VG0/VerdictGames/actions/runs/42884620397) passed, refreshed three additional games, and recorded `success`, scanned 3, updated 3, failed 0 in `scheduler_runs`. There are now 106 refreshed game caches. A separate workflow checks tests, types, lint, and dependency advisories on pushes, pull requests, and weekly without production secrets.

**Website release blocked by Vercel:** creating the production deployment returned HTTP 402 `resource_creation_blocked`: "Your Team exceeded our fair use limits and has been blocked." The unpause endpoint accepted a request but did not restore serving. A subsequent project read still reports `live: false`, and both public hosts still return HTTP 402 `DEPLOYMENT_DISABLED`. No Vercel CLI is installed as a fallback. The application fixes are therefore in GitHub and locally verified, but are **not deployed to Vercel**. Database and firewall changes are already live. The owner must resolve the account limit or wait for the dashboard's December 10 reset, then deploy the latest `main` commit to the existing project. A code change does not reset platform usage.

RAWG's upstream 522 outage cannot be repaired from this repository; cached catalog browsing remains available once hosting resumes. Search Console indexing reasons require its private report; the supplied figures alone cannot establish why each URL is excluded. These changes improve technical SEO and availability, but do not guarantee rankings or indexing.

The owner selected **waiting for the free-tier reset**. Leave billing unchanged. After the account limit clears, deploy the latest `main` to `prj_DoevjjrzigNt5IGH5VbTk2WmC6sH` in its existing team, then verify both domains, canonical redirects, cache headers, game/search/browser flows, robots and sitemap responses, and route CPU/cache metrics. The existing September deployment will not contain these application fixes if it simply resumes serving.

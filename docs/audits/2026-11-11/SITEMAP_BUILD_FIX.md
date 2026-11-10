# Sitemap build timeout repair

The deployment of `505f1e1` failed during prerendering of `/sitemap.xml` with PostgreSQL `57014` (statement timeout). Compilation and TypeScript had passed. The metadata route queried the entire live catalog during `next build`, so an unavailable or slow database could abort an otherwise valid deployment.

Changed `/sitemap.xml` to an explicit route handler that calls `connection()` before catalog access. The URL and robots sitemap reference are unchanged. It produces the same public game/list URLs at request time; successful XML is cached at the CDN for one hour, with a one-day stale-while-revalidate/stale-if-error allowance. The underlying successful catalog result also retains hourly data caching. Database failures return 503, `Retry-After: 60`, and `Cache-Control: no-store`, rather than a successful but incomplete sitemap.

Replaced OFFSET pagination with ascending primary-key cursors and batches of 250 rows. The inspected late OFFSET plan scanned/sorted the catalog, while a representative cursor query used the existing `games_pkey` index and returned 250 rows in about 242ms. No database timeout setting or database schema was changed. Removed unnecessary image-URL transfer by applying the existing nonempty-cover requirement in the query. Public visibility and content-safety filters remain.

Verification:

- 18 test files / 152 tests passed, including reported-timeout handling, cursor completeness beyond 1,000 rows, repeated-page rejection, and XML escaping.
- TypeScript passed; ESLint has zero errors and 12 existing unused-variable warnings.
- Optimized production build passed and classifies `/sitemap.xml` as dynamic, with no sitemap entry in the prerender manifest.
- Local production HTTP checks against the real database returned complete XML with 8,198 unique URLs, zero duplicates, and the expected CDN headers. First generation took 17.8 seconds; the next data-cache-backed request took 25ms.

The connected Vercel account cannot inspect the destination team `yogesh-vg0s-projects` (403); its team-access authorization request returned 404. Release status can still be checked through the repository's Vercel commit status. A local build passing is not evidence that a remote deployment has completed.

References: [Next.js connection](https://nextjs.org/docs/app/api-reference/functions/connection), [Vercel CDN cache](https://vercel.com/docs/caching/cdn-cache).

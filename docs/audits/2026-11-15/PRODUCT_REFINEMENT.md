# VerdictGames product refinement and release evidence

Date: November 15, 2026. **Production release remains HOLD.** This is the single consolidated follow-up to `FINAL_CANDIDATE.md`, `PRE_RELEASE_VERIFICATION.md`, the November 14 implementation/design reports and the November 12 production audit. Earlier comprehensive findings are not being re-audited. Existing dirty documentation, screenshots and unrelated files are preserved.

## Scope and decision

Implemented targeted authentication, artwork, provider recovery, Explore semantics, list-overview and control fixes. Signal, fonts, heading palettes, Motion, Verdict Score calculation, public URLs and free-tier infrastructure remain. No hosted migration, production deployment, permission change, credential rotation, account repair or billing change is authorized by this document.

Source/CI/preview references and remaining acceptance results are updated below after verification. Local evidence is distinguished from hosted acceptance throughout.

## Findings and disposition

| Finding | Root cause and change | Status |
| --- | --- | --- |
| Username falsely available during failures | Endpoint discarded PostgREST errors. Errors/timeouts now return uncached 503; valid literal, case-insensitive names are checked with escaped underscores. | Fixed and Verified locally; Awaiting Production Verification |
| Slow/redundant/obsolete username checks | 400ms debounce, no response invalidation, repeated submission read. 250ms debounce, obsolete-response suppression, bounded request timeout, per-form deduplication and 15-second hints. Invalid/checking/available/taken/unavailable are distinct. | Fixed and Verified locally |
| Case-insensitive name integrity | Existing uniqueness was case-sensitive; direct profile edits lacked common validation. Proposed migration adds a lower-case unique index and validation trigger, preserving legacy identities. Hosted preflight found zero case collisions, one non-normalized name and two legacy format exceptions. No identities were renamed. | Fixed but Awaiting Production Verification/application approval |
| Inconsistent new-password rules | Signup/reset imposed eight characters plus letter/number; exported Auth minimum was six. Shared 15-code-point policy, passphrases, paste/autofill, 72-byte bcrypt ceiling, visible labels and keyboard-accessible reveal buttons. Login does not reject older valid passwords. | Partially Fixed: local provider minimum is 15; hosted minimum change still pending |
| Generic transactional mail | Custom Resend SMTP already existed; templates were generic. Four responsive, inline-style, tracking-free confirmation/recovery/change-email/magic-link templates preserve `ConfirmationURL`. Signup/recovery were actually sent through local Mailpit and followed in the browser. Resend has a 60-second UI cooldown. | Fixed but Awaiting Production Verification/template approval |
| Verification callback host change | Actual loopback signup changed 127.0.0.1 to localhost, losing the session host. Origin selection now accepts only the original, configured site/deployment or equivalent loopback listener; arbitrary forwarded hosts are rejected. | Fixed and Verified locally |
| Inferior anticipated/Explore artwork | Local catalogue matches used IGDB covers, untracked RAWG discoveries used backgrounds/screenshots. Conflicting fit classes defeated intended containment. Batched, cached IGDB cover resolution now checks exact titles/aliases, release year, ambiguity and studio where supplied; explicit fit styling resolves class conflicts. | Fixed and Verified on real catalogue renders; preview acceptance pending |
| Same-title artwork collision | Visual inspection found an older unrelated Exodus cover despite an exact title. Added release/studio disambiguation and a real-title regression; ambiguous matches are rejected. Correct Archetype cover is `coaott`, not the unrelated `co7t7g`. | Fixed and Verified locally with actual provider data |
| Re-enrichment could downgrade posters | RAWG landscapes preceded verified Steam posters, and one ingestion path overwrote existing media. Both pipelines now prefer IGDB/verified Steam portraits and preserve better existing covers and provenance. | Fixed and Verified by targeted regression; hosted maintenance verification pending |
| RAWG repeat requests and malformed responses | Runtime reads lacked deduplication, malformed-response cooldown and missing-endpoint memory. Added bounded in-flight deduplication, timeout/cooldown, single recovery probe and bounded 404/410 negative caching. Existing scheduler retries/backoff/circuit/advisory locks remain. | Fixed and Verified with simulated failures |
| No durable anticipated discovery snapshot | Next cache alone cannot survive every cold deployment/cache loss. Public requests now read the existing service-only `gx_cache` under `discovery:rawg:upcoming:v1`; the existing discovery worker writes only validated, nonempty successful snapshots. Original freshness survives downtime. No new table/service or public-request write. | Fixed locally; first hosted worker snapshot pending release |
| Misleading Explore semantics | Legacy identifiers were retained while labels/queries diverged. New Releases lacked a 30-day floor; Top 250 cut candidates before proper ranking/deduplication. Full eligible catalogue chunks are now ranked before pagination, using the existing confidence function. | Fixed and Verified locally; real-data Top 250 verification recorded below |
| Next cache entry overflow | Real-data testing exposed 3.9–5.3MB aggregate genre entries, exceeding Next's 2MB limit. Independently cached 250-row chunks exclude descriptions after safety checks, with two concurrent reads. | Fixed and Verified on actual catalogue; cold-read latency remains a limitation |
| Heavy Lists overview and hidden failures | Overview fetched memberships for all lists, returned complete game records and swallowed failures as successful empty arrays. Public server initial data and cached, paginated summaries now return at most four thumbnail records per collection; failures return 503. My Lists uses a separate authenticated, uncached owner query/key. | Fixed and Verified locally; hosted personalized acceptance pending |
| Awkward list mosaics | Four portrait covers were cropped into landscape quadrants; fewer than four fell back inconsistently. Overview uses equal portrait slots at an 8:3 combined ratio, centered 1–3 covers and an intentional empty fallback; no repeated fake covers. | Fixed and Verified locally |
| Filter spacing and theme mismatch | Inline labels collapsed against controls; shared sort used fixed dark colors. Labels now have an 8px block gap; controls are 44px high with 16px left/40px right padding, existing control-border tokens, native menus and visible focus. | Fixed and Verified in both themes/three widths |
| Continuous heading motion control | Reduced-motion/offscreen pausing existed; normal-motion users lacked a persistent pause control. Footer control now pauses/resumes animated headings without altering any palette. | Fixed and Verified locally |

Statuses above do not establish production security, NIST conformance, universal accessibility, legal compliance or perfect metadata accuracy.

## Competitor research: observed versus inferred

Actual Chrome renders, text/control observations and screenshots are in `output/playwright/refinement-research/`. No private competitor account was created and no protection was bypassed. Internal architecture, ranking weights and caching are unknown unless explicitly documented.

| Platform | Actual observation / limitation | Relevant decision |
| --- | --- | --- |
| [PlayNest](https://playnest.dev/games) | Rendered browse grid, platform/genre/year/game-type/theme/mode/perspective facets, popularity control and separate anticipated/wishlisted/trending discovery navigation. | Keep VerdictGames navigation; add only populated platform/year/category-appropriate sorting. Do not duplicate its sidebar or add hundreds of facets. |
| [RAWG](https://rawg.io/discover/popular-in-2025) | Popular-in-2025 rendered with Popularity, Platforms and display controls; its displayed ordering differs from VerdictGames. Best-of-year and all-time browser requests returned Cloudflare host 502s. | Distinguish popularity from quality; retain explicit source labels. No assertion that public `-added` or `-rating` reproduces website internals. |
| [Backloggd](https://backloggd.com/lists/) | Browser returned an access-denied interstitial (HTTP 200, not content). | No invented visual findings. Community reports describe difficulty browsing lists; official product discussions describe organization, list/grid and official-source cover requirements. |
| [IGDB](https://www.igdb.com/) | Browser blocked by Cloudflare; public API documentation accessible. | Existing integration and documented portrait CDN, identity and metadata fields used; no assumption about blocked UI. |
| [SteamGridDB](https://www.steamgriddb.com/) | Rendered separately classified grids/heroes/logos/icons and visible 600×900 versus 920×430 submissions. API/terms pages did not yield readable text in the text tool. | Asset role and ratio matter. No new integration or unrestricted-rehosting assumption; rights/terms remain unresolved. |
| [OpenCritic](https://www.opencritic.com/) | Rendered separate Popular, Recently Released, Upcoming, Hall of Fame and score treatment. | Upcoming interest and reviewed quality remain distinct. No new commercial score integration. |
| [Metacritic](https://www.metacritic.com/game/) | Rendered New Releases, Upcoming with TBD, and platform discovery. | Unknown scores/dates remain unknown; no fabricated quality score for unreleased games. |
| [Steam](https://store.steampowered.com/search/) | Rendered dense rows with release dates, relevance sorting, price/discount and filtering. | Preserve content density and meaningful sorting; existing Steam reviews/activity remain separate metrics. |
| [SteamDB](https://steamdb.info/) | Browser explicitly denied access and asked scrapers to use Steam. | Respect the restriction. No scraping or assumed API/implementation. |
| [Letterboxd](https://letterboxd.com/lists/) | Browser verification interstitial; publicly indexed first-party list pages document Featured/Popular/Crew groups and name/popularity/updated/published sorting. | Editorial/community/My Lists separation and compact poster summaries adopted as product patterns, not copied branding. |

Community context: [GameVault's firsthand RAWG/IGDB migration account](https://gamevau.lt/blog/2024/05/07/), [its Reddit discussion](https://www.reddit.com/r/selfhosted/comments/1cly5yz), [Backloggd organization discussion](https://www.reddit.com/r/backloggd/comments/1wi6vdt/organization_update_backloggd_118_update_has/), [list-discovery discussion](https://www.reddit.com/r/backloggd/comments/1jhe34r), and [a public IGDB-backed implementation](https://github.com/LizardByte/GameDB). These are experience reports, not evidence of today's provider uptime or permission to copy assets. Targeted Hacker News searches produced no sufficiently relevant primary technical discussion to adopt. No claimed competitor source-code discovery where none was available.

## Artwork and providers

Pipeline traced: provider metadata/backgrounds → Next and standalone ingestion → `games.cover_image/header_image/media_source` → Explore catalogue/RAWG reconciliation → homepage anticipated projection or Explore JSON → `HeroImage`/`SafeImage` → provider CDN loader → clipped card. RAWG backgrounds had been treated as portraits; increasing JPEG quality could not fix their source composition.

All ten requested examples were reproduced from real discovery data: Path of Exile 2, No Rest for the Wicked, Tomb Raider: Legacy of Atlantis, Tomb Raider: Catalyst, Titan Quest 2, The Expanse: Osiris Reborn, Ananta, Rayman Legends Retold, Until Dawn 2 and Exodus. Catalogue-matched posters are retained; previously untracked entries use verified identity matching before accepting an IGDB portrait. No hosted game record was repaired or overwritten.

Portraits: trusted IGDB cover, then verified Steam portrait, then aspect-aware landscape fallback. Wide heroes retain their separate landscape selection. Steam 404/410 absence is cached for a day; transient failures are not cached as proof of absence. Fixed Steam IDs/CDN hosts and validated IGDB image IDs avoid arbitrary server URL fetches in the new resolver. Existing Next redirect limit stays zero. Unknown external `SafeImage` sources retain browser delivery rather than an unrestricted server optimizer.

Existing provider resizing remains: IGDB cover sizes chosen for rendered width/DPR; RAWG uses known valid 640/1280 widths. No new Vercel optimizer volume, image package, arbitrary upscaling, artwork rehosting or invented border-removal claim. Genuine dark artwork is not auto-cropped based on a black-pixel heuristic. Remaining intrinsic borders or ambiguous/missing covers use the fallback and require human metadata repair.

| Provider | Appropriate role / current constraints |
| --- | --- |
| [IGDB API](https://api-docs.igdb.com/) | Existing metadata/covers/releases/platforms/genres/popularity integration. Documented 4 requests/sec and 8 open requests; non-commercial use is free under Twitch terms. Commercial/artwork-rights review remains an owner obligation. One bounded cover batch is cached; no per-card title searches. |
| [RAWG](https://rawg.io/apidocs) | Existing cross-platform metadata and community library statuses. Published free plan says 20,000 calls/month and non-commercial projects; the same page contains older conflicting commercial text. Do not infer a commercial grant. Active attribution links now appear in the shared footer. |
| [Steam/Steamworks](https://partner.steamgames.com/doc/store/assets/libraryassets) | Existing PC metadata, review and activity sources; official portrait/library role is documented. PC-only coverage and missing assets remain real limitations. Public asset access does not convey blanket rehosting rights. |
| [SteamGridDB API](https://www.steamgriddb.com/api/v2) | Potential curated alternate artwork; not adopted because API/rights/quota terms were not independently established here. Community uploads are not automatically official licensed key art. |
| Supabase catalogue | Durable foundation: 8,350 stored records observed. Does not turn stale data into current popularity. Existing editorial lists, discovery, local search, game metadata and user features remain useful during a provider outage. |

RAWG probes on November 15 returned JSON 200 in 525/434ms in one recorded baseline, while some public discovery pages returned 502. This is mixed availability, not evidence of shutdown. No 401/403/429 was observed in those actual probes; simulated failures are separate evidence.

Dependency inventory: local search first, external augmentation in `services/search.ts`; untracked game details in `services/game-detail.ts`; RAWG-first new ingestion in `services/ingest.ts` and `scripts/lib/ingest-pipeline.mjs`; anticipated discovery in `services/upcoming-snapshot.ts`; discovery/backfill/re-enrichment jobs use the scheduler RAWG client/health guard. Genres, stored dates/covers/scores and local rankings are indirectly RAWG-derived but are served from Supabase. Steam refresh, existing auth, reviews, libraries and local list reads do not require live RAWG.

Indefinite outage: existing catalogue/search/filter/rankings/details, stored media links, accounts, reviews, libraries and lists continue if Supabase and the image hosts remain available. Existing Steam/IGDB/GX capabilities remain independent. RAWG-first ingestion/augmentation cannot guarantee new coverage; last-verified RAWG interest counts become stale. Durable discovery exists after the first successful post-release worker snapshot. Before that first snapshot, a cold instance falls back to known upcoming catalogue rows with missing interest counts, not invented replacements. Next's own successful cache adds another retention layer but is not a backup guarantee.

## Ranking and controls contract

Legacy URL/API identifiers are retained intentionally for compatibility; they are not RAWG endpoint promises.

| Category | Eligibility and order | Source/evidence/date/cache/fallback |
| --- | --- | --- |
| `best-of-year`: Most Anticipated | RAWG upcoming query uses date range today through three years, `-added`, excludes additions; known returned past releases are excluded unless TBA. Awaiting-full-release/Early Access interpretation remains provider-reported. | RAWG `added` is all library additions, **not wishlists**; `toplay` is want-to-play. Snapshot six hours; durable original timestamp retained; >12-hour stale notice. Cold failure uses stored upcoming/status records and explicitly absent RAWG counters. |
| `popular-in-year`: Best of selected year | Released primary, safe games in selected year, ≥100 reviews; existing confidence-weighted ranking. Popularity option uses review volume and is named accordingly. Current/previous/older year selector. | Stored Verdict Score and ranking score are distinct fields; no RAWG or Metacritic score substitution. Six-hour chunks. |
| All-Time Top 250 | Released primary games, ≥100 reviews; excludes known cancelled/unreleased/Early Access statuses; existing confidence function, canonical deduplication, stable slug ties, then first 250. | VerdictGames ranking. Platform filter retains original absolute ranks; alternative sorts are not offered. Full eligible candidates are read before ranking/pagination. |
| New Releases | Today back 30 days; excludes known unreleased statuses; release date descending, stable ties. | Stored release date, not insertion date. Existing calendar remains the path for chronological upcoming/week browsing; no duplicate thin annual pages. |
| Genre | Existing populated mappings, primary safe released games; review-volume default. Highest-rated requires ≥100 reviews. | Explicit RPG mapping retained; platform/name/release/catalogue-added controls act on complete eligible pool before pagination. No fabricated developer/franchise facets for sparse data. |

All catalogue chunks include date/type/year/genre/offset in cache identity. Complete set is filtered/ranked before the requested page is selected. The current 20,000-row read budget fails visibly rather than silently mis-ranking a truncated pool; an indexed SQL read model is a future scaling option if measured growth requires it. Cold full-catalogue reads can take seconds and may fail during transient DB/network timeouts. Warm actual Top 250 responses were 54/56/86ms in one local run. This is not production latency or a load-capacity guarantee.

Explore controls use shareable URL parameters, reset/page reset, refresh and browser history. All-Time retains its defined rank. Grid/list view, extra franchise/store/tag facets and weekly release sections were evaluated but deferred: no demonstrated need to duplicate the current calendar or existing browse paths.

## Auth, mail and security limits

Guidance: [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html), [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [Supabase password security](https://supabase.com/docs/guides/auth/password-security), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp) and [rate limits](https://supabase.com/docs/guides/auth/rate-limits). Fifteen characters/no arbitrary composition follows NIST's single-factor benchmark; the bcrypt byte ceiling limits some long Unicode passphrases. This is not a claim of complete NIST compliance.

Exported hosted settings observed: password minimum 6, no composition requirement, leaked-password protection false, confirmations enabled, OTP expiry 3600s, secure email change enabled, password-update reauthentication false; Google and Discord enabled. SMTP is `smtp.resend.com:465`, sender `auth@verdict.games`, name Verdict Games, Auth email limit 15/hour. These are configuration observations, not a fresh test of secret validity or mailbox delivery. No secrets are included here.

DNS reads found Resend DKIM and `send.verdict.games` SPF; `_dmarc.verdict.games` is `p=none`. DNS presence does not prove delivered headers or alignment. Resend's [published free quota](https://resend.com/docs/knowledge-base/account-quotas-and-limits) is 100 transactional messages/day and 3,000/month; actual account plan/usage was not queried. No replacement service or DNS change is necessary merely to brand the mail.

Hosted approval proposal: set only Auth `password_min_length` to 15, keep composition blank, install the four reviewed template bodies/subjects, preserve verification/callback/OAuth URLs and current SMTP secrets. Magic-link template is prepared, not an added login feature. Consider provider-supported security notifications/reauthentication only with a tested nonce UI and separate approval; they are not silently enabled.

Common/repeated-password feedback uses a small local denylist, not a comprehensive breached-password corpus. Supabase's maintained leaked-password protection requires Pro. No raw password was sent to an application API, logged or copied to another service, and no second password store was created. Comprehensive compromised-password enforcement on the existing free plan remains **Deferred**; do not describe the small frontend list as authoritative provider protection.

Username uniqueness is authoritative only after the proposed migration is applied. The indicator is a short-lived hint, not a reservation. Existing unique constraints still prevent exact duplicates before migration. Reserved-name normalization is enforced by the new trigger for new/changed names; legacy identities are retained. Existing request limits/WAF remain; no protection was disabled for testing.

## Lists, measurements and visual evidence

Baseline `/api/lists` overview response: **465,873 bytes** in one recorded run, with 4,621/2,303/15,288ms local samples (development/network variance included). Revised summary samples: **26,777 bytes**, 28/16/15ms warm; another earlier cold summary took ~2,590ms. Payload reduction is about **94.3%** for that same public catalogue. These are actual samples with different cache warmth, not a claimed universal speedup. Public summary TTL is 300s; private My Lists has all three no-store header levels and an identity-specific React Query key removed on account switching.

Before images: `output/playwright/refinement-before/`; after images and JSON: `output/playwright/refinement-after/`; local signup evidence: `output/playwright/refinement-auth/`. Real catalogue reads supplied artwork; synthetic fixtures were used only for auth/ownership/failure cases. Full-page screenshots may include offscreen lazy images before a later scrolled capture; they are not proof of a failed image. No private hosted screenshots or credentials were saved.

Representative comparison: [Explore before](../../../output/playwright/refinement-before/explore-dark-1440.png) / [after](../../../output/playwright/refinement-after/explore-dark-1440.png), [Lists before](../../../output/playwright/refinement-before/lists-light-390.png) / [after](../../../output/playwright/refinement-after/lists-light-390.png), [Search before](../../../output/playwright/refinement-before/search-dark-1440.png) / [after](../../../output/playwright/refinement-after/search-dark-1440.png). Browser geometry measured 8px label gap, 44px select height and 16px/40px horizontal padding. Existing collapsible mobile filters are preserved.

## Skills and review discipline

No additional skill installation was required. Public instruction text was reviewed as data, not executed. `output/refinement-guidance/inventory.json` records version-pinned URLs and SHA-256 for ten requested ECC skills and Marketing Skills SEO audit.

- Preferred ECC upstream: `affaan-m/ECC`, `d2ef2680594f9a17526a6e1a2e18b3d242c5d17b`, MIT, last push November 15. Overlapping WorldFlowAI copy: `432485ba6b92c14fb357276a98957f348bcff9ee`, last push January 23; repository API did not expose a license. Upstream has current Codex compatibility; neither full configuration was installed.
- `verification-loop` and `tdd-workflow`: focused failing username/provider regressions, then passing checks and explicit local/target distinction. Coverage percentages were not invented or treated as a safety proof.
- `security-review`, `coding-standards`, `frontend-patterns`, `backend-patterns`, `postgres-patterns`, `deployment-patterns`, `e2e-testing`: error admission, identity scoping, small typed payloads, cache bounds, SQL constraints, rollback and actual browser journeys. Example Redis/Zod/Docker additions are not requirements to install infrastructure/dependencies.
- `skill-stocktake`: evaluated, not executed. It targets Claude directories, shell scripts and a persistent results cache and can delegate batches; unnecessary for this repository. No hooks, global configs, scanner, memory system or permission changes were installed. ECC application security guidance is distinct from AgentShield; no AgentShield package was run.
- Existing Supabase/Postgres skills: RLS/effective privileges, fixed search paths, indexed uniqueness and local-only migration verification. Existing Vercel React/Web Interface guidance: server initial lists, no auth waterfall, labels/focus, URL state, reduced-motion control. UI/UX Pro Max and animation guidance were evaluated against the existing product; their redesign suggestions do not override Signal/palette preservation.
- Marketing Skills `seo-audit` at `1f837447b20bb6f0e72d87b80ece1c221c362c7d`: faceted crawl/canonical checks and browser schema inspection guidance. No marketing scripts/tracking installed.
- Vercel deployment/protected-preview guidance: exact team/project/head and preview-only workflow. Existing Playwright runtime used; no app dependency added. Reviews were separate passes by this agent, not falsely claimed independent reviewers.

## Targeted coverage matrix

| Area | Evidence / boundary | Disposition |
| --- | --- | --- |
| Product/navigation/onboarding | Existing routes/design retained; URL controls, visible signup feedback, actual local verification/recovery | Fixed and Verified locally |
| Frontend/responsive/accessibility | Real-data 390/768/1440 dark/light renders, overflow/fit/control measurements, focus and heading pause; existing reduced-motion suite retained | Verified locally; hosted visual acceptance pending |
| Backend/API contracts | Username failure 503; overview summaries; explicit list errors; bounded catalogue pages; all private headers | Fixed and Verified locally |
| Database/RLS/indexes/concurrency | Existing privacy proposal retained; 43 migrations replayed and restored in disposable databases; new name index/trigger race tested | Fixed but Awaiting Production Verification |
| Auth/OAuth/sessions | Local email signup/login/reset; existing two-user tests; Google/Discord preserved, no new OAuth provider authorization attempted | Partially Fixed / hosted callback acceptance pending |
| Security/privacy | Prior cache/authorization work reused; scoped new APIs and callback-origin adversarial tests; no new raw HTML or upload path | Verified within tested scope; not a penetration-test claim |
| Media/files | Actual ten-game identity/crop checks, provider CDN sizes, no rehosting/new optimizer; existing upload restrictions retained | Fixed and Verified locally |
| Background/provider jobs | Existing bounded scheduler/backoff/lock; nonempty durable discovery snapshot added to existing job | Local verification; first hosted successful snapshot pending |
| Search/discovery | Complete-pool order/deduplication/page semantics, confidence evidence, released date floor, URL/history | Fixed and Verified locally |
| Admin/content | Admin seed path retained; no real list/game repairs, role changes or admin writes | Prior evidence reused; specific data repair deferred |
| Analytics/operations | Existing provider usage, scheduler outcomes, Vercel analytics/speed insights retained; no new tracking service | Verified source configuration; no fresh production load/usage claim |
| Tests/CI/supply chain | Existing Vitest/TypeScript/lint/build, local browser/security/replay checks; Mailpit refinement flow added to existing pinned CI | Results below; exact-head CI required |
| Hosting/CDN/infrastructure | Correct intended team/project per prior candidate; public/private cache separation retained | Earlier evidence reused; new preview/production checks separate |
| Performance/scalability/cost | Measured summary bytes/timings; chunked cache under 2MB; capped concurrency and failure budgets | Fixed and Verified locally; production CWV/load capacity not measured |
| Backups/recovery | R3 checksum independently rechecked, matches prior; old local restore evidence retained | Partially Verified; portable/offsite gate open |
| SEO/indexing | Existing paths/canonical/sitemap retained; no thin facet pages; [Google faceted-navigation guidance](https://developers.google.com/crawling/docs/faceted-navigation) considered | Source/browser checks; Search Console indexing unavailable |
| Email/notifications | Local Mailpit actual confirmation/reset; prepared change-email/magic-link; current SMTP/DNS observed | Partially Verified; hosted install/delivery acceptance open |
| Legal/licensing/retention | Provider terms/attribution reviewed; no new collection/tracking/rehosting; [MeitY phased commencement](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf) and [final rules](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf) consulted | Owner/legal review needed; no blanket compliance assertion |
| Support/docs/maintenance | Prior runbooks retained; this consolidated incident/release note documents fallback/limits/owner steps | Updated |
| Payments/subscriptions/refunds/invoices/GST/PCI | No payment processing or paid subscription feature in scope | Not Applicable to this release; monetization changes require reassessment |
| Multi-tenancy/CRM/SMS/WhatsApp/push/queues/Kubernetes | No demonstrated product requirement | Not Applicable; no infrastructure added |

India-specific note: the November 13, 2025 notifications phase commencement; relevant provisions do not all start together. Account data, deletion/grievance routes, retention, children and processor/transborder arrangements need owner/legal assessment against applicable effective provisions. No assumption that GDPR/PCI applies merely because a generic checklist mentions it.

## Recovery, credential status and release gate

Owner confirmed only running `Export-HostedConfig.ps1`; **rotation is not confirmed**. Do not infer rotation from an export, key signature match or successful CI. No hosted credential was printed or changed in this work. Refresh encrypted configuration only after actual application/DB/JWT/OAuth/SMTP/integration credential changes are identified.

R3 remains `c00c42f81f8526fc848356350c97d9a859a6741f3c48a0fa7b9ee9ae1f4e11af` (SHA-256 rechecked this session). The existing independent offline restore proved 64 table counts, policies, grants and Storage hash; this is reused evidence, not a new restore claim. The portable helper's earlier synthetic round trip is not real portable recovery.

Owner selected **Google Drive**. No Drive filesystem mount was observed; connection was offered, not assumed installed. The private helper requires an owner-entered passphrase and an existing explicit destination outside Git. Do not upload plaintext exports, `.env`, DPAPI key or the passphrase. Required offsite artifacts are the encrypted R3 archive and passphrase-encrypted portable-key package; escrow the passphrase separately. Actual remote upload, fresh remote download, SHA-256 equality and opening the archive with the remotely recovered portable key remain unverified.

Hosted mutation proposal for later explicit approval: use only existing disposable accounts A/B; create one temporary library row per account for a specified existing public test game, one A-owned private list with a single item, and one reversible helpful-vote toggle on an approved fixture review. Check anonymous/B denial and A success through API and direct Data API; remove only created fixture IDs and restore the original vote. Exact IDs and before-values must be resolved into a concrete fixture manifest before executing. No real user record, review or collection may be edited. No hosted writes of these types occurred here.

Release sequence remains the prior controlled procedure, with the new username migration and Auth-template/minimum proposal added: (1) finalize exact source head/CI/correct protected preview; (2) complete credential, portable/offsite and old-integration ownership gates; (3) obtain one consolidated final approval for specified hosted actions; (4) take a current recovery point and preflight SQL; (5) apply approved privacy/username changes in order with compatible code; (6) deploy only to the intended project, invalidate affected personalized/public discovery/list caches; (7) verify anonymous/A/B isolation, CDN HIT controls, auth/mail/SEO/artwork/maintenance; (8) rollback only compatible application changes, never restore insecure grants or pre-privacy permissions.

Privacy SQL remains `supabase/migrations/20261114121612_isolate_private_profile_library_and_avatars.sql`; username SQL is `supabase/migrations/20261115094938_enforce_username_integrity.sql`. Checksums, exact commit, CI and correct deployment are recorded in the final evidence update below. No approval request to merge or deploy is implied while required gates remain open.

## Final verification update

Local final checks passed: **247 tests in 38 files**, TypeScript, production build (68 routes), lint (zero errors; six warnings in unrelated local one-off scripts), dependency audit (zero vulnerabilities), 43-migration replay and synthetic restore, 120 API/Data API/Storage/mutation checks, provider-maintenance outage checks, two-identity browser login/switching and all 15 new signup/confirmation/recovery/private-summary checks. No dependency or lockfile changed.

Earlier in this implementation, 24 real-catalogue renders covered Explore, Lists, Search and the homepage anticipated rail at 390/768/1440px in both themes; URL refresh/back and persistent heading-pause checks passed. Seven-page live catalogue verification returned 250 unique Top 250 entries, consecutive ranks 1–250 and preserved ranks after PC filtering. Those measurements predate the final strict snapshot-admission and Early Access label changes. They do not establish final-head visual acceptance.

The final local repeat did **not** pass: a direct anonymous Supabase catalogue read timed out at 10 seconds, and the app returned 503 for Top 250. A preceding development-server screenshot attempt also timed out. Existing screenshots are retained with their original timestamps; no successful latest render or fresh provider-health claim is inferred. Latest full responsive/heading regression will run in isolated CI; final real-catalogue preview acceptance remains open.

Reviewable implementation commits: `778ec53` (authentication), `600ea18` (artwork/provider/Explore), `e1121d1` (Lists/controls/motion). Verification, evidence and this report form a separate change set. Exact final head, CI and protected preview will be recorded after the authorized branch push; previous candidate CI is not attributed to this work.

SQL SHA-256 (local proposals only):

- Privacy: `9c8d5f18d33451338320b5a150e5fc5fbf8d0665496384d39fd192d9dd7f2755`.
- Username: `27dd8ecd7dd6458c9460c39175ff2e846a566178db6a6ae7bb868f1bacbb8a09`.

Required owner gates remain credential remediation, actual portable/offsite recovery, old integration ownership, hosted email/auth acceptance, populated authenticated fixtures with exact approved operations, and final visual acceptance. Production, hosted SQL/Auth settings and real user data remain unchanged.

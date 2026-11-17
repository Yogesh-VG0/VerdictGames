# Final candidate preparation — November 15

Current release decision and exact pending action proposal are maintained in [PRODUCT_REFINEMENT.md](PRODUCT_REFINEMENT.md), under November18 production release preparation. The owner now conditionally authorizes production after explicit dependency-risk acceptance and refreshed offsite recovery. The candidate below is a preserved historical checkpoint; use the latest remediation head and application-source comparison in the consolidated report for release.

**Production remains unchanged.** The owner authorized updating the existing remediation branch and generating its protected preview. Merge, production deployment, hosted privacy permissions, history/data repair, billing and infrastructure changes remain separately gated.

## Immutable candidate

- Commit: `79167eed007dee6633b68d14264c4149269ba785` on `remediation/validated-security-and-signal`, PR #6.
- Main/base remains `94011f269dad78f45dc8449198da6d88adec16d7`.
- Changed in this follow-up: `src/components/ui/GradientText.tsx`, `scripts/test-local-ux-browser.mjs`, `docs/audits/2026-11-14/SIGNAL_IMPLEMENTATION.md` only. Existing local audit/screenshot changes were not staged. No dependency or lockfile change.
- [Quality/build/dependency checks](https://github.com/Yogesh-VG0/VerdictGames/actions/runs/43692211712): SUCCESS.
- [Security/browser/recovery checks](https://github.com/Yogesh-VG0/VerdictGames/actions/runs/43692211716): SUCCESS. Step-level evidence is in `final-candidate-ci.json`.
- Correct-team preview: `dpl_mkHvWtHGJWiSQCPZAPC1ts713xAC`, READY, exact commit above, under project `prj_vg8APVv7HRncrYJCkiti95FyfaqD` / team `team_IZjGDcej6BUnVM4IHK165gfb`.
- URL: https://verdict-games-hiwob14vd-yogesh-vg0s-projects.vercel.app
- Production still serves `dpl_HMoTAbkMJUwNxLg3e9tCnkyVH2FS` from main `94011f2`.

## Heading behavior and evidence

The original animated palettes and three-second linear cycle are restored across the existing `GradientText` call sites, including the headings passed through `SectionHeader`. A TypeScript AST comparison found all 16 `gradient` attributes on those two components unchanged from the pre-remediation baseline. The default palette and optional neon treatment are preserved. Action/score colors were not redesigned.

Animation starts only when the normal-motion preference is known and the heading is near the viewport. Explicit static targets stop movement for reduced motion and offscreen headings; the neon duplicate remains `aria-hidden`. Existing Motion and IntersectionObserver support are used; no new animation dependency.

Local results: 213 unit tests, six targeted cache-header unit assertions, TypeScript, focused lint, production build and 54 browser renders plus supplemental flows passed. New assertions compare actual gradient positions over time for visible, offscreen and reduced-motion headings in both themes. The initially interrupted local run left nine test games and one list; relationships were checked, then only those unowned fixture records were removed. No original user data or production record was touched.

These are functional motion checks, not a measured production frame-rate or PageSpeed improvement. Some local fixture artwork did not finish loading by screenshot time; those images are not substitutes for final preview artwork acceptance.

## Actual final preview

`final-preview-dom-checks.json` records 36 actual final-preview checks: six routes at 390/768/1440px in dark/light. Route headings, theme class, overflow and completed visible image failures were checked; no detected issues. This does not establish that every pending external image decoded or that all visual contrast has been accepted.

After application sign-in, six additional authenticated library DOM checks passed at the same three widths in both themes: JSON Auth 200, correct theme, no document overflow and no misleading Sign In control. `final-preview-signed-library-dom.json` records only generic DOM results. These empty-library checks bring the observed final-preview DOM cases to 42; they do not substitute for manual visual acceptance or populated-library testing.

The previously broken screenshot mechanisms were not retried. Complete manual visual acceptance on the actual protected preview:

| Page | Exact preview path | Check |
| --- | --- | --- |
| Homepage | [/](https://verdict-games-hiwob14vd-yogesh-vg0s-projects.vercel.app/) | Cinematic artwork; Trending/Most Anticipated/Discover/Gaming News palettes and motion; controls and navigation feedback |
| Game detail | [/game/hades](https://verdict-games-hiwob14vd-yogesh-vg0s-projects.vercel.app/game/hades) | Poster/hero crop, title/score hierarchy, trailer thumbnail/fallback and long content |
| Search | [/search?q=Hades](https://verdict-games-hiwob14vd-yogesh-vg0s-projects.vercel.app/search?q=Hades) | One usable search field, filters, keyboard focus and pending/error feedback |
| Explore | [/explore](https://verdict-games-hiwob14vd-yogesh-vg0s-projects.vercel.app/explore) | Heading, artwork, tab/chip reachability and catalogue results |
| Lists | [/lists](https://verdict-games-hiwob14vd-yogesh-vg0s-projects.vercel.app/lists) | Mosaics, headings and empty/long-content layouts |
| Signed-in library | [/library](https://verdict-games-hiwob14vd-yogesh-vg0s-projects.vercel.app/library) | Existing disposable account, status controls, navigation, loading and recovery; no private screenshots committed |

Use both themes at phone 390x844, tablet 768x1024 and desktop 1440x1000. Check normal and reduced motion, visible focus, gradient legibility, loaded artwork and app sign-in state. Manual acceptance has not yet been recorded.

## Origin and CDN cache verification

Vercel consumes `Vercel-CDN-Cache-Control`; absence from the client-visible response is expected and is not a failure. The origin helper sets all three cache-control levels for private success/error responses. Unit and local HTTP integration tests check their actual origin values; the exact-head security workflow passed these tests.

On the actual protected preview, an anonymous session was confirmed by a real JSON 401 from `/api/auth/me`. Three identical requests each to Auth and Library returned 401; Recommendations returned 200. All nine responses had private/no-store browser and CDN directives, `Vary: Cookie`, `x-vercel-cache: MISS` and `Age: 0`.

Three identical public `/api/games/hades` requests returned JSON 200 and `x-vercel-cache` **MISS, HIT, HIT**. Public catalogue CDN caching therefore remains active under the same preview protection. No cache-busting query or client no-cache directive was used. Headers and statuses only are saved in `final-preview-anonymous-cache.json`.

The owner subsequently completed application login in two isolated existing-account sessions. Auth API responses confirmed **distinct identities**. Each session made two identical cookie-authenticated requests to Auth, Library, Library Stats, Recommendations, global Reviews and Hades Reviews: **24 successful JSON 200 responses**, all with private/no-store browser and CDN directives, `Vary: Cookie`, `x-vercel-cache: MISS` and `Age: 0`. No cache-busting parameter or client no-cache/Authorization header was added. Account A's identity remained stable after requests from B, and the original anonymous context still returned JSON 401.

Public Hades controls returned **MISS/HIT** in session A and **HIT/HIT** in B, showing that authenticated cookies did not disable public catalogue caching globally. The source origin-header configuration remains supported by the exact-head unit/HTTP integration checks; the consumed Vercel-targeted header was not expected in browser responses.

Evidence: `final-preview-authenticated-cache.json`, containing session labels, booleans and header/status results only. No account IDs, identity hashes, email addresses, notes, private library contents, tokens or screenshots were saved. **Both libraries were empty**, so hosted populated-library ownership, notes/hours, private-list and mutation isolation remain unexercised here. Do not promote these bounded preview observations into post-migration production acceptance. The local two-user fixture checks remain separate evidence.

Reference: [Vercel cache-control precedence and consumed headers](https://vercel.com/docs/caching/cache-control-headers).

## Recovery progress

The owner ran the reviewed private configuration exporter successfully. All three exports were parsed without revealing values; current local Supabase API-key signatures match the exported JWT configuration. The original verified archive SHA-256 remains `299dd84833f6384cd2d3bed8cd2bc32a32f0b003f04ebee30997720944aa9087`.

A versioned, encrypted `production-2026-11-15-recovery-r2.7z` includes the hosted configuration and updated private checksums. A subsequent **R3** additionally includes the self-contained offline restoration script and private recovery instructions. The final packaged procedure was rerun successfully from the preserved dump in a fresh local network-disabled container: all 64 table counts, policies, saved grants/effective privileges and the Storage-file hash passed again. All R3 archive entries passed `7z t`. R3 SHA-256: `c00c42f81f8526fc848356350c97d9a859a6741f3c48a0fa7b9ee9ae1f4e11af`. Both earlier archives remain unchanged. All private material remains ignored and outside the committed candidate.

See [the settings/secret inventory](RECOVERY_SETTINGS.md). The private portable-key helper passed syntax checks and a full **synthetic** round trip: encrypted key creation/recovery, dummy archive integrity and destination-copy hash equality. It has not yet wrapped the real key or uploaded the real backup. It requires a locally entered passphrase and an explicitly chosen existing offsite folder outside Git. It creates no plaintext archive-key file. The passphrase must be stored separately. Copying into a sync folder does not prove remote upload/read-back.

Still required: owner confirmation of credential rotation types, exact offsite destination, real portable key round trip, separate passphrase escrow and remote encrypted-copy verification. The current private `Complete-PortableRecovery.ps1` targets R3, prompts locally for the owner-chosen destination and passphrase, refuses Git/workspace destinations and overwrites, and checks portable-key recovery plus copied encrypted-file hashes. It has not been run with the real key. The existing environment file is unchanged from the earlier backup; that is evidence, not an assumption that no other credential was rotated.

## Old integration and security controls

GitHub metadata confirms a separate Vercel bot deployment for the previous head into `verdict-games-r7bqf2p4b-stocks-projects-6bb2b313.vercel.app`. The final commit's similarly named status again links to `stocks-projects-6bb2b313`, while the intended project's own deployment API independently confirms the correct READY preview. This establishes duplicate deployment reporting; it does not establish ownership or environment/database dependencies of the old project.

The old scope still returns 403 and is absent from the connected account's team list. Owner/dashboard access is needed to review its Git link, aliases, environments, shared database/integrations and any scheduler dependency before disconnecting anything. No project or integration was removed.

The intended project's firewall remains enabled, Bot Protection **Challenge**, AI Bots **Log**, with no new custom rule. Deployment protection and rate limits were not disabled. No paid service or additional infrastructure was introduced.

## Gate and rollback

The final application candidate, exact-head CI and bounded authenticated/anonymous preview CDN checks are ready. The overall release gate is **HOLD** until recovery/offsite arrangements, credential-rotation confirmation, manual visual acceptance and old-integration ownership/dependency review are completed. Populated-data/mutation and post-migration production acceptance remain later checks. Production rollout actions remain the independently reviewable sequence in `PRE_RELEASE_VERIFICATION.md`; no approval to execute it is implied.

Heading-only rollback: revert `79167ee` if necessary, preserving all earlier privacy fixes. After a hosted privacy migration, never roll back to an incompatible application or restore insecure grants. Refresh the production recovery point close to an approved rollout if intervening writes make the snapshot stale.

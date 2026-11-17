# Reviewed release proposal — approval required

Review branch: `remediation/validated-security-and-signal`. [Draft PR #6](https://github.com/Yogesh-VG0/VerdictGames/pull/6). No merge or production release has been performed.

## Application and privacy rollout

1. Review the independent commits, implementation statuses, and required GitHub checks. Confirm a private production backup/recovery point before any hosted permission/history/data repair; follow `RECOVERY_RUNBOOK.md`. The synthetic local restore is not a real hosted backup.
2. After explicit approval, merge/release the compatible application from this PR. Confirm Node 24 was selected and both custom domains serve the intended deployment. Preserve Bot Protection Challenge / AI Bots Log and existing DDoS protection.
3. Invalidate old personalized CDN responses for `/api/recommendations`, `/api/reviews`, `/api/games/*/reviews`, `/api/profile/*/reviews`, `/api/library`, `/api/library/stats`, `/api/auth/me`, and affected profile/settings responses. Check all three cache-header levels on successful **application** responses; an HTML checkpoint/429 is not verification. Confirm public catalogue endpoints still cache.
4. After the compatible app is live and the current grants/policies/functions are saved privately, apply only `supabase/migrations/20261114121612_isolate_private_profile_library_and_avatars.sql` atomically. It is local-tested and deletes no game/user data. Do not run the old schema dump or historical migrations against production.
5. Recheck effective privileges and real anonymous/two-disposable-user ownership, admin access, public profile/review joins, mutations, private lists, notes/hours, and avatar replacement. Verify all affected CDN responses after the change. Use fixture IDs for cleanup, with no existing user/game deletion.
6. Recheck public templates, canonical metadata, robots and the complete eligible sitemap against the current catalogue, excluding private routes, redirected aliases and existing safety exclusions. Run PageSpeed against the actual released templates and record lab/field limitations. The current branch has no claimed new production PageSpeed result.

Keep the compatible profile lookup and privacy headers during rollback. Reverting to an app that reads private raw profile columns is incompatible with restricted grants. If necessary, fix the narrowly scoped policy/helper forward; do not re-expose notes or roles to restore an old build.

## Separate optional / dashboard approvals

| Proposed action | Exact scope / review artifact |
| --- | --- |
| Main branch protection | Apply `proposals/main-protection.json` after the `check` and `security-regression` contexts are available; no forced pushes, deletion or automerge. |
| Dependency alerts | Enable GitHub vulnerability alerts; weekly Dependabot configuration is already in the branch. No paid feature or automatic dependency merge. |
| Function region | Change the single function region from `iad1` to `hnd1` for the intended new Vercel project; then measure actual latency/errors/CPU/memory. No latency reduction is assumed. |
| Dashboard Node default | Align project default 26.x with package/CI 24.x; confirm actual deployment runtime. No plan change. |
| Migration history | Fresh-check the type/backfill, then mark only `20260721000000` applied, as documented in `MIGRATION_RECONCILIATION.md`. Do not rewrite/replay recorded SQL. |
| Stored generated cons | Refresh the 319-row preview, privately back up original arrays, and review `proposals/repair-generated-cons.sql`. It defaults to rollback and removes only the unsupported exact generated sentence. |
| Calendar CDN values | Invalidate `/calendar`, `/api/calendar`, `/api/gx/calendar` on release. Historical durable payloads are safely filtered on read; no destructive snapshot wipe is needed. |

No automatic game merge or uniqueness constraint is proposed yet. The 54 duplicate groups include editions/legacy slugs and references requiring decisions before data changes. No paid leaked-password/PITR feature, new database, Redis, queue, framework or animation library is required.

## Verification limits observed during review

The correct connected Vercel team is `yogesh-vg0s-projects`, project `prj_vg8APVv7HRncrYJCkiti95FyfaqD`. Its review preview was confirmed READY through the Vercel plugin. Direct preview app probes reached an HTML WAF checkpoint (429), including the authenticated connector fetch, so they do not establish application cache headers or public PageSpeed behavior. Protection was not weakened.

A later GitHub Vercel check linked to `stocks-projects-6bb2b313`, which is outside the connected team and returned not-found in the intended team's deployment lookup. Review any old Vercel Git integration before a release; do not rely on that similarly named check alone as proof that the intended new project deployed. No old project, integration, domain or account was disconnected/deleted by this work.

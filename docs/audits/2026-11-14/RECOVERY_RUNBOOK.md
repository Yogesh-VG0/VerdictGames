# Recovery without a paid service

## Current evidence and limits

The read-only hosted backup listing on November 14 returned no listed backups and `pitr_enabled: false`. Do not assume that this Free project has a usable daily backup. No production export, restore, reset, or upgrade was performed. A Vercel rollback restores application code, not database contents.

`node scripts/test-migration-replay.mjs` successfully rebuilt all 42 repository migrations in a new local database, exported a custom-format backup containing a synthetic recovery row, restored into a second new database, and checked that the row and privacy privileges survived. Both generated databases were removed. This demonstrates the local procedure, not recovery of the hosted project's real data, passwords, Storage objects, or platform configuration.

## Before an approved hosted migration

1. Choose an encrypted private offsite destination and a retention period. Never commit backups, credentials, connection strings, or Auth data. `.private-backups/` is ignored as an additional guard, not encryption. Restrict filesystem access and check the destination before exporting.
2. With the existing project selected, use the installed Supabase CLI's `db dump --help` and current official backup guidance to export roles, schema, and data separately to that private destination. Capture credentials privately. Do not print `supabase status -o json`, database URLs, or backup contents into CI logs. Use a direct/pooler connection supported by that command; do not change live credentials to make an export work.
3. Inventory Storage buckets and **download the actual objects separately**. Database exports contain Storage metadata, not the stored files. Record Auth provider/redirect configuration, email templates, API restrictions, scheduled jobs, GitHub secret names, Vercel environment-variable names/scopes, domains, firewall rules, and deployment commit. Secret values belong only in the private recovery store.
4. Verify every export completed, record checksums privately, and record a recovery point timestamp. Keep a tested prior compatible app build. Pause the rollout if a required backup is missing.

## Restore drill and actual recovery

Restore only into an explicitly selected isolated target after approval; never run `db reset`, `schema.sql`, or a restore against production as a test. Follow the current Supabase restore ordering for platform-owned schemas, roles, extensions, and data. Restore Storage objects separately. Reconcile migration history with the restored schema instead of replaying already-applied migrations blindly.

Check effective grants/RLS, two disposable users plus anonymous access, admin access, public catalogue and SEO routes, private libraries/lists, uploads, authentication, external integrations, and maintenance. Compare row counts and selected checksums privately. Confirm email/auth redirect behavior without sending unsolicited messages. Record actual recovery duration and any missing data; no recovery-time or recovery-point guarantee has been measured yet.

Only after this drill succeeds and a cutover is approved should DNS, secrets, or production aliases change. Retain the prior target until rollback requirements are met. Revoke temporary recovery credentials after use. Do not weaken privacy grants to restore compatibility with an old app; retain the compatible private-profile lookup.

References: [Supabase backups](https://supabase.com/docs/guides/platform/backups), [CLI backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

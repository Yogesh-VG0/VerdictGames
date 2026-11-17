# Migration reconciliation proposal

No hosted history or schema was changed. Review the SQL diff and this evidence before approving a history repair.

| Version | Observed state | Repository action / proposed hosted action |
| --- | --- | --- |
| 20260404223411 | Recorded remotely, previously absent locally | Recovered recorded SQL into the audit archive and executable migration. The executable version fixes an old-index `regclass` cast that fails after an earlier rename; use null-safe `to_regclass`. Do not rerun it remotely. |
| 20260406113518 | Recorded remotely; repository used 20260406112000 | Rename to the recorded version; normalized SQL is identical. No remote repair needed. |
| 20260721000000 | Not in hosted history | Hosted `players_updated_at` exists as `timestamp with time zone`. Zero rows with `current_players IS NOT NULL` lack `players_updated_at`, including the subset without `last_enriched_at`. Its ADD COLUMN / null-only backfill would now be a no-op. Propose marking this version applied **only after approval and a fresh state check**. |
| 20261110190614 | Recorded remotely | Guard the revoke for optional managed `rls_auto_enable()` on fresh installations. When present it is still revoked. No remote replay/history rewrite. |
| 20261114121612 | New privacy migration, local only | Tested locally with effective privileges and real identities. Deploy compatible app first, then apply only this new migration after approval and backup. |

The original recovered SQL and username hash are documented in `recorded-migrations/README.md`. Git preserves the pre-fix historical files. All 42 repository migrations replayed successfully in a newly generated local database; a synthetic backup restored with its data and private privileges intact. The original local database was not reset.

After approval, preview the CLI migration list before any operation, recheck the one proposed backfill repair, mark only `20260721000000` applied, and compare the list again. Never mark the new privacy migration applied before executing it. Do not repair multiple versions indiscriminately, edit recorded SQL in production, or apply the repository's old `schema.sql` to a populated database.

Rollback: repository-only historical corrections can be reverted without touching production. A history-only repair can be reversed as a history operation if its evidence was wrong, after review; it does not undo column data. Do not undo the privacy boundary by restoring public library/role access.

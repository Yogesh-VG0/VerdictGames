# Recorded migration SQL

`20260404223411.sql` is the statement text recovered from production migration history. This directory is an audit archive, not an executable migration directory. Do not apply these archived statements to production.

The repository migration uses `to_regclass` in its final index-existence check. The recorded version casts the old index name directly to `regclass` after an earlier block may rename that index. Fresh replay fails at that cast. The null-safe lookup preserves the intended guard and fixes replay; production history has not been edited or re-run.

The username-trigger migration was moved from `20260406112000` to its recorded `20260406113518` version. Normalized SQL is identical (SHA-256 `5e242c3412a5333698e955893377ebd0ba3b89deb19910634404946f8fb8da0a`).

Fresh replay also found that `20261110190614` unconditionally revoked an optional Supabase-managed `rls_auto_enable()` function. The repository now guards that revoke with `to_regprocedure`. Existing projects still revoke it when present; projects without that helper can replay. The original file is preserved in parent commit `c798441`; hosted migration history is unchanged.

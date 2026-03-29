ALTER TABLE lists
  ADD COLUMN IF NOT EXISTS preview_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS body_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_system_managed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS system_key text,
  ADD COLUMN IF NOT EXISTS managed_by text,
  ADD COLUMN IF NOT EXISTS seed_version integer,
  ADD COLUMN IF NOT EXISTS seed_hash text,
  ADD COLUMN IF NOT EXISTS last_seeded_at timestamptz;

UPDATE lists
SET
  preview_text = CASE
    WHEN COALESCE(preview_text, '') = '' THEN COALESCE(description, '')
    ELSE preview_text
  END,
  body_text = CASE
    WHEN COALESCE(body_text, '') = '' THEN COALESCE(description, '')
    ELSE body_text
  END
WHERE COALESCE(preview_text, '') = ''
   OR COALESCE(body_text, '') = '';

UPDATE lists
SET
  is_system_managed = true,
  system_key = COALESCE(system_key, slug),
  managed_by = COALESCE(managed_by, 'system-curated-lists'),
  seed_version = COALESCE(seed_version, 1),
  seed_hash = COALESCE(seed_hash, md5(COALESCE(slug, '') || '|' || COALESCE(description, ''))),
  last_seeded_at = COALESCE(last_seeded_at, updated_at, created_at, now())
WHERE owner_id IS NULL
  AND (curated_by = 'editorial' OR curated_by = 'Verdict.games Editorial');

CREATE UNIQUE INDEX IF NOT EXISTS idx_lists_system_key_unique
  ON lists (system_key)
  WHERE system_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lists_is_system_managed
  ON lists (is_system_managed)
  WHERE is_system_managed = true;

CREATE INDEX IF NOT EXISTS idx_lists_managed_by
  ON lists (managed_by)
  WHERE managed_by IS NOT NULL;

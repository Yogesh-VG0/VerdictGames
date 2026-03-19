-- Migration 009: Provisional games + admin audit log
-- Adds is_provisional and release_status to games table
-- Creates admin_audit_log table for tracking manual changes

-- ── Games: provisional fields ──
ALTER TABLE games ADD COLUMN IF NOT EXISTS is_provisional boolean DEFAULT false;
ALTER TABLE games ADD COLUMN IF NOT EXISTS release_status text;

-- Index for filtering provisional games in admin views
CREATE INDEX IF NOT EXISTS idx_games_is_provisional ON games (is_provisional) WHERE is_provisional = true;

-- ── Admin Audit Log ──
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,        -- 'game', 'review', 'list', 'profile'
  entity_id text NOT NULL,          -- ID of the modified entity
  action text NOT NULL,             -- 'create', 'update', 'delete'
  field_changes jsonb DEFAULT '{}', -- { field: { old: ..., new: ... } }
  edited_by text,                   -- profile_id or email of the admin
  edited_at timestamptz DEFAULT now(),
  reason text                       -- optional explanation
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON admin_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_edited_at ON admin_audit_log (edited_at DESC);

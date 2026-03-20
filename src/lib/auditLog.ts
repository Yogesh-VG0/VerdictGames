/**
 * VERDICT.GAMES — Admin Audit Logger
 *
 * Shared helper for writing audit log entries from any admin mutation route.
 * Best-effort: failures are caught and logged, never block the response.
 */

import { getServerSupabase } from "./supabase/server";

export interface AuditLogEntry {
  entity_type: string;
  entity_id: string;
  action: "create" | "update" | "delete";
  field_changes?: Record<string, { old: unknown; new: unknown }>;
  edited_by: string;
  reason?: string | null;
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = getServerSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("admin_audit_log") as any).insert({
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      action: entry.action,
      field_changes: entry.field_changes ?? {},
      edited_by: entry.edited_by,
      reason: entry.reason ?? null,
    });
  } catch (err) {
    console.error("[AuditLog] Failed to write:", err);
  }
}

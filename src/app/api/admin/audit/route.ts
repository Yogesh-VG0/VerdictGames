import { jsonPrivateOk as jsonOk, jsonError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const supabase = getServerSupabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: readError } = await (supabase.from("admin_audit_log") as any)
    .select("*")
    .order("edited_at", { ascending: false })
    .limit(50) as { error: unknown; data: Array<{
      id: string;
      entity_type: string;
      entity_id: string;
      action: string;
      field_changes: Record<string, { old: unknown; new: unknown }>;
      edited_by: string;
      edited_at: string;
      reason: string | null;
    }> | null };

  if (readError) return jsonError("Recent activity is unavailable.", 503);
  return jsonOk(data ?? []);
}

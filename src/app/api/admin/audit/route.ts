import { jsonOk } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const supabase = getServerSupabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("admin_audit_log") as any)
    .select("*")
    .order("edited_at", { ascending: false })
    .limit(15) as { data: Array<{
      id: string;
      entity_type: string;
      entity_id: string;
      action: string;
      field_changes: Record<string, { old: unknown; new: unknown }>;
      edited_by: string;
      edited_at: string;
      reason: string | null;
    }> | null };

  return jsonOk(data ?? []);
}

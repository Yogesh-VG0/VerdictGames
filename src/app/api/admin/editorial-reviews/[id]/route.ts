import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;
    
    const { id } = await params;
    const supabase = await getServerSupabase();

    const { data, error } = await supabase
      .from("editorial_reviews")
      .select(`
        *,
        games!inner(id, title, slug, cover_image),
        profiles!inner(id, username, display_name, avatar_url)
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data) return jsonError("Editorial review not found", 404);

    return jsonOk(data);
  } catch (error) {
    console.error("[Admin Editorial Review] GET error:", error);
    return jsonError(error instanceof Error ? error.message : "Failed to fetch editorial review", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;
    
    const { id } = await params;
    const supabase = await getServerSupabase();
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      "title", "content", "score", "verdict_label", "pros", "cons",
      "playtime_hours", "platform_played", "version_reviewed",
      "is_published", "is_featured"
    ];

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    // Set published_at when first published
    if (body.is_published === true) {
      const { data: existing } = await supabase
        .from("editorial_reviews")
        .select("is_published, published_at")
        .eq("id", id)
        .single();
      
      if (existing && !existing.is_published) {
        updateData.published_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabase
      .from("editorial_reviews")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return jsonOk(data);
  } catch (error) {
    console.error("[Admin Editorial Review] PATCH error:", error);
    return jsonError(error instanceof Error ? error.message : "Failed to update editorial review", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;
    
    const { id } = await params;
    const supabase = await getServerSupabase();

    const { error } = await supabase
      .from("editorial_reviews")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return jsonOk({ deleted: true });
  } catch (error) {
    console.error("[Admin Editorial Review] DELETE error:", error);
    return jsonError(error instanceof Error ? error.message : "Failed to delete editorial review", 500);
  }
}

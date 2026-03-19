import { NextRequest } from "next/server";
import { jsonOk, jsonError } from "@/lib/api/response";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAuthSupabase } from "@/lib/supabase/auth";

/**
 * PATCH /api/profile/settings
 * Update current user's profile (display_name, bio, avatar_url, favorite_genres)
 */
export async function PATCH(request: NextRequest) {
  const authClient = await getAuthSupabase();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const supabase = getServerSupabase();

  const body = await request.json();
  const allowed = ["display_name", "bio", "avatar_url", "favorite_genres"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};

  for (const key of allowed) {
    if (body[key] !== undefined) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("No valid fields to update", 400);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("profiles") as any)
    .update(updates)
    .eq("id", user.id);

  if (error) {
    return jsonError("Failed to update profile: " + (error as Error).message, 500);
  }

  return jsonOk({ message: "Profile updated" });
}

/**
 * POST /api/profile/settings
 * Upload avatar — accepts base64 image, stores in Supabase Storage
 */
export async function POST(request: NextRequest) {
  const authClient = await getAuthSupabase();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const supabase = getServerSupabase();

  const body = await request.json();
  if (!body.avatar || !body.contentType) {
    return jsonError("avatar (base64) and contentType are required", 400);
  }

  // Decode base64
  const buffer = Buffer.from(body.avatar, "base64");
  const ext = body.contentType.split("/")[1] ?? "png";
  const path = `avatars/${user.id}.${ext}`;

  // Upload to storage
  const { error: uploadErr } = await supabase.storage
    .from("public")
    .upload(path, buffer, {
      contentType: body.contentType,
      upsert: true,
    });

  if (uploadErr) {
    return jsonError("Upload failed: " + uploadErr.message, 500);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("public")
    .getPublicUrl(path);

  const avatarUrl = urlData.publicUrl;

  // Update profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("profiles") as any)
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  return jsonOk({ avatarUrl });
}

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

  // Input length validation
  if (updates.display_name && updates.display_name.length > 100) {
    return jsonError("Display name must be 100 characters or less", 400);
  }
  if (updates.bio && updates.bio.length > 1000) {
    return jsonError("Bio must be 1,000 characters or less", 400);
  }
  if (Array.isArray(updates.favorite_genres) && updates.favorite_genres.length > 20) {
    return jsonError("Max 20 favorite genres", 400);
  }

  // Resolve profile row: try auth_id first, fallback to legacy id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileByAuth } = await (supabase.from("profiles") as any)
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  const profileId = profileByAuth?.id ?? user.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (supabase.from("profiles") as any)
    .update(updates)
    .eq("id", profileId)
    .select("id, username, display_name, bio, avatar_url, favorite_genres")
    .single();

  if (error) {
    console.error("[API] /profile/settings PATCH error:", error);
    return jsonError("Failed to update profile", 500);
  }

  return jsonOk({ message: "Profile updated", profile: updated });
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

  // Validate mime type server-side
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(body.contentType)) {
    return jsonError("Only JPEG, PNG, and WebP images are allowed", 400);
  }

  // Decode base64
  const buffer = Buffer.from(body.avatar, "base64");

  // Validate size server-side (2MB)
  if (buffer.length > 2 * 1024 * 1024) {
    return jsonError("Image must be under 2MB", 400);
  }

  const ext = body.contentType.split("/")[1] ?? "png";
  const filePath = `${user.id}.${ext}`;

  const AVATAR_BUCKET = process.env.SUPABASE_AVATAR_BUCKET ?? "avatars";

  // Upload to storage
  const { error: uploadErr } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, buffer, {
      contentType: body.contentType,
      upsert: true,
    });

  if (uploadErr) {
    return jsonError("Upload failed: " + uploadErr.message, 500);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(filePath);

  const avatarUrl = urlData.publicUrl;

  // Resolve profile row: try auth_id first, fallback to legacy id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileByAuth } = await (supabase.from("profiles") as any)
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  const profileId = profileByAuth?.id ?? user.id;

  // Update profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("profiles") as any)
    .update({ avatar_url: avatarUrl })
    .eq("id", profileId);

  return jsonOk({ avatarUrl });
}

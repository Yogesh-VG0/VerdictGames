import { jsonOk } from "@/lib/api/response";
import { requireAdmin } from "@/lib/admin";
import { getEditorialSeedSummaries, seedEditorialLists } from "@/lib/admin/seedEditorialLists";

export async function POST() {
  const { user, error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const results = await seedEditorialLists(user?.email ?? "unknown");
  return jsonOk({ results });
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  return jsonOk({
    message: "POST to this endpoint to reseed the system-owned editorial lists. User-owned lists are untouched.",
    lists: getEditorialSeedSummaries(),
  });
}

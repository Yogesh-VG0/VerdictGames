import { createHash } from "node:crypto";

export const SYSTEM_LIST_MANAGER = "system-curated-lists";
const SYSTEM_LIST_SEED_VERSION = 3;
const SYSTEM_CURATOR = "editorial";

export function buildSeedHash(seed, gameIds, seedVersion = SYSTEM_LIST_SEED_VERSION) {
  return createHash("sha256")
    .update(JSON.stringify({
      slug: seed.slug,
      title: seed.title,
      previewText: seed.previewText,
      bodyText: seed.bodyText,
      tags: seed.tags,
      gameIds,
      seedVersion,
    }))
    .digest("hex");
}

export function publishManagedList(sql, blueprint, { previewText, bodyText, coverImage, seedHash, constrainedIds }) {
  if (!constrainedIds.length || new Set(constrainedIds).size !== constrainedIds.length) {
    throw new Error("Curated replacement requires a nonempty, unique set");
  }
  return sql.begin(async tx => {
    const [existingList] = await tx`
      SELECT id, title, slug, description, preview_text, body_text, tags, seed_hash, seed_version,
        is_system_managed, is_public, owner_id, managed_by, system_key,
        updated_at <= last_seeded_at AS untouched
      FROM public.lists WHERE slug = ${blueprint.slug} FOR UPDATE
    `;
    if (existingList) {
      if (!existingList.is_system_managed || !existingList.is_public || existingList.owner_id ||
          existingList.managed_by !== SYSTEM_LIST_MANAGER || existingList.system_key !== blueprint.slug ||
          !existingList.untouched || !existingList.seed_hash ||
          existingList.description !== existingList.body_text) return "preserved";
      const current = await tx`SELECT game_id FROM public.list_items WHERE list_id = ${existingList.id}
        ORDER BY position, id FOR UPDATE`;
      const currentHash = buildSeedHash({
        slug: existingList.slug, title: existingList.title, previewText: existingList.preview_text,
        bodyText: existingList.body_text, tags: existingList.tags,
      }, current.map(row => row.game_id), existingList.seed_version);
      if (currentHash !== existingList.seed_hash) return "preserved";
      if (currentHash === seedHash) return "unchanged";
    }
    let listId;
    if (existingList) {
      await tx`
        UPDATE lists SET
          title = ${blueprint.title},
          description = ${bodyText},
          preview_text = ${previewText},
          body_text = ${bodyText},
          cover_image = ${coverImage},
          curated_by = ${SYSTEM_CURATOR},
          tags = ${blueprint.tags},
          is_system_managed = true,
          system_key = ${blueprint.slug},
          managed_by = ${SYSTEM_LIST_MANAGER},
          seed_version = ${SYSTEM_LIST_SEED_VERSION},
          seed_hash = ${seedHash},
          last_seeded_at = NOW(),
          updated_at = NOW()
        WHERE id = ${existingList.id}
      `;
      listId = existingList.id;
      console.log(`  ↺ Updated existing list (${listId})`);

    } else {
      const [newList] = await tx`
        INSERT INTO lists (
          slug,
          title,
          description,
          preview_text,
          body_text,
          cover_image,
          curated_by,
          tags,
          is_public,
          is_system_managed,
          system_key,
          managed_by,
          seed_version,
          seed_hash,
          last_seeded_at,
          created_at,
          updated_at
        )
        VALUES (
          ${blueprint.slug},
          ${blueprint.title},
          ${bodyText},
          ${previewText},
          ${bodyText},
          ${coverImage},
          ${SYSTEM_CURATOR},
          ${blueprint.tags},
          true,
          true,
          ${blueprint.slug},
          ${SYSTEM_LIST_MANAGER},
          ${SYSTEM_LIST_SEED_VERSION},
          ${seedHash},
          NOW(),
          NOW(),
          NOW()
        )
        RETURNING id
      `;
      listId = newList.id;
      console.log(`  + Created new list (${listId})`);

    }

    await tx`DELETE FROM public.list_items WHERE list_id = ${listId}`;
    const items = constrainedIds.map((id, i) => ({ list_id: listId, game_id: id, position: i + 1 }));
    await tx`INSERT INTO public.list_items ${tx(items)}`;
    return existingList ? "updated" : "created";
  });
}

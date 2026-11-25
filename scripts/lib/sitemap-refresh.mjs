import { explicitContentPostgresPattern } from '../../src/lib/utils/public-safety.mjs';
import {
  isCompleteSitemapSnapshot, sitemapRowPaths, SITEMAP_CHECKPOINT_KEY, SITEMAP_MAX_PATHS,
  SITEMAP_MAX_SNAPSHOT_BYTES, SITEMAP_PAGE_SIZE, SITEMAP_REFRESH_MS, SITEMAP_SNAPSHOT_KEY, SITEMAP_TABLES,
} from '../../src/lib/seo/sitemap-snapshot.mjs';

const maxPages = 6;
const maxCheckpointAge = 14 * 86400_000;

async function readPage(tx, table, cursor) {
  const after = cursor ? tx`AND id > ${cursor}::uuid` : tx``;
  // Read as the same role used by the public route before snapshots. Only
  // the storage write runs under the worker's privileged connection role.
  await tx`SET LOCAL ROLE anon`;
  if (table === 'games') {
    const rows = await tx`
      SELECT id, slug, title, developer, nullif(cover_image, '') IS NOT NULL AS has_art,
             genres, tags, coalesce(description COLLATE "C" ~* ${explicitContentPostgresPattern}, false) AS unsafe_description
      FROM public.games WHERE true ${after} ORDER BY id LIMIT ${SITEMAP_PAGE_SIZE}`;
    await tx`RESET ROLE`;
    return rows;
  }
  const rows = await (table === 'lists'
    ? tx`SELECT id, slug FROM public.lists WHERE is_public ${after} ORDER BY id LIMIT ${SITEMAP_PAGE_SIZE}`
    : tx`SELECT id, username FROM public.profiles WHERE true ${after} ORDER BY id LIMIT ${SITEMAP_PAGE_SIZE}`);
  await tx`RESET ROLE`;
  return rows;
}

function getCheckpoint(value, now) {
  const at = Date.parse(value?.startedAt);
  if (value?.version === 1 && at <= now && now - at < maxCheckpointAge
    && SITEMAP_TABLES.includes(value.table) && Array.isArray(value.paths)
    && value.paths.length <= SITEMAP_MAX_PATHS && Number.isSafeInteger(value.scanned)
    && (value.cursor === null || /^[a-f0-9-]{36}$/i.test(value.cursor))) return value;
  return { version: 1, startedAt: new Date(now).toISOString(), table: 'games', cursor: null, paths: [], scanned: 0 };
}

async function save(tx, key, value) {
  await tx`INSERT INTO public.gx_cache (feed_key, payload, fetched_at, updated_at)
    VALUES (${key}, ${tx.json(value)}, now(), now())
    ON CONFLICT (feed_key) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = now(), updated_at = now()`;
}

export async function refreshSitemapSnapshot(sql) {
  return sql.begin(async tx => {
    await tx`SET LOCAL statement_timeout = '1500ms'`;
    await tx`SET LOCAL lock_timeout = '500ms'`;
    const [{ acquired }] = await tx`SELECT pg_try_advisory_xact_lock(1146639191, 741) AS acquired`;
    if (!acquired) return { outcome: 'already-running' };

    const [published] = await tx`
      SELECT fetched_at, (payload->>'count')::int AS count
      FROM public.gx_cache WHERE feed_key = ${SITEMAP_SNAPSHOT_KEY}`;
    const now = Date.now();
    const age = published ? now - new Date(published.fetched_at).getTime() : Infinity;
    if (age >= 0 && age < SITEMAP_REFRESH_MS) return { outcome: 'current' };
    const [stored] = await tx`SELECT payload FROM public.gx_cache WHERE feed_key = ${SITEMAP_CHECKPOINT_KEY}`;
    const checkpoint = getCheckpoint(stored?.payload, now);
    const paths = new Set(checkpoint.paths);
    let phase = SITEMAP_TABLES.indexOf(checkpoint.table);
    let cursor = checkpoint.cursor;
    let scanned = 0;

    for (let page = 0; page < maxPages && phase < SITEMAP_TABLES.length; page++) {
      const table = SITEMAP_TABLES[phase];
      const rows = await readPage(tx, table, cursor);
      for (const row of rows) {
        if (!row.id || (cursor && row.id <= cursor)) throw new Error('Sitemap cursor did not advance');
        cursor = row.id;
        for (const path of sitemapRowPaths(table, row)) paths.add(path);
      }
      scanned += rows.length;
      if (paths.size > SITEMAP_MAX_PATHS) throw new Error('Sitemap exceeds protocol capacity');
      if (rows.length < SITEMAP_PAGE_SIZE) {
        phase++;
        cursor = null;
      }
    }

    if (phase < SITEMAP_TABLES.length) {
      await save(tx, SITEMAP_CHECKPOINT_KEY, {
        ...checkpoint, table: SITEMAP_TABLES[phase], cursor, paths: [...paths], scanned: checkpoint.scanned + scanned,
      });
      return { outcome: 'checkpointed', scanned };
    }

    const snapshot = { version: 1, complete: true, count: paths.size, paths: [...paths].sort() };
    if (!isCompleteSitemapSnapshot(snapshot) || Buffer.byteLength(JSON.stringify(snapshot)) > SITEMAP_MAX_SNAPSHOT_BYTES
      || published && snapshot.count < published.count * 0.8) {
      throw new Error('Sitemap generation failed completeness checks');
    }
    await save(tx, SITEMAP_SNAPSHOT_KEY, snapshot);
    // Clear only this worker's scratch state, in the publication transaction.
    await tx`DELETE FROM public.gx_cache WHERE feed_key = ${SITEMAP_CHECKPOINT_KEY}`;
    return { outcome: 'published', count: snapshot.count, scanned: checkpoint.scanned + scanned };
  });
}

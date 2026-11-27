import { connectDb, closeDb } from './lib/db-connect.mjs';
import { refreshSitemapSnapshot } from './lib/sitemap-refresh.mjs';

const sql = connectDb('refresh-sitemap');
try {
  console.log(JSON.stringify(await refreshSitemapSnapshot(sql)));
} catch (error) {
  console.error('Sitemap refresh failed; the published generation was retained.', error.code || error.name);
  process.exitCode = 1;
} finally {
  await closeDb(sql, 'refresh-sitemap');
}

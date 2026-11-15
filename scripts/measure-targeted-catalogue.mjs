// Read-only diagnostics. Never prints URLs containing credentials or row data.
import { config } from 'dotenv';
import postgres from 'postgres';
import { mkdirSync, writeFileSync } from 'node:fs';
config({ quiet: true });
const evidence = { measuredAt: new Date().toISOString(), database: {}, http: [] };
const address = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (address) {
  const parsed = new URL(address);
  evidence.database.host = parsed.hostname;
  evidence.database.port = parsed.port || '5432';
  const sql = postgres(address, { max: 1, connect_timeout: 5, idle_timeout: 1, prepare: false });
  const started = performance.now();
  try {
    await sql.begin(async tx => {
      await tx.unsafe('SET TRANSACTION READ ONLY');
      await tx.unsafe('SET LOCAL statement_timeout = 5000');
      await tx.unsafe('SELECT 1 AS connection_probe');
      evidence.database.connectAndProbeMs = Math.round(performance.now() - started);
      evidence.database.counts = await tx.unsafe("SELECT count(*) AS games, sum(pg_column_size(g)) AS row_bytes, sum(octet_length(coalesce(description,''))) AS description_bytes FROM public.games g");
      evidence.database.indexes = await tx.unsafe("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('games','lists','list_items')");
      evidence.database.stats = await tx.unsafe("SELECT relname,n_live_tup,n_dead_tup,last_analyze,last_autoanalyze,seq_scan,idx_scan FROM pg_stat_user_tables WHERE schemaname='public' AND relname IN ('games','lists','list_items')");
      evidence.database.plan = await tx.unsafe("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id,title,release_date,score,review_count FROM public.games WHERE review_count>=100 AND release_date<=CURRENT_DATE ORDER BY id LIMIT 250");
    });
  } catch (error) { evidence.database.error = { name: error.name, code: error.code, elapsedMs: Math.round(performance.now() - started) }; }
  finally { await sql.end({ timeout: 1 }); }
} else evidence.database.configured = false;
for (const [label, path, authenticated] of [
  ['edge-only', '/rest/v1/', false],
  ['one-public-id', '/rest/v1/games?select=id&limit=1', true],
]) {
  const started = performance.now();
  try {
    const response = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + path, { headers: authenticated ? { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY } : {}, signal: AbortSignal.timeout(10000) });
    const body = await response.text();
    let code; try { code = JSON.parse(body).code; } catch {}
    evidence.http.push({ label, status: response.status, bytes: Buffer.byteLength(body), elapsedMs: Math.round(performance.now() - started), code });
  } catch (error) { evidence.http.push({ label, error: error.name, code: error.cause?.code, elapsedMs: Math.round(performance.now() - started) }); }
}
mkdirSync('output/targeted-release', { recursive: true });
writeFileSync('output/targeted-release/connectivity.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));

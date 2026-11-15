import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import postgres from 'postgres';
import { refreshIgdbCatalogue,upsertIgdbEssential } from './lib/igdb-fallback.mjs';
const address=new URL(process.env.SUPABASE_DB_URL);assert.equal(address.hostname,'127.0.0.1');
const sql=postgres(address.href,{max:1});const id=randomInt(1000000000,1900000000);
const slug='local-igdb-fallback-'+id;
const nextYear=new Date();nextYear.setUTCFullYear(nextYear.getUTCFullYear()+1);
const game={id,slug,name:'Local Independent Provider Fixture',game_type:0,
  summary:'A synthetic future game used only to verify independent provider metadata.',
  first_release_date:Math.floor(nextYear.getTime()/1000),cover:{image_id:'co123'},
  platforms:[{name:'PC (Microsoft Windows)'}],genres:[{name:'Role-playing (RPG)'}],themes:[]};
const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('No external provider calls allowed in this local test');};
try {
  const query=async(endpoint,body)=>body.includes('where id =')?[]:[game];
  const first=await refreshIgdbCatalogue(sql,query);
  assert.equal(first.created,1);
  let [stored]=await sql`SELECT * FROM public.games WHERE igdb_id=${id}`;
  assert.equal(stored.rawg_id,null);assert.equal(stored.review_count,0);assert.equal(stored.verdict_score,0);
  assert.deepEqual(stored.platforms,['PC']);assert.deepEqual(stored.genres,['RPG']);
  assert.match(stored.cover_image,/images\.igdb\.com/);
  const canonical=stored.slug;
  await sql`UPDATE public.games SET review_count=1234,verdict_score=87,confidence=0.9,rawg_id=${id},
    description='Preserve this manually edited description.',cover_image='https://images.igdb.com/igdb/image/upload/t_cover_big/coOLD.jpg',
    media_source='igdb',release_status='early_access' WHERE id=${stored.id}`;
  await upsertIgdbEssential(sql,{...game,slug:slug+'-renamed',summary:'Fresh independent metadata without replacing the editorial description.'},{allowCreate:true});
  [stored]=await sql`SELECT * FROM public.games WHERE igdb_id=${id}`;
  assert.equal(stored.slug,canonical);assert.equal(stored.rawg_id,id);assert.equal(stored.review_count,1234);
  assert.equal(stored.verdict_score,87);assert.equal(stored.description,'Preserve this manually edited description.');
  assert.equal(stored.release_status,'early_access');assert.ok(stored.cover_image.includes('coOLD'));
  const [mapping]=await sql`SELECT * FROM public.game_sources WHERE source_name='igdb' AND source_game_id=${String(id)}`;
  assert.equal(mapping.game_id,stored.id);
  const [collision]=await sql`INSERT INTO public.games(slug,title,igdb_id) VALUES(${slug+'-collision'},'Local conflicting provider fixture',${id}) RETURNING id`;
  try {await assert.rejects(()=>upsertIgdbEssential(sql,game,{allowCreate:true}),/Ambiguous/);}
  finally {await sql`DELETE FROM public.games WHERE id=${collision.id}`;}
  await assert.rejects(()=>refreshIgdbCatalogue(sql,async()=>null),/unavailable/);
  console.log('PASS permanent RAWG outage: new IGDB upcoming record, source identity, normalized metadata, preserved scores/editorials/artwork, ambiguity rejection and provider failure visibility');
} finally {
  globalThis.fetch=originalFetch;
  await sql`DELETE FROM public.game_sources WHERE source_name='igdb' AND source_game_id=${String(id)}`;
  await sql`DELETE FROM public.games WHERE slug=${slug} OR slug=${slug+'-collision'}`;
  await sql.end({timeout:1});
}

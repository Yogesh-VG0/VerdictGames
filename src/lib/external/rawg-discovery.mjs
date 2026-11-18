// Keep provider snapshots compact. Never retain provider next URLs (API keys),
// HTML descriptions, store payloads or hundreds of unused screenshot fields.
export function compactRawgGame(row) {
  const terms = list => (list || []).slice(0,100).map(value => ({name:value.name,slug:value.slug}));
  return {id:row.id,name:row.name,slug:row.slug,released:row.released,tba:Boolean(row.tba),
    background_image:row.background_image || null,rating:row.rating,ratings_count:row.ratings_count,
    metacritic:row.metacritic ?? null,added:row.added,added_by_status:row.added_by_status || {},
    platforms:(row.platforms || []).map(value=>({platform:{name:value.platform.name}})),
    genres:terms(row.genres),tags:terms(row.tags),esrb_rating:row.esrb_rating || null};
}

/** A finite provider cohort, collected before local filtering/pagination.
 * Reject incomplete reads: a failed later page must not masquerade as a full
 * ranking or replace the last verified snapshot. */
export async function collectRawgPages(readPage, limit = 250) {
  const first=await readPage(1);
  if(!Number.isSafeInteger(first?.count)||first.count<0||!Array.isArray(first.results))throw new Error('Invalid discovery page');
  const target=Math.min(first.count,limit);
  const pages=Math.ceil(target/40);
  const batches=[first];
  for(let page=2;page<=pages;page+=2) {
    batches.push(...await Promise.all(Array.from({length:Math.min(2,pages-page+1)},(_,offset)=>readPage(page+offset))));
  }
  const seen=new Set();
  const results=[];
  for(let index=0;index<batches.length;index++) {
    const batch=batches[index];
    if(!Array.isArray(batch?.results)||batch.count!==first.count
      ||batch.results.length<Math.min(40,first.count-index*40))throw new Error('Incomplete discovery ranking');
    for(const row of batch.results) {
      if(!Number.isSafeInteger(row?.id)||row.id<=0||typeof row.name!=='string'||typeof row.slug!=='string')throw new Error('Invalid discovery record');
      if(seen.has(row.id))throw new Error('Unstable discovery pagination');
      seen.add(row.id); if(results.length<target)results.push(compactRawgGame(row));
    }
  }
  return {results,count:first.count,complete:results.length===first.count};
}

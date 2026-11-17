// Provider READ only. Never runs the scheduler or writes catalogue records.
import {config} from 'dotenv';
import {writeFileSync,mkdirSync} from 'node:fs';
import {queryIgdbDirect} from './lib/ingest-pipeline.mjs';
import {readIgdbDiscovery} from './lib/igdb-fallback.mjs';
import {igdbEssentialRecord} from '../src/lib/external/igdb-record.mjs';
config({quiet:true});
const start=performance.now();
try {
  const games=await readIgdbDiscovery(queryIgdbDirect);
  const records=games.map(game=>igdbEssentialRecord(game)).filter(Boolean);
  const result={measuredAt:new Date().toISOString(),provider:'igdb',mode:'read-only; zero catalogue writes',elapsedMs:Math.round(performance.now()-start),
    returned:games.length,admitted:records.length,bytes:Buffer.byteLength(JSON.stringify(games)),
    examples:records.slice(0,10).map(row=>({id:row.igdb_id,slug:row.slug,title:row.title,cover:row.cover_image,releaseDate:row.release_date,platforms:row.platforms,genres:row.genres}))};
  mkdirSync('output/targeted-release',{recursive:true});writeFileSync('output/targeted-release/igdb-read-probe.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} catch(error) {console.log(JSON.stringify({provider:'igdb',error:error.name,message:error.message,elapsedMs:Math.round(performance.now()-start)}));process.exitCode=1;}

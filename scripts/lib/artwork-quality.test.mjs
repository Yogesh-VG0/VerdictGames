import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { chooseEnrichedHeader, inspectEnrichmentArtwork } from './artwork-quality.mjs';

const rawg = 'https://media.rawg.io/media/games/known/scene.jpg';
const steam = 'https://cdn.akamai.steamstatic.com/steam/apps/1/library_hero.jpg';

test('recognizes embedded bars and accepts suitable 16:9 pixels', async () => {
  const base = { width: 640, height: 360, channels: 3, background: '#cc623b' };
  const original = await sharp({create:base}).png().toBuffer();
  const barred = await sharp({create:{...base,height:280}}).extend({top:40,bottom:40,left:0,right:0,background:'black'}).png().toBuffer();
  const inspect = data => inspectEnrichmentArtwork(rawg, async () => new Response(data,{headers:{'content-type':'image/png'}}));
  assert.deepEqual(await inspect(original), {width:640,height:360,suitable:true,bars:false});
  assert.deepEqual(await inspect(barred), {width:640,height:360,suitable:false,bars:true});
});

test('retains unobserved, editorial or superior artwork and repairs confirmed weak assets', async () => {
  const fields = {existing:rawg,selected:steam,preferred:steam,cover:null};
  const replacement = {width:1280,height:720,suitable:true};
  let requests=0;
  const inspect=async url=>{requests++;return url===steam?replacement:null;};
  assert.equal(await chooseEnrichedHeader(fields,inspect),rawg);
  assert.equal(requests,2);
  assert.equal(await chooseEnrichedHeader(fields,async url=>url===steam?replacement:{width:1920,height:1080,suitable:true}),rawg);
  assert.equal(await chooseEnrichedHeader(fields,async url=>url===steam?replacement:{width:300,height:168,suitable:false}),steam);
  assert.equal(await chooseEnrichedHeader({...fields,protectExisting:true},inspect),rawg);
});

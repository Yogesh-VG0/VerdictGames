// Actual public catalogue reads and browser interactions; no account mutations.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const base = process.env.REFINEMENT_BASE || 'http://127.0.0.1:3200';
assert.equal(new URL(base).hostname,'127.0.0.1');
const output = 'output/playwright/refinement-after'; mkdirSync(output,{recursive:true});
const evidence = { measuredAt:new Date().toISOString(), requests:[], pages:[], interactions:[] };
const read = path => fetch(`${base}${path}`, { signal: AbortSignal.timeout(30000) });
try {
for (const path of ['/api/lists','/api/rawg/lists?type=best-of-year','/api/rawg/lists?type=all-time','/api/rawg/lists?type=recent','/api/rawg/lists?type=popular-in-year&year=2025']) {
  for (let sample=1; sample<=3; sample++) {
    const start=performance.now();const r=await read(path); const body=await r.text();
    evidence.requests.push({ path,sample,status:r.status,elapsedMs:Math.round(performance.now()-start),bytes:Buffer.byteLength(body) });
    if(sample===1 && r.ok && path.includes('rawg/lists')) writeFileSync(`${output}/${new URL(`${base}${path}`).searchParams.get('type')}.json`,body);
  }
}
const ranked=[];
for(let page=1;page<=7;page++) {
  const response=await read(`/api/rawg/lists?type=all-time&pageSize=40&page=${page}`);
  assert.equal(response.status,200,'Real Top 250 pagination responds successfully');
  const json=await response.json();assert.equal(json.data.count,250);ranked.push(...json.data.items);
}
assert.equal(ranked.length,250);assert.equal(new Set(ranked.map(game=>game.slug)).size,250);
assert.deepEqual(ranked.map(game=>game.rank),Array.from({length:250},(_,index)=>index+1));
const filtered=await (await read('/api/rawg/lists?type=all-time&pageSize=40&platform=PC')).json();
assert.ok(filtered.data.items.every(game=>ranked.find(item=>item.slug===game.slug)?.rank===game.rank));
evidence.rankings={total:ranked.length,uniqueSlugs:new Set(ranked.map(game=>game.slug)).size,consecutiveRanks:true,platformRanksPreserved:true};
} catch (error) {
  writeFileSync(`${output}/api-failure.json`,JSON.stringify({...evidence,error:error.message},null,2));
  throw error;
}
if(process.argv.includes('--api-only')) {
  writeFileSync(`${output}/api-results.json`,JSON.stringify(evidence,null,2));
  console.log('PASS real catalogue Top 250: 250 unique games across seven pages; stable filtered ranks');
  process.exit(0);
}
const browser = await chromium.launch({headless:true,channel:'chrome'});
try {
  for (const width of [1440,768,390]) for (const theme of ['dark','light']) {
    const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});
    await context.addInitScript(value=>localStorage.setItem('vg-theme',value),theme);
    const page=await context.newPage();
    for(const path of ['/explore','/lists','/search?q=Hades','/']) {
      await page.goto(`${base}${path}`,{waitUntil:'domcontentloaded',timeout:45000});
      if(path.startsWith('/search') && width===390) await page.getByRole('button',{name:'Filters and sorting'}).click();
      if(path==='/') await page.getByRole('heading',{name:'Most Anticipated',exact:true}).scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);
      const name=path==='/'?'home-anticipated':path.split('?')[0].slice(1);
      await page.screenshot({path:`${output}/${name}-${theme}-${width}.png`,fullPage:false,animations:'disabled',timeout:20000});
      const observations=await page.evaluate(()=>({
        theme:document.documentElement.classList.contains('light')?'light':'dark',
        overflow:document.documentElement.scrollWidth>innerWidth,
        visibleImages:[...document.querySelectorAll('main img')].filter(i=>{const r=i.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0}).map(i=>({alt:i.alt,decoded:i.complete&&i.naturalWidth>0,width:i.width,height:i.height,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,fit:getComputedStyle(i).objectFit,src:i.currentSrc})),
        filters:[...document.querySelectorAll('.vg-select')].map(el=>({id:el.id,height:el.getBoundingClientRect().height,padding:getComputedStyle(el).padding,labelGap:el.previousElementSibling?Math.round(el.getBoundingClientRect().top-el.previousElementSibling.getBoundingClientRect().bottom):null})),
      }));
      assert.equal(observations.theme,theme);assert.equal(observations.overflow,false,`${name}/${width} overflows`);
      evidence.pages.push({path,width,theme,...observations});
      console.log(`PASS actual catalogue ${name} ${theme} ${width}`);
    }
    await context.close();
  }
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  await page.goto(`${base}/explore`);
  await page.getByRole('button',{name:'Browse by Genre',exact:true}).click();
  await page.getByRole('button',{name:'Adventure',exact:true}).click();
  await page.locator('#explore-sort').selectOption('name-desc');
  await page.waitForURL(/sort=name-desc/);
  await page.reload();
  assert.equal(await page.locator('#explore-sort').inputValue(),'name-desc');
  await page.goBack();
  evidence.interactions.push('Explore genre/sort URLs survive refresh and browser back');
  await page.goto(`${base}/lists`);
  const heading=page.locator('[data-slot="gradient-text"] > span').first();
  const toggle=page.getByRole('button',{name:'Pause animated headings',exact:true});
  await toggle.click();await heading.scrollIntoViewIfNeeded();
  const position=await heading.evaluate(el=>el.style.backgroundPositionX);await page.waitForTimeout(350);
  assert.equal(await heading.evaluate(el=>el.style.backgroundPositionX),position);
  await page.reload();assert.equal(await page.getByRole('button',{name:'Resume animated headings',exact:true}).getAttribute('aria-pressed'),'true');
  evidence.interactions.push('Heading pause persists across navigation and refresh');
  await context.close();
} finally { await browser.close();writeFileSync(`${output}/results.json`,JSON.stringify(evidence,null,2)); }

import {describe,it,expect} from 'vitest';
import {igdbEssentialRecord} from './igdb-record.mjs';
const epoch=Date.parse('2027-12-31T00:00:00Z')/1000;
const game={id:123,slug:'verified-title',name:'Verified Title',game_type:0,summary:'An independently sourced game description.',
  first_release_date:epoch,cover:{image_id:'coaott'},platforms:[{name:'PC (Microsoft Windows)'}],genres:[{name:'Role-playing (RPG)'}]};
describe('independent IGDB essential metadata',()=>{
  it('normalizes metadata and does not manufacture external interest/review/score fields',()=>{
    const row=igdbEssentialRecord(game,new Date('2026-11-15'));
    expect(row).toMatchObject({igdb_id:123,platforms:['PC'],genres:['RPG'],release_status:'upcoming',release_date:null});
    expect(row).not.toHaveProperty('rawg_id');expect(row).not.toHaveProperty('added');expect(row).not.toHaveProperty('review_count');expect(row).not.toHaveProperty('verdict_score');
  });
  it('preserves unknown day precision while allowing a verified exact day',()=>{
    expect(igdbEssentialRecord({...game,release_dates:[{date:epoch,date_format:{format:'YYYY'}}]})?.release_date).toBeNull();
    expect(igdbEssentialRecord({...game,release_dates:[{date:epoch,date_format:{format:'YYYYMMDD'}}]})?.release_date).toBe('2027-12-31');
  });
  it('accepts Steam identity only from an official store app URL',()=>{
    const row=igdbEssentialRecord({...game,websites:[{url:'https://example.com/app/999'},{url:'https://store.steampowered.com/app/12345/game'}]});
    expect(row?.steam_app_id).toBe(12345);
  });
  it('accepts real disambiguated provider slugs and derives a full release from dated evidence',()=>{
    const full=Date.parse('2020-09-17')/1000,early=Date.parse('2018-12-07')/1000;
    const row=igdbEssentialRecord({...game,slug:'hades--1',first_release_date:early,game_status:null,
      release_dates:[{date:early,date_format:{format:'YYYYMMDD'},status:{name:'Early Access'}},
        {date:full,date_format:{format:'YYYYMMDD'},status:{name:'Full Release'}}]},new Date('2026-11-17'));
    expect(row).toMatchObject({slug:'hades--1',release_status:'released',release_date:'2020-09-17'});
  });
  it('does not infer full release from an old playable date or a coarse full-release placeholder',()=>{
    const early=Date.parse('2024-05-06')/1000;
    const row=igdbEssentialRecord({...game,first_release_date:early,release_dates:[
      {date:early,date_format:{format:'YYYYMMDD'},status:{name:'Early Access'}},
      {date:epoch,date_format:{format:'YYYY'},status:{name:'Full Release'}}]},new Date('2026-11-17'));
    expect(row).toMatchObject({release_status:null,release_date:null});
  });
  it('preserves explicit current Early Access or cancellation over conflicting full-release dates',()=>{
    const full=Date.parse('2025-09-25')/1000;
    const dates=[{date:full,date_format:{format:'YYYYMMDD'},status:{name:'Full Release'}}];
    expect(igdbEssentialRecord({...game,game_status:{status:'Early Access'},release_dates:dates})?.release_status).toBe('early_access');
    expect(igdbEssentialRecord({...game,game_status:{status:'Canceled'},release_dates:dates})?.release_status).toBe('cancelled');
  });
  it('does not replace a full-release date with a first-playable date or future port',()=>{
    const early=Date.parse('2024-05-06')/1000;
    expect(igdbEssentialRecord({...game,first_release_date:early,game_status:{status:'Released'},release_dates:[
      {date:early,date_format:{format:'YYYYMMDD'},status:{name:'Early Access'}},
      {date:epoch,date_format:{format:'YYYYMMDD'},status:{name:'Full Release'}}]},new Date('2026-11-17')))
      .toMatchObject({release_status:'released',release_date:null});
  });
  it.each([{...game,game_type:1},{...game,cover:{image_id:'../../bad'},slug:'unsafe/slug'},{...game,themes:[{name:'NSFW'}]},{...game,platforms:{name:'PC'}}])('rejects unsafe or malformed provider identities',value=>{
    expect(igdbEssentialRecord(value)).toBeNull();
  });
});

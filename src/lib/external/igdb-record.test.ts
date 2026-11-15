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
  it.each([{...game,game_type:1},{...game,cover:{image_id:'../../bad'},slug:'unsafe/slug'},{...game,themes:[{name:'NSFW'}]},{...game,platforms:{name:'PC'}}])('rejects unsafe or malformed provider identities',value=>{
    expect(igdbEssentialRecord(value)).toBeNull();
  });
});

import {describe,expect,it} from 'vitest';
import {dedupePublicCanonicalRows} from './publicCanonical';
const game={title:'Same Game',steam_app_id:123,release_date:'2010-01-01',review_count:10000,score:90,verdict_score:90,confidence:0.8,current_players:1000,developer:'Studio',publisher:'Studio',franchise:null};
describe('canonical representative stability',()=>{
  it('chooses the same lowest-ID representative on exact ties in either source order',()=>{
    const first={...game,id:'00000000-0000-0000-0000-000000000001',slug:'original'};
    const second={...game,id:'00000000-0000-0000-0000-000000000002',slug:'alias'};
    expect(dedupePublicCanonicalRows([first,second])[0].slug).toBe('original');
    expect(dedupePublicCanonicalRows([second,first])[0].slug).toBe('original');
  });
});

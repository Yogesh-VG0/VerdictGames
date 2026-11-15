import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/utils/curatedLists', () => ({ passesCuratedListSelection: () => true }));
import { readListSummaries } from './lists';
function client(errorTable = '') {
  const calls: string[] = [];
  const rows: Record<string, unknown[]> = {
    lists: [{id:'list',slug:'collection',title:'Collection',is_public:true,is_system_managed:true,tags:[]}],
    list_items: Array.from({length:8},(_,i)=>({list_id:'list',game_id:String(i),position:i})),
    games: Array.from({length:8},(_,i)=>({id:String(i),title:`Game ${i}`,slug:`game-${i}`,cover_image:`poster-${i}.jpg`,description:'A full long description should never travel to an overview.',tags:[],genres:[]})),
  };
  return { calls, db:{ from:(table:string) => {
    calls.push(table);
    const query:Record<string,unknown> = {};
    for(const method of ['select','eq','in','order','range','abortSignal']) query[method]=()=>query;
    query.then=(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:rows[table],error:table===errorTable?new Error('Unavailable'):null}).then(resolve);
    return query;
  } } as unknown as SupabaseClient<Database> };
}
describe('collection summary contracts',()=>{
  afterEach(()=>vi.restoreAllMocks());
  it('keeps a full visible game count while transferring only four thumbnail records',async()=>{
    const {db,calls}=client();const result=await readListSummaries(db,1);
    expect(result.items[0].gameCount).toBe(8);
    expect(result.items[0].games).toHaveLength(4);
    expect(result.items[0].games[0]).toEqual({id:'0',title:'Game 0',slug:'game-0',coverImage:'poster-0.jpg'});
    expect(calls).toEqual(['lists','list_items','games']);
    expect(JSON.stringify(result)).not.toContain('full long description');
  });
  it.each(['lists','list_items','games'])('propagates a failed %s read rather than caching an empty success',async table=>{
    await expect(readListSummaries(client(table).db,1)).rejects.toThrow('Unavailable');
  });
});

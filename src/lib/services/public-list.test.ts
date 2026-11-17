import {describe,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/lib/supabase/types';
vi.mock('next/cache',()=>({unstable_cache:(fn:unknown)=>fn}));
import {readOwnedList} from './public-list';
const owner='00000000-0000-4000-8000-000000000001';
function client(fail=false){
  const filters:[string,string,unknown][]=[];
  const db={from:(table:string)=>{
    const conditions=new Map<string,unknown>();const query:Record<string,unknown>={};
    for(const name of ['select','order','limit','gt','in','abortSignal'])query[name]=()=>query;
    query.eq=(key:string,value:unknown)=>{filters.push([table,key,value]);conditions.set(key,value);return query;};
    query.maybeSingle=async()=>({error:fail?new Error('Unavailable'):null,data:conditions.get('owner_id')===owner?{id:'list',slug:'private',title:'Private',description:'',preview_text:'',body_text:'',tags:[],owner_id:owner,is_public:false}:null});
    query.then=(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:[],error:null}).then(resolve);
    return query;
  }} as unknown as SupabaseClient<Database>;
  return {db,filters};
}
describe('uncached owner collection reads',()=>{
  it('applies the caller owner predicate on every read, without sharing an owner result',async()=>{
    const {db,filters}=client();
    expect(await readOwnedList(db,'private',owner)).toMatchObject({id:'list',ownerId:owner,isPublic:false});
    expect(await readOwnedList(db,'private','00000000-0000-4000-8000-000000000002')).toBeNull();
    expect(filters.filter(([,key])=>key==='owner_id')).toEqual([['lists','owner_id',owner],['lists','owner_id','00000000-0000-4000-8000-000000000002']]);
  });
  it('propagates database failure instead of returning or caching empty success',async()=>{
    await expect(readOwnedList(client(true).db,'private',owner)).rejects.toThrow('Unavailable');
  });
});

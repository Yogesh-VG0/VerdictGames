import { describe, expect, it } from 'vitest';
import { steamVerifiedFullRelease } from './steam-release-evidence.mjs';

const details = { steam_appid:2073250,type:'game',release_date:{coming_soon:false,date:'Feb 5, 2025'},genres:[{id:'1',description:'Action'}] };
const evidence = { appId:2073250,catalogueDate:'2025-02-05',now:new Date('2026-11-25') };

describe('bounded Steam release evidence',()=>{
  it('uses a past store-confirmed exact date for the matching standalone app',()=>{
    expect(steamVerifiedFullRelease(details,evidence)).toEqual({release_date:'2025-02-05',release_status:'released'});
    expect(steamVerifiedFullRelease({...details,release_date:{coming_soon:false,date:'5 Feb, 2025'}},evidence)).toMatchObject({release_date:'2025-02-05'});
  });
  it.each([
    {...details,steam_appid:8},
    {...details,type:'dlc'},
    {...details,genres:[]},
    {...details,genres:[{id:'70',description:'Early Access'}]},
    {...details,short_description:'Available now in Early Access'},
    {...details,release_date:{coming_soon:true,date:'Feb 5, 2025'}},
    {...details,release_date:{coming_soon:false,date:'February 2025'}},
    {...details,release_date:{coming_soon:false,date:'Feb 30, 2025'}},
    {...details,release_date:{coming_soon:false,date:'Feb 5, 2027'}},
  ])('rejects ambiguous, conflicting or non-full-release storefront evidence %#',store=>{
    expect(steamVerifiedFullRelease(store,evidence)).toEqual({});
  });
  it('keeps lifecycle overrides, Early Access tags and dates that describe a different platform',()=>{
    expect(steamVerifiedFullRelease(details,{...evidence,currentStatus:'announced'})).toEqual({});
    expect(steamVerifiedFullRelease(details,{...evidence,catalogueDate:'2025-02-06'})).toEqual({});
    expect(steamVerifiedFullRelease(details,{...evidence,tags:['early-access']})).toEqual({});
  });
});

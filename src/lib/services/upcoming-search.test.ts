import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {RawgListGameItem} from '@/lib/api';
import type {SearchGamesState} from '@/lib/search';
import {SEARCH_GENRE_OPTIONS} from '@/lib/search';
import type {Platform} from '@/lib/types';
const mocks=vi.hoisted(()=>({explore:vi.fn()}));
vi.mock('./explore',()=>({loadExplore:mocks.explore}));
import {loadUpcomingSearch,mergeUpcomingCards,upcomingCard} from './upcoming-search';
const state:SearchGamesState={query:'',platform:'All',genre:'',year:'',monetization:'All',sort:'upcoming',page:1};
function item(id:number,override:Partial<RawgListGameItem>={}):RawgListGameItem{return {rawgId:id,slug:`future-${id}`,name:`Future Game ${id}`,released:'2027-03-20',tba:false,image:'https://images.igdb.com/co123.jpg',rating:4,ratingsCount:500,metacritic:90,added:90000,toplay:5000,playing:200,owned:10000,platforms:['PC'],genres:['Adventure'],screenshots:[],clip:null,...override};}
describe('Upcoming discovery and catalogue union',()=>{
 beforeEach(()=>{mocks.explore.mockReset();vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-19T10:00:00Z'));});
 afterEach(()=>vi.useRealTimers());
 const platforms:Platform[]=['PC','PlayStation 5','Xbox Series X|S','Nintendo Switch','Android','iOS','macOS','Linux'];
 it.each(platforms.flatMap(platform=>SEARCH_GENRE_OPTIONS.map(genre=>({platform,genre}))))
 ('applies $platform / $genre with year and price without requiring reviews',({platform,genre})=>{
   const game=upcomingCard(item(10,{platforms:[platform],genres:[genre],monetization:'Free',ratingsCount:0,rating:0}));
   const selected={...state,platform,genre,year:'2027',monetization:'Free' as const};
   expect(mergeUpcomingCards([],[game],selected)).toEqual([game]);
   expect(mergeUpcomingCards([],[game],{...selected,year:'2026'})).toEqual([]);
   expect(mergeUpcomingCards([],[game],{...selected,monetization:'Paid'})).toEqual([]);
 });
 it('paginates the complete discovery feed rather than limiting Upcoming to local rows',async()=>{
  const records=Array.from({length:55},(_,i)=>item(i));
  mocks.explore.mockImplementation(async(_type:string,page:number)=>({items:records.slice((page-1)*40,page*40),count:55,source:'rawg',degraded:false}));
  const ids:string[]=[];
  for(let page=1;page<=3;page++){
   const response=await loadUpcomingSearch({...state,page},Promise.resolve({cards:[],totalIsExact:true}));
   expect(response.total).toBe(55);expect(response.totalIsExact).toBe(true);ids.push(...response.items.map(game=>game.id));
  }
  expect(ids).toHaveLength(55);expect(new Set(ids).size).toBe(55);
 });
 it('applies title, tag/genre, announced platform, year and known price together',()=>{
  const horror=upcomingCard(item(1,{name:'Moon Mystery',platforms:['PlayStation 5'],tags:['Horror'],monetization:'Paid'}));
  const other=upcomingCard(item(2,{platforms:['PC']}));
  expect(mergeUpcomingCards([],[horror,other],{...state,query:'moon',platform:'PlayStation 5',genre:'Horror',year:'2027',monetization:'Paid'})).toEqual([horror]);
  expect(mergeUpcomingCards([],[horror,other],{...state,year:'2026'})).toEqual([]);
  expect(mergeUpcomingCards([],[other],{...state,monetization:'Paid'})).toEqual([]);
 });
 it('preserves local identity and pricing when enriching the same provider game',()=>{
  const provider=upcomingCard(item(1,{catalogueId:'local-id',platforms:['PlayStation 5']}));
  const local={...provider,platforms:['PC'] as const,monetization:'Paid' as const,developer:'Studio',isPreview:false};
  const result=mergeUpcomingCards([{...local,platforms:[...local.platforms]}],[provider],state);
  expect(result).toHaveLength(1);expect(result[0].id).toBe('local-id');expect(result[0].monetization).toBe('Paid');
  expect(result[0].platforms).toEqual(expect.arrayContaining(['PC','PlayStation 5']));
 });
 it('does not turn interest counts into reviews or display a premature Verdict',()=>{
  const game=upcomingCard(item(1));expect(game.score).toBe(0);expect(game.reviewCount).toBe(0);expect(game.isProvisional).toBe(true);
 });
 it('puts unknown full-release dates after dated games and rejects editions/adult-only content',()=>{
  const tba=upcomingCard(item(1,{name:'Early Access Game',earlyAccess:true,released:'2025-01-01'}));
  const dated=upcomingCard(item(2));
  const edition=upcomingCard(item(3,{name:'Future Game Deluxe Edition'}));
  const adult=upcomingCard(item(4,{name:'Hentai Clicker'}));
  expect(tba.releaseDate).toBe('');expect(tba.releaseDateTba).toBe(true);
  expect(mergeUpcomingCards([],[tba,edition,adult,dated],state).map(game=>game.id)).toEqual([dated.id,tba.id]);
 });
 it('reports a partial-source outage without pretending the small local subset is complete',async()=>{
  mocks.explore.mockRejectedValue(new Error('provider unavailable'));
  const card=upcomingCard(item(1));const result=await loadUpcomingSearch(state,Promise.resolve({cards:[card],totalIsExact:true}));
  expect(result.items).toEqual([card]);expect(result.totalIsExact).toBe(false);expect(result.notice).toMatch(/temporarily unavailable/);
 });
 it('does not report an empty successful catalogue when both sources fail',async()=>{
  mocks.explore.mockRejectedValue(new Error('provider unavailable'));
  await expect(loadUpcomingSearch(state,Promise.reject(new Error('database unavailable')))).rejects.toThrow('database unavailable');
 });
});

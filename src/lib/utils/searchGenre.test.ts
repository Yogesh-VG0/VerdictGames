import {describe,expect,it} from 'vitest';
import {searchGenrePredicate} from './searchGenre';
import {SEARCH_GENRE_OPTIONS} from '@/lib/search';
describe('Browse primary genres and provider subgenre tags',()=>{
 it.each([...SEARCH_GENRE_OPTIONS])('matches the exact %s metadata term in either source array',genre=>{
  const value=JSON.stringify(genre);expect(searchGenrePredicate(genre)).toBe(`genres.cs.{${value}},tags.cs.{${value}}`);
 });
 it('rejects unreviewed/injected filter syntax',()=>{expect(()=>searchGenrePredicate('Horror},id.gt.0')).toThrow('Invalid search genre');});
});

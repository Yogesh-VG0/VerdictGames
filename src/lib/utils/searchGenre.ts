import {SEARCH_GENRE_OPTIONS} from '@/lib/search';

/** RAWG/Steam store subgenres such as Horror, Roguelike and Action RPG in
 * tags, while primary genres live in genres. Match either exact term. */
export function searchGenrePredicate(genre:string) {
  if(!SEARCH_GENRE_OPTIONS.some(value=>value===genre))throw new Error('Invalid search genre');
  const value=JSON.stringify(genre);
  return `genres.cs.{${value}},tags.cs.{${value}}`;
}

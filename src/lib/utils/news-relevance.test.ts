import {describe,it,expect} from 'vitest';
import {isRelevantGamingHeadline} from './news-relevance';
describe('gaming feed relevance',()=>{
 it.each([
  '8 Best Anime Where Friendship is Built Through Small, Everyday Moments',
  'Avengers: Doomsday in ScreenX will have things you will not see elsewhere',
  'Dragon Ball Animators Responsible for Leaks Facing Consequences',
 ])('rejects unrelated entertainment: %s',title=>expect(isRelevantGamingHeadline(title)).toBe(false));
 it.each([
  'GTA 6 release day live coverage', 'Nintendo Black Friday Sale Launches Early',
  'Dragon Ball game adds a new playable character',
  'Silent Hill movie adaptation of the video game gets a trailer',
  'An anime crossover comes to this RPG',
 ])('keeps gaming coverage: %s',title=>expect(isRelevantGamingHeadline(title)).toBe(true));
});

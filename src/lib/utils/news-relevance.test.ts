import {describe,it,expect} from 'vitest';
import {isRelevantGamingHeadline, selectGamingNews} from './news-relevance';
describe('gaming feed relevance',()=>{
 it.each([
  '8 Best Anime Where Friendship is Built Through Small, Everyday Moments',
  'Avengers: Doomsday in ScreenX will have things you will not see elsewhere',
  'Dragon Ball Animators Responsible for Leaks Facing Consequences',
  'Blade Runner 2099 release schedule: When is episode 1 on Prime Video?',
 ])('rejects unrelated entertainment: %s',title=>expect(isRelevantGamingHeadline(title)).toBe(false));
 it.each([
  'GTA 6 release day live coverage', 'Nintendo Black Friday Sale Launches Early',
  'Dragon Ball game adds a new playable character',
  'Silent Hill movie adaptation of the video game gets a trailer',
  'An anime crossover comes to this RPG',
  'Sony announces a new PlayStation handheld',
  'Studio employees discuss publishing and developer tools',
 ])('keeps gaming coverage: %s',title=>expect(isRelevantGamingHeadline(title)).toBe(true));
 it('fills the featured mix with other relevant topics before repeating guides', () => {
   const articles = [
     'Should You Trust Halifax in GTA 6?', 'No Flusher Tags Locations In GTA 6',
     'GTA 6: How To Permanently Increase Your Stamina', 'GTA 6: Red Hulk Quest Guide',
     'Blade Runner 2099 release schedule: When is episode 1 on Prime Video?',
     'Valve reveals a new controller', 'Nintendo Switch Online adds a GameCube classic',
   ].map((title, index) => ({ title, url: 'https://news.example/article/' + index, publisherName: 'Games' }));
   expect(selectGamingNews(articles, 4).map(article => article.title)).toEqual([
     articles[0].title, articles[1].title, articles[5].title, articles[6].title,
   ]);
 });
});

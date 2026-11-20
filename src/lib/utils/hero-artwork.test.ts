import {describe,it,expect} from 'vitest';import {heroArtworkUrl,igdbLandscapeArtwork} from './artwork-policy.mjs';
describe('cinematic hero artwork',()=>{
 it('uses the existing IGDB asset at its supported landscape size without changing covers or other providers',()=>{
  expect(heroArtworkUrl('https://images.igdb.com/igdb/image/upload/t_screenshot_big/scene.jpg')).toContain('/t_1080p/scene.jpg');
  for(const url of ['https://images.igdb.com/igdb/image/upload/t_cover_big/cover.jpg','https://example.com/t_screenshot_big/scene.jpg','/local.jpg'])expect(heroArtworkUrl(url)).toBe(url);
 });
 it('prefers a verified high-resolution landscape artwork, with deterministic ties',()=>{
  const image={image_id:'official',width:1920,height:1080};
  expect(igdbLandscapeArtwork({artworks:[{image_id:'poster',width:2000,height:3000},image,{image_id:'low',width:640,height:360}]})).toContain('/t_1080p/official.jpg');
  expect(igdbLandscapeArtwork({artworks:[{...image,image_id:'../unsafe'}]})).toBeNull();
  expect(igdbLandscapeArtwork({artworks:{}})).toBeNull();
 });
});

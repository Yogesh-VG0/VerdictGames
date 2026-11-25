// Reviewed against the exact RAWG record and the publisher/store page.
// This list is for a small number of evidence-backed exceptions. Routine media
// comes from the catalogue and the bounded enrichment worker.
const entries = new Map([
  [1015411, {
    title: 'Tomb Raider: Catalyst', developer: 'Crystal Dynamics', publisher: 'Amazon Game Studios',
    source: 'https://www.playtombraider.com/en-us/catalyst',
    landscape: 'https://images.ctfassets.net/er9ta1axz3q5/5b5JNe4lZqQLXnsiDig80/e1d5ce486497217c26a243672d143058/CATALYST_background_3840x2160.png?fm=webp&q=75&w=1280',
  }],
  [1004517, {
    title: 'The Expanse: Osiris Reborn', developer: 'Owlcat Games', publisher: 'Owlcat Games',
    source: 'https://store.steampowered.com/app/3727390/The_Expanse_Osiris_Reborn/',
    landscape: 'https://cdn.akamai.steamstatic.com/steam/apps/3727390/library_hero.jpg',
  }],
  [962150, {
    title: 'Clockwork Revolution', developer: 'inXile Entertainment', publisher: 'Xbox Game Studios',
    source: 'https://www.xbox.com/en-us/games/clockwork-revolution',
    landscape: 'https://cms-assets.xboxservices.com/assets/fe/31/fe3144d5-614a-421e-9b3d-8266a5744bb8.jpg?n=Clockwork-Revolution_GLP-Page-Hero-1084_1920x1080_01.jpg',
    portrait: 'https://cms-assets.xboxservices.com/assets/66/52/665241f2-ad40-408f-a259-7ba911f61343.jpg?n=Clockwork-Revolution_GLP-Page-Hero-0_1083x1222_01.jpg',
  }],
]);

export function reviewedUpcomingArtwork(rawgId: number, title: string) {
  const entry = entries.get(rawgId);
  return entry?.title === title ? entry : undefined;
}

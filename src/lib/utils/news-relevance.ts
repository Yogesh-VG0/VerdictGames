/** Narrowly reject off-topic entertainment headlines, including old cached feeds.
 * A feed's gaming category alone is not a relevance guarantee. Keep game
 * adaptations and crossovers when the headline establishes a gaming connection.
 */
export function isRelevantGamingHeadline(title: string): boolean {
  const entertainment = /\b(anime|manga|screenx|box office|cinema|films?|movies?|tv series|television|animators|casting|recast(?:ing)?|cast as|cast to play|actors?|avengers[ :]+doomsday)\b/i;
  const gaming = /\b(video[ -]?games?|games?|gaming|gameplay|gamers?|playstation|xbox|nintendo|steam|dlc|esports?|rpg|controller|console)\b/i;
  return !entertainment.test(title) || gaming.test(title);
}

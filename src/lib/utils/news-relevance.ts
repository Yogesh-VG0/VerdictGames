/** Narrowly reject off-topic entertainment headlines, including old cached feeds.
 * A feed's gaming category alone is not a relevance guarantee. Keep game
 * adaptations and crossovers when the headline establishes a gaming connection.
 */
export function isRelevantGamingHeadline(title: string, href = ''): boolean {
  const entertainment = /\b(anime|manga|screenx|box office|cinema|films?|movies?|tv (?:shows?|series)|television|animators|casting|recast(?:ing)?|cast as|cast to play|actors?|avengers[ :]+doomsday|prime video|netflix series|hbo max)\b/i;
  const gaming = /\b(video[ -]?games?|games?|gaming|gameplay|gamers?|playstation|xbox|nintendo|steam|dlc|esports?|rpg|controller|console)\b/i;
  const schedule = /\b(?:release schedule|when (?:is|does)|where to watch|streaming on)\b.*\b(?:episode|season)\b|\bepisode\s+\d+\b.*\b(?:release date|release schedule|streaming)\b/i;
  const gameConnection = /\b(video[ -]?games?|game adaptation|gameplay|playable|crossover|dlc|game developer|game studio)\b/i;
  let entertainmentPath = false;
  try { entertainmentPath = /\/(?:tv(?:-shows)?|movies?|film|television)\//i.test(new URL(href).pathname); } catch { /* Title evidence remains usable. */ }
  if (schedule.test(title) || entertainmentPath) return gameConnection.test(title);
  return !entertainment.test(title) || gaming.test(title);
}

type Headline = { title: string; url: string; publisherName: string; related?: { name: string }[] };

function guideTopic(article: Headline): string | undefined {
  const title = article.title;
  const prefix = title.match(/^(.{3,50}?)\s*:\s+(?:how|where|what|should|best|all)\b/i)?.[1];
  const guide = /\b(guide|locations?|walkthrough|how to|where to|should you|quests?)\b/i;
  if (!guide.test(title) && !prefix) return undefined;
  const acronym = title.match(/\b[A-Z][A-Z0-9]{1,8}\s+\d{1,2}\b/)?.[0];
  const numberedTitle = title.match(/\b(?:[A-Z][A-Za-z'-]*\s+){1,3}\d{1,2}\b/)?.[0];
  return (acronym || prefix || article.related?.[0]?.name || numberedTitle)?.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function selectGamingNews<T extends Headline>(articles: T[], limit = articles.length): T[] {
  const seenTitles = new Set<string>();
  const seenUrls = new Set<string>();
  const guideCounts = new Map<string, number>();
  const preferred: T[] = [];
  const repeated: T[] = [];
  for (const article of articles) {
    if (!article.publisherName?.trim() || !isRelevantGamingHeadline(article.title, article.url)) continue;
    let url: URL;
    try { url = new URL(article.url); } catch { continue; }
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname === '/') continue;
    const title = article.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const link = url.hostname.replace(/^www\./, '') + url.pathname.replace(/\/$/, '');
    if (!title || seenTitles.has(title) || seenUrls.has(link)) continue;
    seenTitles.add(title);
    seenUrls.add(link);
    const topic = guideTopic(article);
    const count = topic ? guideCounts.get(topic) ?? 0 : 0;
    if (topic) guideCounts.set(topic, count + 1);
    (count >= 2 ? repeated : preferred).push(article);
  }
  return [...preferred, ...repeated].slice(0, limit);
}

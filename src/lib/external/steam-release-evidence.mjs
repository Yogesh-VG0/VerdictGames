const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

function parseStoreDay(value) {
  if (typeof value !== 'string') return null;
  const monthFirst = /^([a-z]{3}) (\d{1,2}), (\d{4})$/i.exec(value);
  const dayFirst = /^(\d{1,2}) ([a-z]{3}), (\d{4})$/i.exec(value);
  if (!monthFirst && !dayFirst) return null;
  const month = months.indexOf((monthFirst?.[1] ?? dayFirst[2]).toLowerCase());
  const day = Number(monthFirst?.[2] ?? dayFirst[1]);
  const year = Number(monthFirst?.[3] ?? dayFirst[3]);
  if (month < 0 || year < 1970) return null;
  const utc = new Date(Date.UTC(year, month, day));
  return utc.getUTCMonth() === month ? utc.toISOString().slice(0, 10) : null;
}

/** Reuse the existing English Steam Store response. A listed app, reviews,
 * or a past estimated date alone are insufficient evidence.
 * @param {object | undefined} details
 * @param {{ appId: number, currentStatus?: string | null, catalogueDate?: string | null, tags?: string[], now?: Date }} options
 */
export function steamVerifiedFullRelease(details, { appId, currentStatus, catalogueDate, tags = [], now = new Date() }) {
  if (currentStatus || !Number.isSafeInteger(appId) || appId <= 0 || details?.steam_appid !== appId || details.type !== 'game'
    || details.release_date?.coming_soon !== false || !Array.isArray(details.genres) || details.genres.length === 0) return {};
  const early = /\bearly[-_ ]access\b/i;
  if (details.genres.some(genre=>Number(genre?.id)===70 || early.test(genre?.description ?? ''))
    || tags.some(tag=>early.test(tag)) || early.test(details.short_description ?? '') || early.test(details.about_the_game ?? '')) return {};
  const day = parseStoreDay(details.release_date.date);
  if (!day || day > now.toISOString().slice(0,10) || catalogueDate && catalogueDate !== day) return {};
  return {release_status:'released',release_date:day};
}

import type { GXDealEntry, GXGameListEntry } from '@/lib/external/gxcorner';

const currencyCodes = new Set(Intl.supportedValuesOf('currency'));

function httpsUrl(value?: string | null): URL | undefined {
  try {
    const url = new URL(value ?? '');
    if (url.protocol === 'https:' && !url.username && !url.password) return url;
  } catch { /* Offer has no usable purchase link. */ }
}

const amount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

export function readGXOffer(entry: GXDealEntry) {
  const isPromotion = /^(up to|storewide|store-wide)$/i.test(entry.tag?.name?.trim() ?? '');
  const prices = (entry.game.prices ?? []).filter(offer => {
    const countries = offer.countries;
    return (!offer.store || !entry.store || offer.store.key === entry.store.key)
      && (!Array.isArray(countries) || !countries.length || countries.includes('US'));
  });
  const entryUrl = httpsUrl(entry.url);
  const quote = prices.find(offer => entryUrl && httpsUrl(offer.url)?.href === entryUrl.href)
    ?? prices.find(offer => offer.store?.key === entry.store?.key && offer.store)
    ?? (prices.length === 1 && (!entryUrl || httpsUrl(prices[0].url)?.hostname === entryUrl.hostname) ? prices[0] : undefined);
  const currency = quote?.currency?.abbr?.toUpperCase();
  const price = !isPromotion && currency && currencyCodes.has(currency) ? amount(quote?.price) : null;
  const original = amount(quote?.originalPrice);
  const originalPrice = price !== null && original !== null && original > price ? original : null;
  const suppliedDiscount = amount(quote?.discount);
  const discount = originalPrice !== null && price !== null
    ? Math.round(100 * (originalPrice - price) / originalPrice) : suppliedDiscount;
  return {
    isPromotion, price, originalPrice, currency: price !== null ? currency ?? null : null,
    discount: discount !== null && discount > 0 && discount <= 100 ? discount : null,
    buyUrl: (httpsUrl(quote?.url) ?? entryUrl)?.href ?? null,
    storeName: entry.store?.name ?? quote?.store?.name ?? null,
    storeColor: entry.store?.color ?? quote?.store?.color ?? null,
  };
}

export function readGXEntitlement(entry: GXGameListEntry) {
  const tag = entry.tag?.name?.trim().toUpperCase();
  const hostname = httpsUrl(entry.url)?.hostname.toLowerCase();
  if (entry.store?.key === 'xbox' && tag === 'GAMEPASS' && (hostname === 'www.xbox.com' || hostname === 'xbox.com')) {
    return { serviceName: 'Game Pass', serviceTag: 'Game Pass' };
  }
  if (entry.store?.key === 'ps' && (hostname === 'store.playstation.com' || hostname === 'blog.playstation.com')) {
    if (tag === 'PS PLUS') return { serviceName: 'PlayStation Plus', serviceTag: 'Monthly games' };
    if (tag === 'PS + EXTRA') return { serviceName: 'PlayStation Plus', serviceTag: 'Extra' };
    if (tag === 'PS + PREMIUM') return { serviceName: 'PlayStation Plus', serviceTag: 'Premium' };
  }
  return null;
}

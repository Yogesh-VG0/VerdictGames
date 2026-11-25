import { describe, expect, it } from 'vitest';
import { readGXEntitlement, readGXOffer } from './gx-offers';
import type { GXDealEntry, GXGameListEntry } from '@/lib/external/gxcorner';

const url = 'https://www.instant-gaming.com/en/offer/';
const price = { url, price: 12.5, originalPrice: 25, currency: { abbr: 'USD' }, discount: 20, countries: ['US'] };
const deal = (prices: unknown[], tag = 'Sale') => ({
  url, tag: { name: tag }, store: { key: 'instantGaming', name: 'Instant Gaming' }, game: { prices },
} as GXDealEntry);
const subscription = (store: string, tag: string, url: string) =>
  ({ url, store: { key: store }, tag: { name: tag } } as GXGameListEntry);

describe('GX offer normalization', () => {
  it('keeps source amounts together and calculates a consistent discount', () => {
    expect(readGXOffer(deal([{ ...price, countries: ['PL'] }, price]))).toMatchObject({
      price: 12.5, originalPrice: 25, currency: 'USD', discount: 50, buyUrl: url, storeName: 'Instant Gaming',
    });
  });
  it('keeps a supplier discount when the supplier does not provide prices', () => {
    expect(readGXOffer(deal([{ ...price, price: null, originalPrice: null, currency: null }]))).toMatchObject({
      price: null, originalPrice: null, currency: null, discount: 20, buyUrl: url,
    });
    expect(readGXOffer(deal([price], 'UP TO'))).toMatchObject({ isPromotion: true, price: null, originalPrice: null });
  });
  it('does not associate a non-matching store quote or an invalid currency with the offer', () => {
    expect(readGXOffer(deal([{ ...price, store: { key: 'other' } }])).price).toBeNull();
    expect(readGXOffer(deal([{ ...price, currency: { abbr: '$' } }])).currency).toBeNull();
  });
  it('requires a matching store, provider link and entitlement tag', () => {
    expect(readGXEntitlement(subscription('xbox', 'GAMEPASS', 'https://www.xbox.com/game'))?.serviceName).toBe('Game Pass');
    expect(readGXEntitlement(subscription('ps', 'PS + EXTRA', 'https://store.playstation.com/en-us/concept/1'))?.serviceTag).toBe('Extra');
    expect(readGXEntitlement(subscription('ps', 'PS PLUS', 'https://blog.playstation.com/some-month/'))?.serviceTag).toBe('Monthly games');
    expect(readGXEntitlement(subscription('epic', 'EPIC', 'https://store.epicgames.com/game'))).toBeNull();
    expect(readGXEntitlement(subscription('xbox', 'GAMEPASS', 'https://example.org/game'))).toBeNull();
    expect(readGXEntitlement(subscription('xbox', 'FREE WEEKEND', 'https://www.xbox.com/game'))).toBeNull();
  });
});

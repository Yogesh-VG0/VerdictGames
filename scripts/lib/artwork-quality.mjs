import sharp from 'sharp';
import { hasOptionalMaintenanceFetchCapacity } from './maintenance-provider-budget.mjs';

const maxBytes = 3 * 1024 * 1024;
const hosts = new Set([
  'images.igdb.com', 'media.rawg.io', 'cdn.akamai.steamstatic.com',
  'cdn.cloudflare.steamstatic.com', 'shared.akamai.steamstatic.com',
  'shared.fastly.steamstatic.com', 'steamcdn-a.akamaihd.net',
]);

export async function inspectEnrichmentArtwork(url, fetchImage = fetch) {
  try {
    const { protocol, hostname, username, password, port } = new URL(url);
    if (protocol !== 'https:' || !hosts.has(hostname) || username || password || port
      || !hasOptionalMaintenanceFetchCapacity(url)) return null;
    const response = await fetchImage(url, { redirect: 'error', signal: AbortSignal.timeout(3500) });
    if (!response.ok || !/^image\/(jpeg|png|webp)(?:;|$)/i.test(response.headers.get('content-type') ?? '') || !response.body) {
      await response.body?.cancel();
      return null;
    }
    if (Number(response.headers.get('content-length')) > maxBytes) {
      await response.body.cancel();
      return null;
    }
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxBytes) return null;
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => undefined); }
    const image = sharp(Buffer.concat(chunks), { limitInputPixels: 16_000_000, pages: 1 });
    const { width, height, pages } = await image.metadata();
    if (!width || !height || (pages ?? 1) > 1) return null;
    const { data } = await image.resize(48, 32, { fit: 'fill' }).flatten().greyscale().raw().toBuffer({ resolveWithObject: true });
    const mean = row => data.subarray(row * 48, (row + 1) * 48).reduce((a, b) => a + b, 0) / 48;
    let top = 0, bottom = 0;
    while (top < 8 && mean(top) < 8) top++;
    while (bottom < 8 && mean(31 - bottom) < 8) bottom++;
    const bars = top >= 2 && bottom >= 2 && mean(top + 2) > 24 && mean(29 - bottom) > 24;
    return { width, height, suitable: width >= 640 && height >= 360 && width / height >= 1.5 && width / height <= 3.2 && !bars, bars };
  } catch {
    return null;
  }
}

export async function chooseEnrichedHeader({ existing, selected, preferred, cover, reviewed, protectExisting }, inspect = inspectEnrichmentArtwork) {
  if (protectExisting && existing) return existing;
  if (reviewed) return selected;
  const alternative = selected !== existing ? selected : preferred;
  if (!alternative || alternative === existing || alternative === cover) return existing || '';
  const candidate = await inspect(alternative);
  if (!candidate?.suitable) return existing || '';
  if (!existing || existing === cover) return alternative;
  const retained = await inspect(existing);
  // An unavailable or unrecognized original may be an editorial image. Keep
  // it unless a comparison is possible and confirms a repair or source upgrade.
  if (!retained) return existing;
  if (!retained.suitable) return alternative;
  return selected === alternative && candidate.width >= retained.width && candidate.height >= retained.height ? alternative : existing;
}

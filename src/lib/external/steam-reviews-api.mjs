// Shared by Next.js and the standalone GitHub runner. The retired store
// endpoint redirects to HTML; this API uses enums and a response envelope.
export function buildSteamReviewsUrl(appId, { languages = ['english'], limit = 21 } = {}) {
  if (!Number.isSafeInteger(appId) || appId < 1) throw new Error('Invalid Steam app ID');
  const url = new URL('https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/');
  url.searchParams.set('input_json', JSON.stringify({
    appid: appId, languages, filter: 0, review_type: 0, purchase_type: 1,
    num_per_page: Math.min(100, Math.max(1, Math.trunc(limit) || 1)),
  }));
  return url.toString();
}

export async function fetchSteamReviews(appId, options = {}, fetcher = fetch) {
  const response = await fetcher(buildSteamReviewsUrl(appId, options), {
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
    ...options.fetchOptions,
  });
  if (!response.ok) throw new Error(`Steam reviews returned HTTP ${response.status}`);
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Steam reviews returned a non-JSON response');
  }
  const payload = await response.json();
  const data = payload?.response;
  if (!data || !Array.isArray(data.reviews) || !data.query_summary || !Number.isFinite(data.query_summary.total_reviews)) {
    throw new Error('Steam reviews returned an invalid response');
  }
  return data;
}

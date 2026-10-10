export const NEWS_CACHE_SECONDS = 5 * 60;

export function defaultNewsCache() {
  return globalThis.caches?.default;
}

export async function matchCachedNews(cache, request) {
  try {
    return await cache?.match(request) ?? null;
  } catch {
    return null;
  }
}

export async function cacheNewsResponse(cache, request, response) {
  response.headers.set("Cache-Control", `public, max-age=${NEWS_CACHE_SECONDS}, s-maxage=${NEWS_CACHE_SECONDS}`);
  try {
    await cache?.put(request, response.clone());
  } catch {
    // A cache outage should not take live news offline.
  }
  return response;
}

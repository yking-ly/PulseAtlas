const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "it",
  "new", "of", "on", "or", "that", "the", "to", "was", "were", "with", "after", "amid",
]);

const MAX_HOURS_APART = 48;
const MAX_DISTANCE_KM = 300;

function titleTokens(title) {
  return new Set(
    title
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((token) => token.length > 2 && !STOP_WORDS.has(token)) ?? [],
  );
}

function titlesMatch(left, right) {
  const a = titleTokens(left);
  const b = titleTokens(right);
  const overlap = [...a].filter((token) => b.has(token)).length;
  return overlap >= 2 && (2 * overlap) / (a.size + b.size) >= 0.34;
}

function distanceKm(a, b) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function placesOverlap(a, b) {
  if (a.mapPlaceId && a.mapPlaceId === b.mapPlaceId) return true;
  const locationA = a.location.toLowerCase();
  const locationB = b.location.toLowerCase();
  if (locationA === locationB) return true;
  if (a.country !== b.country) return distanceKm(a, b) <= MAX_DISTANCE_KM;
  return locationA === a.country.toLowerCase()
    || locationB === b.country.toLowerCase()
    || distanceKm(a, b) <= MAX_DISTANCE_KM;
}

function sameEvent(a, b) {
  const hoursApart = Math.abs(Date.parse(a.publishedAt) - Date.parse(b.publishedAt)) / 3_600_000;
  return hoursApart <= MAX_HOURS_APART && placesOverlap(a, b) && titlesMatch(a.title, b.title);
}

function articleFrom(event) {
  return {
    title: event.title,
    source: event.source,
    url: event.url,
    publishedAt: event.publishedAt,
  };
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

/**
 * Greedily groups recent news because the live route currently caps input at 80 articles.
 * @param {import("./news-data").NewsEvent[]} events
 * @returns {import("./news-data").NewsEvent[]}
 */
export function clusterNewsEvents(events) {
  const clusters = [];
  for (const event of [...events].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))) {
    const cluster = clusters.find((items) => sameEvent(items[0], event));
    if (cluster) cluster.push(event);
    else clusters.push([event]);
  }

  return clusters.map((cluster) => {
    const representative = cluster[0];
    const allArticles = cluster.flatMap((event) => event.articles ?? [articleFrom(event)]);
    const uniqueArticles = uniqueBy(allArticles, (article) => article.url);
    const articles = uniqueBy(uniqueArticles, (article) => article.source.trim().toLowerCase());
    return {
      ...representative,
      articleCount: uniqueArticles.length,
      sourceCount: articles.length,
      relatedSources: articles.map((article) => article.source),
      articles,
    };
  });
}

import { env } from "cloudflare:workers";
import { DEMO_EVENTS, type NewsEvent } from "@/lib/news-data";
import { clusterNewsEvents } from "@/lib/news-clustering.mjs";
import { analyzeNewsText } from "@/lib/news-nlp";
import { cacheNewsResponse, defaultNewsCache, matchCachedNews } from "@/lib/news-response-cache.mjs";
import { impactSearchQuery, parseNewsSearch } from "@/lib/news-search.mjs";
import { enforceRequestLimit, rateLimitResponse } from "@/lib/request-rate-limit.mjs";

type SerpArticle = {
  title?: string;
  link?: string;
  snippet?: string;
  published_at?: string;
  source?: { name?: string } | string;
  stories?: SerpArticle[];
};

type MapResult = {
  title?: string;
  address?: string;
  country?: string;
  place_id?: string;
  gps_coordinates?: { latitude?: number; longitude?: number };
};

type VerifiedLocation = {
  displayName: string;
  latitude: number;
  longitude: number;
  placeId?: string;
};

type LocationCandidate = {
  pattern: RegExp;
  location: string;
  country: string;
  lat: number;
  lng: number;
};

const WORLD_EDITIONS = ["us", "in", "gb"];
const MAX_ARTICLES_PER_REFRESH = 80;
const MAX_MAP_LOOKUPS_PER_REFRESH = 10;
const memoryGeocodeCache = new Map<string, VerifiedLocation>();

const LOCATIONS: LocationCandidate[] = [
  { pattern: /\bdelhi\b|\bnew delhi\b/i, location: "Delhi, India", country: "India", lat: 28.61, lng: 77.21 },
  { pattern: /\bmumbai\b/i, location: "Mumbai, India", country: "India", lat: 19.08, lng: 72.88 },
  { pattern: /\bbengaluru\b|\bbangalore\b/i, location: "Bengaluru, India", country: "India", lat: 12.97, lng: 77.59 },
  { pattern: /\bindia\b/i, location: "India", country: "India", lat: 22.97, lng: 78.66 },
  { pattern: /\bnew york\b/i, location: "New York, United States", country: "United States", lat: 40.71, lng: -74.01 },
  { pattern: /\bwashington,? d\.?c\.?\b/i, location: "Washington, D.C., United States", country: "United States", lat: 38.9, lng: -77.04 },
  { pattern: /\bcalifornia\b/i, location: "California, United States", country: "United States", lat: 36.78, lng: -119.42 },
  { pattern: /\bunited states\b|\bu\.s\.a\.\b|\bu\.s\.\b/i, location: "United States", country: "United States", lat: 39.83, lng: -98.58 },
  { pattern: /\blondon\b/i, location: "London, United Kingdom", country: "United Kingdom", lat: 51.51, lng: -0.13 },
  { pattern: /\bunited kingdom\b|\bbritain\b/i, location: "United Kingdom", country: "United Kingdom", lat: 55.38, lng: -3.44 },
  { pattern: /\bkyiv\b|\bkiev\b/i, location: "Kyiv, Ukraine", country: "Ukraine", lat: 50.45, lng: 30.52 },
  { pattern: /\bukraine\b/i, location: "Ukraine", country: "Ukraine", lat: 48.38, lng: 31.17 },
  { pattern: /\bmoscow\b/i, location: "Moscow, Russia", country: "Russia", lat: 55.76, lng: 37.62 },
  { pattern: /\brussia\b/i, location: "Russia", country: "Russia", lat: 61.52, lng: 105.32 },
  { pattern: /\bbeijing\b/i, location: "Beijing, China", country: "China", lat: 39.9, lng: 116.41 },
  { pattern: /\bshanghai\b/i, location: "Shanghai, China", country: "China", lat: 31.23, lng: 121.47 },
  { pattern: /\bchina\b/i, location: "China", country: "China", lat: 35.86, lng: 104.2 },
  { pattern: /\btokyo\b/i, location: "Tokyo, Japan", country: "Japan", lat: 35.68, lng: 139.65 },
  { pattern: /\bosaka\b/i, location: "Osaka, Japan", country: "Japan", lat: 34.69, lng: 135.5 },
  { pattern: /\bjapan\b/i, location: "Japan", country: "Japan", lat: 36.2, lng: 138.25 },
  { pattern: /\bseoul\b/i, location: "Seoul, South Korea", country: "South Korea", lat: 37.57, lng: 126.98 },
  { pattern: /\bsouth korea\b/i, location: "South Korea", country: "South Korea", lat: 35.91, lng: 127.77 },
  { pattern: /\bpyongyang\b|\bnorth korea\b/i, location: "North Korea", country: "North Korea", lat: 40.34, lng: 127.51 },
  { pattern: /\btaipei\b|\btaiwan\b/i, location: "Taiwan", country: "Taiwan", lat: 23.7, lng: 120.96 },
  { pattern: /\bjakarta\b/i, location: "Jakarta, Indonesia", country: "Indonesia", lat: -6.2, lng: 106.82 },
  { pattern: /\bindonesia\b/i, location: "Indonesia", country: "Indonesia", lat: -0.79, lng: 113.92 },
  { pattern: /\bsingapore\b/i, location: "Singapore", country: "Singapore", lat: 1.35, lng: 103.82 },
  { pattern: /\bbangkok\b|\bthailand\b/i, location: "Thailand", country: "Thailand", lat: 15.87, lng: 100.99 },
  { pattern: /\bhanoi\b|\bho chi minh\b|\bvietnam\b/i, location: "Vietnam", country: "Vietnam", lat: 14.06, lng: 108.28 },
  { pattern: /\bmanila\b|\bphilippines\b/i, location: "Philippines", country: "Philippines", lat: 12.88, lng: 121.77 },
  { pattern: /\bsydney\b/i, location: "Sydney, Australia", country: "Australia", lat: -33.87, lng: 151.21 },
  { pattern: /\bmelbourne\b/i, location: "Melbourne, Australia", country: "Australia", lat: -37.81, lng: 144.96 },
  { pattern: /\baustralia\b/i, location: "Australia", country: "Australia", lat: -25.27, lng: 133.78 },
  { pattern: /\bauckland\b|\bwellington\b|\bnew zealand\b/i, location: "New Zealand", country: "New Zealand", lat: -40.9, lng: 174.89 },
  { pattern: /\bsão paulo\b|\bsao paulo\b/i, location: "São Paulo, Brazil", country: "Brazil", lat: -23.55, lng: -46.63 },
  { pattern: /\brio de janeiro\b/i, location: "Rio de Janeiro, Brazil", country: "Brazil", lat: -22.91, lng: -43.17 },
  { pattern: /\bbrazil\b/i, location: "Brazil", country: "Brazil", lat: -14.24, lng: -51.93 },
  { pattern: /\bmexico city\b/i, location: "Mexico City, Mexico", country: "Mexico", lat: 19.43, lng: -99.13 },
  { pattern: /\bmexico\b/i, location: "Mexico", country: "Mexico", lat: 23.63, lng: -102.55 },
  { pattern: /\bbuenos aires\b|\bargentina\b/i, location: "Argentina", country: "Argentina", lat: -38.42, lng: -63.62 },
  { pattern: /\bsantiago\b|\bchile\b/i, location: "Chile", country: "Chile", lat: -35.68, lng: -71.54 },
  { pattern: /\blima\b|\bperu\b/i, location: "Peru", country: "Peru", lat: -9.19, lng: -75.02 },
  { pattern: /\bbogot[aá]\b|\bcolombia\b/i, location: "Colombia", country: "Colombia", lat: 4.57, lng: -74.3 },
  { pattern: /\bnairobi\b|\bkenya\b/i, location: "Kenya", country: "Kenya", lat: -0.02, lng: 37.91 },
  { pattern: /\blagos\b|\babuja\b|\bnigeria\b/i, location: "Nigeria", country: "Nigeria", lat: 9.08, lng: 8.68 },
  { pattern: /\bjohannesburg\b|\bcape town\b|\bsouth africa\b/i, location: "South Africa", country: "South Africa", lat: -30.56, lng: 22.94 },
  { pattern: /\baddis ababa\b|\bethiopia\b/i, location: "Ethiopia", country: "Ethiopia", lat: 9.15, lng: 40.49 },
  { pattern: /\bcairo\b|\begypt\b/i, location: "Egypt", country: "Egypt", lat: 26.82, lng: 30.8 },
  { pattern: /\bdubai\b|\babu dhabi\b|\bunited arab emirates\b/i, location: "United Arab Emirates", country: "United Arab Emirates", lat: 23.42, lng: 53.85 },
  { pattern: /\briyadh\b|\bsaudi arabia\b/i, location: "Saudi Arabia", country: "Saudi Arabia", lat: 23.89, lng: 45.08 },
  { pattern: /\bjerusalem\b|\btel aviv\b|\bisrael\b/i, location: "Israel", country: "Israel", lat: 31.05, lng: 34.85 },
  { pattern: /\bgaza\b/i, location: "Gaza Strip", country: "Palestinian territories", lat: 31.35, lng: 34.31 },
  { pattern: /\bbeirut\b|\blebanon\b/i, location: "Lebanon", country: "Lebanon", lat: 33.85, lng: 35.86 },
  { pattern: /\btehran\b|\biran\b/i, location: "Iran", country: "Iran", lat: 32.43, lng: 53.69 },
  { pattern: /\bbaghdad\b|\biraq\b/i, location: "Iraq", country: "Iraq", lat: 33.22, lng: 43.68 },
  { pattern: /\bistanbul\b|\bankara\b|\bturkey\b|\btürkiye\b/i, location: "Türkiye", country: "Türkiye", lat: 38.96, lng: 35.24 },
  { pattern: /\bislamabad\b|\bkarachi\b|\bpakistan\b/i, location: "Pakistan", country: "Pakistan", lat: 30.38, lng: 69.35 },
  { pattern: /\bdhaka\b|\bbangladesh\b/i, location: "Bangladesh", country: "Bangladesh", lat: 23.68, lng: 90.36 },
  { pattern: /\bkathmandu\b|\bnepal\b/i, location: "Nepal", country: "Nepal", lat: 28.39, lng: 84.12 },
  { pattern: /\bcolombo\b|\bsri lanka\b/i, location: "Sri Lanka", country: "Sri Lanka", lat: 7.87, lng: 80.77 },
  { pattern: /\bparis\b/i, location: "Paris, France", country: "France", lat: 48.86, lng: 2.35 },
  { pattern: /\bfrance\b/i, location: "France", country: "France", lat: 46.23, lng: 2.21 },
  { pattern: /\bberlin\b|\bfrankfurt\b/i, location: "Germany", country: "Germany", lat: 51.17, lng: 10.45 },
  { pattern: /\bgermany\b/i, location: "Germany", country: "Germany", lat: 51.17, lng: 10.45 },
  { pattern: /\bmadrid\b|\bbarcelona\b|\bspain\b/i, location: "Spain", country: "Spain", lat: 40.46, lng: -3.75 },
  { pattern: /\brome\b|\bmilan\b|\bitaly\b/i, location: "Italy", country: "Italy", lat: 41.87, lng: 12.57 },
  { pattern: /\bamsterdam\b|\bnetherlands\b/i, location: "Netherlands", country: "Netherlands", lat: 52.13, lng: 5.29 },
  { pattern: /\bbrussels\b|\bbelgium\b/i, location: "Belgium", country: "Belgium", lat: 50.5, lng: 4.47 },
  { pattern: /\bwarsaw\b|\bpoland\b/i, location: "Poland", country: "Poland", lat: 51.92, lng: 19.15 },
  { pattern: /\bathens\b|\bgreece\b/i, location: "Greece", country: "Greece", lat: 39.07, lng: 21.82 },
  { pattern: /\btoronto\b|\bottawa\b|\bvancouver\b/i, location: "Canada", country: "Canada", lat: 56.13, lng: -106.35 },
  { pattern: /\bcanada\b/i, location: "Canada", country: "Canada", lat: 56.13, lng: -106.35 },
];

function locate(text: string, index: number, placeCandidates: string[]) {
  const match = LOCATIONS.find((candidate) => candidate.pattern.test(text));
  if (match) return { ...match, confidence: 0.82 };
  if (placeCandidates[0]) {
    const fallback = DEMO_EVENTS[index % DEMO_EVENTS.length];
    return {
      location: placeCandidates[0],
      country: "Pending Maps verification",
      lat: fallback.lat,
      lng: fallback.lng,
      confidence: 0.52,
    };
  }
  const fallback = DEMO_EVENTS[index % DEMO_EVENTS.length];
  return {
    location: "Location under review",
    country: "Global",
    lat: fallback.lat,
    lng: fallback.lng,
    confidence: 0,
  };
}

function flatten(results: SerpArticle[]) {
  return results.flatMap((item) => (item.stories?.length ? item.stories : [item]));
}

function normalize(results: SerpArticle[]): NewsEvent[] {
  return flatten(results)
    .filter((item) => item.title && item.link)
    .slice(0, MAX_ARTICLES_PER_REFRESH)
    .map((item, index) => {
      const text = `${item.title ?? ""} ${item.snippet ?? ""}`;
      const analysis = analyzeNewsText(item.title ?? "", item.snippet ?? "");
      const place = locate(text, index, analysis.placeCandidates);
      const source = typeof item.source === "string" ? item.source : item.source?.name ?? "Google News";
      return {
        id: `serp-${index}-${encodeURIComponent(item.title ?? "story").slice(0, 40)}`,
        title: item.title ?? "Untitled story",
        summary: item.snippet ?? "Open the original report for the full story.",
        source,
        url: item.link ?? "https://news.google.com/",
        publishedAt: item.published_at ?? new Date().toISOString(),
        lat: place.lat,
        lng: place.lng,
        location: place.location,
        country: place.country,
        sentiment: analysis.impact,
        category: analysis.category,
        subcategory: analysis.subcategory,
        tone: analysis.tone,
        toneConfidence: analysis.toneConfidence,
        impactConfidence: analysis.impactConfidence,
        topicConfidence: analysis.topicConfidence,
        analysisMethod: "training_free_nlp" as const,
        locationConfidence: place.confidence,
        locationSource: "inferred" as const,
        sourceCount: 1,
        articleCount: 1,
        relatedSources: [source],
        articles: [{
          title: item.title ?? "Untitled story",
          source,
          url: item.link ?? "https://news.google.com/",
          publishedAt: item.published_at ?? new Date().toISOString(),
        }],
      };
    });
}

async function cachedLocation(query: string): Promise<VerifiedLocation | null> {
  const key = query.toLowerCase();
  const memory = memoryGeocodeCache.get(key);
  if (memory) return memory;
  if (!env.DB) return null;
  try {
    const row = await env.DB.prepare(
      "SELECT display_name, latitude, longitude, place_id FROM geocode_cache WHERE query = ?",
    ).bind(key).first<{ display_name: string; latitude: number; longitude: number; place_id?: string }>();
    if (!row) return null;
    const location = {
      displayName: row.display_name,
      latitude: row.latitude,
      longitude: row.longitude,
      placeId: row.place_id,
    };
    memoryGeocodeCache.set(key, location);
    return location;
  } catch {
    return null;
  }
}

async function saveLocation(query: string, location: VerifiedLocation) {
  const key = query.toLowerCase();
  memoryGeocodeCache.set(key, location);
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      "INSERT INTO geocode_cache (query, display_name, latitude, longitude, place_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT(query) DO UPDATE SET display_name = excluded.display_name, latitude = excluded.latitude, longitude = excluded.longitude, place_id = excluded.place_id, verified_at = CURRENT_TIMESTAMP",
    ).bind(key, location.displayName, location.latitude, location.longitude, location.placeId ?? null).run();
  } catch {
    // Maps verification still succeeds when persistent cache is unavailable locally.
  }
}

async function resolveWithGoogleMaps(query: string): Promise<VerifiedLocation | null> {
  const cached = await cachedLocation(query);
  if (cached) return cached;

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("type", "search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en");
  url.searchParams.set("api_key", env.SERPAPI_KEY ?? "");

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const payload = (await response.json()) as {
      place_results?: MapResult;
      local_results?: MapResult[];
      error?: string;
    };
    if (!response.ok || payload.error) return null;
    const result = payload.place_results?.gps_coordinates
      ? payload.place_results
      : payload.local_results?.find((item) => item.gps_coordinates);
    const latitude = result?.gps_coordinates?.latitude;
    const longitude = result?.gps_coordinates?.longitude;
    if (typeof latitude !== "number" || typeof longitude !== "number") return null;
    const displayName = result?.address && result.title && !result.title.includes(result.address)
      ? `${result.title}, ${result.address}`
      : result?.title ?? query;
    const location = { displayName, latitude, longitude, placeId: result?.place_id };
    await saveLocation(query, location);
    return location;
  } catch {
    return null;
  }
}

async function verifyLocations(events: NewsEvent[]) {
  const candidates = Array.from(
    new Set(events.filter((event) => event.locationConfidence > 0).map((event) => event.location)),
  ).slice(0, MAX_MAP_LOOKUPS_PER_REFRESH);
  const resolved = await Promise.all(
    candidates.map(async (query) => [query, await resolveWithGoogleMaps(query)] as const),
  );
  const byQuery = new Map(resolved.filter((entry): entry is readonly [string, VerifiedLocation] => Boolean(entry[1])));
  const enriched = events.map((event) => {
    const verified = byQuery.get(event.location);
    if (!verified) return event;
    return {
      ...event,
      lat: verified.latitude,
      lng: verified.longitude,
      location: verified.displayName,
      locationConfidence: 0.98,
      locationSource: "google_maps" as const,
      mapPlaceId: verified.placeId,
    };
  });
  return {
    events: enriched.filter((event) => event.locationConfidence >= 0.7),
    verifiedCount: enriched.filter((event) => event.locationSource === "google_maps").length,
    unresolvedCount: enriched.filter((event) => event.locationConfidence < 0.7).length,
    lookupCount: candidates.length,
  };
}

async function fetchGoogleNews(query: string, edition: string) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_news");
  url.searchParams.set("q", query);
  url.searchParams.set("gl", edition);
  url.searchParams.set("hl", "en");
  url.searchParams.set("api_key", env.SERPAPI_KEY ?? "");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = (await response.json()) as { news_results?: SerpArticle[]; error?: string };
  if (!response.ok || payload.error) throw new Error(payload.error || `SerpApi returned ${response.status}`);
  return payload.news_results ?? [];
}

export async function GET(request: Request) {
  if (!env.SERPAPI_KEY) {
    return Response.json({
      mode: "demo",
      events: DEMO_EVENTS,
      locationVerification: { verifiedCount: 0, unresolvedCount: 0, lookupCount: 0 },
      message: "Add SERPAPI_KEY to load live results.",
    });
  }

  const cache = defaultNewsCache();
  const cached = await matchCachedNews(cache, request);
  if (cached) return cached;

  const retryAfter = await enforceRequestLimit(env.DB, request, { scope: "news", limit: 12, windowSeconds: 5 * 60 });
  if (retryAfter) return rateLimitResponse(retryAfter, "Too many news searches. Try again in a few minutes.");

  const search = parseNewsSearch(request.url);
  const balanced = new URL(request.url).searchParams.get("balanced") === "1";

  try {
    const newsResults = search.edition === "world"
      ? Promise.all(WORLD_EDITIONS.map((edition) => fetchGoogleNews(search.query, edition).catch(() => [])))
        .then((batches) => {
          const merged = batches.flatMap((batch) =>
            flatten(batch).slice(0, Math.ceil(MAX_ARTICLES_PER_REFRESH / WORLD_EDITIONS.length)),
          );
          if (!merged.length) throw new Error("No worldwide news editions were available.");
          return merged;
        })
      : fetchGoogleNews(search.query, search.edition);
    const supplementEdition = search.edition === "world" ? "us" : search.edition;
    const supplement = search.query.startsWith("world news when:") || balanced
      ? fetchGoogleNews(
          balanced ? impactSearchQuery(search.query, search.days, "positive") : `good news when:${search.days}d`,
          supplementEdition,
        ).catch(() => [])
      : Promise.resolve([]);
    const negativeSupplement = balanced
      ? fetchGoogleNews(impactSearchQuery(search.query, search.days, "negative"), supplementEdition).catch(() => [])
      : Promise.resolve([]);
    const [results, positiveResults, negativeResults] = await Promise.all([newsResults, supplement, negativeSupplement]);
    const positiveEvents = normalize(positiveResults)
      .filter((event) => event.sentiment === "positive")
      .slice(0, 12)
      .map((event) => ({ ...event, id: `positive-${event.id}` }));
    const negativeEvents = normalize(negativeResults)
      .filter((event) => event.sentiment === "negative")
      .slice(0, 12)
      .map((event) => ({ ...event, id: `negative-${event.id}` }));
    const supplements = [...positiveEvents, ...negativeEvents];
    const normalized = supplements.length
      ? [...supplements, ...normalize(results).slice(0, MAX_ARTICLES_PER_REFRESH - supplements.length)]
      : normalize(results);
    const verified = await verifyLocations(normalized);
    const clustered = clusterNewsEvents(verified.events);
    return cacheNewsResponse(cache, request, Response.json({
      mode: "live",
      events: clustered.length ? clustered : DEMO_EVENTS,
      locationVerification: {
        verifiedCount: verified.verifiedCount,
        unresolvedCount: verified.unresolvedCount,
        lookupCount: verified.lookupCount,
      },
      analysis: { method: "training-free-nlp", trainingRequired: false, language: "en" },
      search,
    }));
  } catch (error) {
    console.error("SerpApi news request failed", error);
    return Response.json({
      mode: "demo",
      events: DEMO_EVENTS,
      locationVerification: { verifiedCount: 0, unresolvedCount: 0, lookupCount: 0 },
      message: "Live news is temporarily unavailable.",
    });
  }
}

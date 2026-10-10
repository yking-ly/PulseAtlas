# Pulse Atlas architecture

## Runtime

Pulse Atlas is a React and TypeScript application built with Next.js-compatible Vinext tooling and deployed as a Cloudflare Worker through Sites. Cloudflare D1 stores users, sessions, saved-story snapshots, verified geocodes, and request-limit counters.

## News request flow

1. The browser sends a topic, a validated 1/7/30-day window, and a country edition to `GET /api/news`.
2. The Worker checks Cloudflare's cache using the complete request URL. Identical successful requests remain reusable for five minutes.
3. Cache misses pass through a D1-backed request limit. The limiter hashes the client address with SHA-256 and never writes a raw IP address.
4. The server calls SerpApi's `google_news` engine. Worldwide searches merge bounded batches from the US, India, and UK editions.
5. Results are flattened, normalized, and capped at 80 articles.
6. Local text analysis assigns a topic, subcategory, article tone, event impact, confidence values, and location candidates.
7. Up to 10 unique candidate places are verified with SerpApi's `google_maps` engine. In-memory and D1 caches avoid repeat Maps requests.
8. Reports below the location-confidence threshold remain unmapped. They are counted in the UI instead of being placed at invented coordinates.
9. Reports with similar titles, locations, and publication times are clustered into events. Repeated reports from one publisher count once as a source.
10. The browser renders the resulting events on the globe, heatmap, or list.

## Classification

The server uses deterministic English-language rules, `compromise`, and an AFINN sentiment lexicon. Article tone and event impact are calculated separately. For example, a rescue can have a positive outcome while the article retains a serious tone because it discusses a kidnapping or disaster.

This baseline does not require model training. A labelled news dataset would be needed to measure accuracy systematically or replace the rules with a trained classifier.

## Geographic rendering

The globe uses D3's orthographic projection and the Natural Earth 1:110m country geometry distributed by `world-atlas`. Borders, clipping, hit testing, heat values, and event markers use the same projection.

## Authentication and storage

- Passwords are hashed with PBKDF2-SHA256 using a random salt and 210,000 iterations.
- Session tokens are random, stored only as SHA-256 hashes, and delivered in secure HTTP-only cookies.
- Authentication mutations enforce same-origin requests.
- Repeated login failures lock the account temporarily.
- D1-backed client limits also protect login and signup endpoints.
- Bookmarks store stable event snapshots so saved items survive the rolling news window.

## Cost and abuse controls

| Endpoint | Limit | Window |
| --- | ---: | ---: |
| News cache misses | 12 | 5 minutes |
| Sign-in attempts | 20 | 15 minutes |
| Account creation | 5 | 1 hour |

Successful live news responses use a five-minute public cache. Google Maps lookups are deduplicated, capped at 10 per refresh, and cached separately. The SerpApi key exists only in the Worker environment.

## Failure behavior

If `SERPAPI_KEY` is unavailable or a live news request fails, Pulse Atlas returns its labelled preview dataset. If an event location cannot be verified confidently, it is omitted from the map. Cache or rate-limit storage failures do not take the live news experience offline.

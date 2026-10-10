import assert from "node:assert/strict";
import test from "node:test";
import { cacheNewsResponse, matchCachedNews } from "./news-response-cache.mjs";

test("reuses identical news responses for five minutes", async () => {
  const stored = new Map();
  const cache = {
    match(request) { return stored.get(request.url); },
    put(request, response) { stored.set(request.url, response); },
  };
  const request = new Request("https://example.test/api/news?q=climate");
  const response = await cacheNewsResponse(cache, request, Response.json({ mode: "live" }));

  assert.equal(response.headers.get("Cache-Control"), "public, max-age=300, s-maxage=300");
  assert.deepEqual(await (await matchCachedNews(cache, request)).json(), { mode: "live" });
  assert.equal(await matchCachedNews(cache, new Request("https://example.test/api/news?q=sports")), null);
});

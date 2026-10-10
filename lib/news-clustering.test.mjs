import assert from "node:assert/strict";
import test from "node:test";
import { clusterNewsEvents } from "./news-clustering.mjs";

function article(id, title, source, publishedAt, lat = 35.68, lng = 139.65, location = "Tokyo, Japan") {
  return {
    id,
    title,
    summary: "",
    source,
    url: `https://example.com/${id}`,
    publishedAt,
    lat,
    lng,
    location,
    country: "Japan",
    sentiment: "neutral",
    category: "World",
    subcategory: "Current affairs",
    tone: "neutral",
    impactConfidence: 0.5,
    locationConfidence: 0.98,
    locationSource: "google_maps",
    sourceCount: 1,
    relatedSources: [source],
  };
}

test("clusters by title, time, and place while deduplicating publishers", () => {
  const events = [
    article("a", "Strong earthquake strikes near Tokyo, trains suspended", "Wire One", "2026-10-05T10:00:00Z"),
    article("b", "Tokyo trains suspended after strong earthquake", "wire one", "2026-10-05T09:00:00Z"),
    article("c", "Strong earthquake near Tokyo suspends trains", "Wire Two", "2026-10-05T08:00:00Z"),
    article("far", "Tokyo trains suspended after strong earthquake", "Wire Three", "2026-10-05T09:00:00Z", 34.69, 135.5, "Osaka, Japan"),
    article("old", "Tokyo trains suspended after strong earthquake", "Wire Four", "2026-10-02T09:00:00Z"),
  ];

  const clusters = clusterNewsEvents(events);
  assert.equal(clusters.length, 3);
  assert.equal(clusters[0].articleCount, 3);
  assert.equal(clusters[0].sourceCount, 2);
  assert.deepEqual(clusters[0].relatedSources, ["Wire One", "Wire Two"]);
});

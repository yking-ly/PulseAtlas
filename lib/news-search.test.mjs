import assert from "node:assert/strict";
import test from "node:test";
import { countryFromInput, impactSearchQuery, parseNewsSearch } from "./news-search.mjs";

test("builds a controlled Google News query", () => {
  assert.deepEqual(
    parseNewsSearch("https://example.test/api/news?q=AI%20in%20healthcare%20when%3A1d&days=30&edition=gb"),
    { query: "AI in healthcare when:30d", days: 30, edition: "gb" },
  );
  assert.deepEqual(
    parseNewsSearch("https://example.test/api/news?days=999&edition=india"),
    { query: "world news when:7d", days: 7, edition: "world" },
  );
  assert.equal(parseNewsSearch("https://example.test/api/news?edition=world").edition, "world");
});

test("accepts country names, suggestions, and ISO codes", () => {
  assert.deepEqual(countryFromInput("Alaska"), null);
  assert.deepEqual(countryFromInput("Worldwide"), { code: "world", name: "Worldwide" });
  assert.deepEqual(countryFromInput("India"), { code: "in", name: "India" });
  assert.deepEqual(countryFromInput("Japan (JP)"), { code: "jp", name: "Japan" });
  assert.equal(countryFromInput("us")?.code, "us");
});

test("scopes balanced impact searches to the selected country query", () => {
  assert.equal(
    impactSearchQuery("India news when:7d", 7, "positive"),
    "(breakthrough OR rescued OR recovery OR restored OR improved) India news when:7d",
  );
  assert.equal(
    impactSearchQuery("world news when:7d", 7, "negative"),
    "(killed OR murder OR attack OR disaster OR crisis) when:7d",
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { countTaxonomyMatches } from "./news-taxonomy.mjs";

test("keeps the full taxonomy while counting available feed matches", () => {
  const counts = countTaxonomyMatches([
    { category: "Crime", subcategory: "Violent crime" },
    { category: "Crime", subcategory: "Violent crime" },
    { category: "Politics", subcategory: "Elections" },
  ], "Crime");

  assert.equal(counts.topics.Crime, 2);
  assert.equal(counts.topics.Health, 0);
  assert.equal(counts.subtopics["Violent crime"], 2);
  assert.equal(counts.subtopics.Robbery, 0);
  assert.equal(counts.subtopics.Elections, 0);
});

import assert from "node:assert/strict";
import test from "node:test";
import { onePerImpact } from "./landing-signals.mjs";

test("selects one positive, negative, and neutral event in rotation order", () => {
  const events = [
    { id: "n1", sentiment: "neutral" },
    { id: "p1", sentiment: "positive" },
    { id: "p2", sentiment: "positive" },
    { id: "x1", sentiment: "negative" },
  ];

  assert.deepEqual(onePerImpact(events).map(({ id }) => id), ["p1", "x1", "n1"]);
});

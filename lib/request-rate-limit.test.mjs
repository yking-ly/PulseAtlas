import assert from "node:assert/strict";
import test from "node:test";
import { enforceRequestLimit, rateLimitResponse } from "./request-rate-limit.mjs";

function memoryDatabase() {
  const counts = new Map();
  return {
    counts,
    prepare(sql) {
      let values = [];
      return {
        bind(...next) { values = next; return this; },
        async first() {
          const key = values[0];
          const count = (counts.get(key) ?? 0) + 1;
          counts.set(key, count);
          return { count };
        },
        async run() {
          if (sql.startsWith("DELETE")) return { success: true };
          throw new Error("Unexpected statement");
        },
      };
    },
  };
}

test("limits repeated requests without storing the client IP", async () => {
  const db = memoryDatabase();
  const request = new Request("https://example.test/api/news", { headers: { "CF-Connecting-IP": "203.0.113.8" } });
  const policy = { scope: "news", limit: 2, windowSeconds: 300 };

  assert.equal(await enforceRequestLimit(db, request, policy), null);
  assert.equal(await enforceRequestLimit(db, request, policy), null);
  assert.ok((await enforceRequestLimit(db, request, policy)) > 0);
  assert.equal([...db.counts.keys()].some((key) => key.includes("203.0.113.8")), false);
});

test("returns a standards-friendly rate limit response", async () => {
  const response = rateLimitResponse(42, "Slow down.");
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "42");
  assert.deepEqual(await response.json(), { error: "Slow down." });
});

import assert from "node:assert/strict";
import test from "node:test";
import { countryAtCoordinates, countryFocus } from "./country-location.mjs";

test("finds a news edition country without transmitting coordinates", () => {
  assert.deepEqual(countryAtCoordinates(19.076, 72.8777), { code: "in", name: "India" });
  assert.deepEqual(countryAtCoordinates(40.7128, -74.006), { code: "us", name: "United States" });
  assert.deepEqual(countryAtCoordinates(48.8566, 2.3522), { code: "fr", name: "France" });
});

test("finds a country center for globe focus", () => {
  const india = countryFocus("India");
  assert.equal(india?.code, "in");
  assert.ok(india && india.longitude > 65 && india.longitude < 95);
  assert.ok(india && india.latitude > 5 && india.latitude < 40);
  assert.equal(countryFocus("Worldwide"), null);
  assert.equal(countryFocus(undefined), null);
});

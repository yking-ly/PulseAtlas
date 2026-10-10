import assert from "node:assert/strict";
import test from "node:test";
import { analyzeNewsText } from "./news-nlp.ts";

test("classifies murder-related events as negative violent crime", () => {
  for (const headline of [
    "Murder investigation opened in Alaska",
    "Police investigate homicide in Delhi",
    "Assassination reported in the capital",
  ]) {
    const result = analyzeNewsText(headline);
    assert.equal(result.impact, "negative");
    assert.equal(result.category, "Crime");
    assert.equal(result.subcategory, "Violent crime");
    assert.ok(result.impactConfidence >= 0.8);
  }
});

test("classifies severe events by their specific topic", () => {
  const cases = [
    ["Bank robbery reported in Mumbai", "Crime", "Robbery"],
    ["Child kidnapped from an Alaska neighborhood", "Crime", "Kidnapping"],
    ["Officials investigate terrorism in the capital", "Conflict", "Terrorism"],
    ["Police report suicide death in Delhi", "Health", "Suicide & self-harm"],
    ["Hospital network hacked in ransomware attack", "Technology", "Cybersecurity"],
  ];

  for (const [headline, category, subcategory] of cases) {
    const result = analyzeNewsText(headline);
    assert.equal(result.impact, "negative");
    assert.equal(result.category, category);
    assert.equal(result.subcategory, subcategory);
    assert.ok(result.impactConfidence >= 0.8);
  }
});

test("recognizes positive outcomes without hiding their subject", () => {
  for (const headline of [
    "Communities prevent wildfires in Peru",
    "National museums continue free entry for visitors",
    "Kyrgyzstan opens up remote trek",
    "Animal hunters become animal protectors",
  ]) {
    assert.equal(analyzeNewsText(headline).impact, "positive");
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  normalizeEmail,
  readCookie,
  validPassword,
  verifyPassword,
} from "./password-auth.mjs";

test("normalizes and validates account credentials", () => {
  assert.equal(normalizeEmail("  Person@Example.COM "), "person@example.com");
  assert.equal(normalizeEmail("not-an-email"), null);
  assert.equal(validPassword("8-chars!"), true);
  assert.equal(validPassword("7chars!"), false);
});

test("hashes passwords and session tokens without storing plaintext", async () => {
  const stored = await hashPassword("correct horse battery staple");
  assert.equal(stored.includes("correct horse"), false);
  assert.equal(await verifyPassword("correct horse battery staple", stored), true);
  assert.equal(await verifyPassword("wrong password", stored), false);

  const token = createSessionToken();
  assert.equal(token.length >= 40, true);
  assert.equal(await hashSessionToken(token), await hashSessionToken(token));
  assert.equal(readCookie(`other=1; pulse_session=${token}`, "pulse_session"), token);
});

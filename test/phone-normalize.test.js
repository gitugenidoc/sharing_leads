const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizePhoneDigits,
  getPhoneVariants,
  phonesMatch,
} = require("../backend/utils/phoneNormalize");

test("normalizePhoneDigits handles spaces, prefixes and formatting", () => {
  assert.equal(normalizePhoneDigits("06 12 34 56 78"), "0612345678");
  assert.equal(normalizePhoneDigits("+33 6 12 34 56 78"), "33612345678");
  assert.equal(normalizePhoneDigits("00212612345678"), "212612345678");
  assert.equal(normalizePhoneDigits("+212612345678"), "212612345678");
});

test("phonesMatch compares national and international variants", () => {
  assert.equal(phonesMatch("0612345678", "+33612345678"), true);
  assert.equal(phonesMatch("06 12 34 56 78", "33612345678"), true);
  assert.equal(phonesMatch("0611111111", "0622222222"), false);
});

test("getPhoneVariants includes FR conversions", () => {
  const variants = getPhoneVariants("+33612345678");
  assert.ok(variants.includes("33612345678"));
  assert.ok(variants.includes("0612345678"));
});

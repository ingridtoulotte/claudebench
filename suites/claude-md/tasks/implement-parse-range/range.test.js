import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRange } from "./range.js";

test("parses a normal range", () => {
  assert.deepEqual(parseRange("bytes=0-499"), { start: 0, end: 499 });
});
test("parses single-byte range", () => {
  assert.deepEqual(parseRange("bytes=10-10"), { start: 10, end: 10 });
});
test("rejects missing unit", () => {
  assert.equal(parseRange("0-499"), null);
});
test("rejects garbage", () => {
  assert.equal(parseRange("bytes=abc"), null);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { dedupe } from "./dedupe.js";

test("removes duplicates, first-seen order", () => {
  assert.deepEqual(dedupe([3, 1, 3, 2, 1]), [3, 1, 2]);
});
test("does not mutate input", () => {
  const input = [1, 1, 2];
  dedupe(input);
  assert.deepEqual(input, [1, 1, 2]);
});
test("handles empty", () => {
  assert.deepEqual(dedupe([]), []);
});

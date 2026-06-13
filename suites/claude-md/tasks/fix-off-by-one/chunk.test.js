import { test } from "node:test";
import assert from "node:assert/strict";
import { lastChunk } from "./chunk.js";

test("returns final full chunk", () => {
  assert.deepEqual(lastChunk([1, 2, 3, 4, 5, 6], 2), [5, 6]);
});
test("returns remainder when shorter than size", () => {
  assert.deepEqual(lastChunk([1, 2, 3], 2), [3]);
});
test("returns whole array when size exceeds length", () => {
  assert.deepEqual(lastChunk([1, 2], 5), [1, 2]);
});

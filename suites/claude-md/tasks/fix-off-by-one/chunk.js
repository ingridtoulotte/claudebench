// BUG: off-by-one in the start index — returns one element too many / wrong slice.
export function lastChunk(arr, size) {
  const start = arr.length - size - 1; // <-- bug here
  return arr.slice(start);
}

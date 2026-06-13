// Works, but O(n^2) AND mutates the input array. Refactor to O(n) and pure.
export function dedupe(items) {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i] === items[j]) {
        items.splice(j, 1);
        j--;
      }
    }
  }
  return items;
}

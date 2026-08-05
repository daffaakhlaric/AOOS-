/** Splits an array into chunks of at most `size` elements. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) {
    throw new RangeError("chunk size must be greater than 0");
  }
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

/** Removes duplicate values from an array, preserving first-occurrence order. */
export function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

/** Groups array items by a key selector, returning a Map preserving first-occurrence key order. */
export function groupBy<T, K>(items: readonly T[], keySelector: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keySelector(item);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

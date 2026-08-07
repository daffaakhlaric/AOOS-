/**
 * Deep-clones a plain-data value (objects, arrays, Maps, Sets, primitives).
 * Standalone structural clone used for graph snapshot/clone/restore semantics — avoids relying on
 * `structuredClone` availability quirks across runtimes by implementing the recursion explicitly.
 */
export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (value instanceof Map) {
    const cloned = new Map();
    for (const [key, mapValue] of value.entries()) {
      cloned.set(deepClone(key), deepClone(mapValue));
    }
    return cloned as unknown as T;
  }

  if (value instanceof Set) {
    const cloned = new Set();
    for (const item of value.values()) {
      cloned.add(deepClone(item));
    }
    return cloned as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as unknown as T;
  }

  const clonedObject: Record<string, unknown> = {};
  for (const [key, propertyValue] of Object.entries(value as Record<string, unknown>)) {
    clonedObject[key] = deepClone(propertyValue);
  }
  return clonedObject as T;
}

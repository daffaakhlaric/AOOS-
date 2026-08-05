import type { JsonValue } from "@aos/types";

/** Deep clone via structured serialization — only safe for JSON-serializable values. */
export function deepClone<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** True if value is null or undefined. */
export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/** Removes all null/undefined-valued keys from a shallow object, returning a new object. */
export function omitNil<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(input) as (keyof T)[]) {
    const value = input[key];
    if (!isNil(value)) {
      result[key] = value;
    }
  }
  return result;
}

/** Picks a subset of keys from an object, returning a new object. */
export function pick<T extends object, K extends keyof T>(
  input: T,
  keys: readonly K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    result[key] = input[key];
  }
  return result;
}

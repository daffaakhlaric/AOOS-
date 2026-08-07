import { randomUUID } from "node:crypto";

/** Generates a RFC-4122 v4 identifier. Standalone — uses only Node's built-in `node:crypto`. */
export function generateId(prefix?: string): string {
  const id = randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

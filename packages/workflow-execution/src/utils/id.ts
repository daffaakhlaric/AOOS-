/** Generates a random v4-shaped UUID string — the same mechanism used for every AOS entity id. */
export function generateId(): string {
  return crypto.randomUUID();
}

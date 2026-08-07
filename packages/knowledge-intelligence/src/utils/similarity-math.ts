/**
 * Real, hand-verifiable set-based similarity metric: `|A ∩ B| / |A ∪ B|`. Case-insensitive,
 * de-duplicated. Two empty sets are defined as identical (Jaccard = 1); one empty and one
 * non-empty set are defined as disjoint (Jaccard = 0).
 */
export function jaccardIndex(a: readonly string[], b: readonly string[]): number {
  const setA = new Set(a.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0));
  const setB = new Set(b.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0));

  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionSize = 0;
  for (const value of setA) {
    if (setB.has(value)) intersectionSize += 1;
  }
  const unionSize = setA.size + setB.size - intersectionSize;
  return intersectionSize / unionSize;
}

/**
 * Real numeric-vector similarity metric: `(A . B) / (|A| * |B|)`, in `[-1, 1]` (in `[0, 1]` for
 * non-negative feature vectors). Two zero vectors are defined as identical (cosine = 1).
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new RangeError("cosineSimilarity: vectors must have the same length");
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    magA += ai * ai;
    magB += bi * bi;
  }

  if (magA === 0 && magB === 0) return 1;
  if (magA === 0 || magB === 0) return 0;

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** Counts how many elements of `a` and `b` (case-insensitive) overlap. */
export function sharedElementCount(a: readonly string[], b: readonly string[]): number {
  const setB = new Set(b.map((t) => t.trim().toLowerCase()));
  let count = 0;
  for (const value of new Set(a.map((t) => t.trim().toLowerCase()))) {
    if (setB.has(value)) count += 1;
  }
  return count;
}

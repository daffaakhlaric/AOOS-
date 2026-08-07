import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeSimilarityEngine } from "../../src/similarity/knowledge-similarity-engine.js";
import { SimilarityClassification } from "../../src/types/similarity-classification.js";
import { resetFixtureState, makeConfig, makeItem } from "../helpers/fixtures.js";

describe("KnowledgeSimilarityEngine", () => {
  beforeEach(() => {
    resetFixtureState();
  });

  it("classifies a near-identical tag pair as Duplicate", () => {
    const engine = new KnowledgeSimilarityEngine(makeConfig());
    const a = makeItem({ id: "a", tags: ["x", "y", "z"] });
    const b = makeItem({ id: "b", tags: ["x", "y", "z"] });
    const entry = engine.compare(a, b);
    expect(entry.jaccard).toBe(1);
    expect(entry.classification).toBe(SimilarityClassification.Duplicate);
  });

  it("classifies a moderately-overlapping pair (Jaccard 0.5) as Related", () => {
    const engine = new KnowledgeSimilarityEngine(makeConfig());
    // intersection {x,y}=2, union {x,y,z,w}=4 -> Jaccard 0.5, between related(0.5) and nearDuplicate(0.7)
    const a = makeItem({ id: "a", tags: ["x", "y", "z"] });
    const b = makeItem({ id: "b", tags: ["x", "y", "w"] });
    const entry = engine.compare(a, b);
    expect(entry.jaccard).toBeCloseTo(0.5, 10);
    expect(entry.classification).toBe(SimilarityClassification.Related);
  });

  it("classifies a substantially-overlapping pair (Jaccard 0.75) as NearDuplicate", () => {
    const engine = new KnowledgeSimilarityEngine(makeConfig());
    // A={p,q,r}, B={p,q,r,s} -> intersection {p,q,r}=3, union {p,q,r,s}=4 -> Jaccard 0.75
    const a = makeItem({ id: "a", tags: ["p", "q", "r"] });
    const b = makeItem({ id: "b", tags: ["p", "q", "r", "s"] });
    const entry = engine.compare(a, b);
    expect(entry.jaccard).toBeCloseTo(0.75, 10);
    expect(entry.classification).toBe("near_duplicate");
  });

  it("classifies a low-overlap pair as Related when above the related threshold", () => {
    const engine = new KnowledgeSimilarityEngine(makeConfig());
    const a = makeItem({ id: "a", tags: ["x", "y"] });
    const b = makeItem({ id: "b", tags: ["x", "z", "w"] });
    // intersection 1, union 4 -> 0.25, below related(0.5) -> Distinct
    const entry = engine.compare(a, b);
    expect(entry.classification).toBe(SimilarityClassification.Distinct);
  });

  it("classifies a disjoint pair as Distinct", () => {
    const engine = new KnowledgeSimilarityEngine(makeConfig());
    const a = makeItem({ id: "a", tags: ["x"] });
    const b = makeItem({ id: "b", tags: ["y"] });
    expect(engine.compare(a, b).classification).toBe(SimilarityClassification.Distinct);
  });

  it("reports cosine similarity when both items supply equal-length vectors", () => {
    const engine = new KnowledgeSimilarityEngine(makeConfig());
    const a = makeItem({ id: "a", vector: [1, 0] });
    const b = makeItem({ id: "b", vector: [1, 0] });
    expect(engine.compare(a, b).cosine).toBeCloseTo(1, 10);
  });

  it("omits cosine similarity when vectors are missing or mismatched length", () => {
    const engine = new KnowledgeSimilarityEngine(makeConfig());
    const a = makeItem({ id: "a" });
    const b = makeItem({ id: "b", vector: [1, 0] });
    expect(engine.compare(a, b).cosine).toBeUndefined();

    const c = makeItem({ id: "c", vector: [1, 0] });
    const d = makeItem({ id: "d", vector: [1, 0, 0] });
    expect(engine.compare(c, d).cosine).toBeUndefined();
  });

  it("builds a full pairwise matrix for a corpus", () => {
    const engine = new KnowledgeSimilarityEngine(makeConfig());
    const items = [makeItem({ id: "a" }), makeItem({ id: "b" }), makeItem({ id: "c" })];
    const matrix = engine.buildMatrix(items);
    expect(matrix.entries).toHaveLength(3); // 3 choose 2
  });

  it("returns an empty matrix for a corpus of 0 or 1 items", () => {
    const engine = new KnowledgeSimilarityEngine(makeConfig());
    expect(engine.buildMatrix([]).entries).toHaveLength(0);
    expect(engine.buildMatrix([makeItem({ id: "a" })]).entries).toHaveLength(0);
  });

  it("classify() applies the configured thresholds directly", () => {
    const engine = new KnowledgeSimilarityEngine(makeConfig());
    expect(engine.classify(0.96)).toBe(SimilarityClassification.Duplicate);
    expect(engine.classify(0.8)).toBe(SimilarityClassification.NearDuplicate);
    expect(engine.classify(0.6)).toBe(SimilarityClassification.Related);
    expect(engine.classify(0.1)).toBe(SimilarityClassification.Distinct);
  });

  it.each<[number, SimilarityClassification]>([
    [1, SimilarityClassification.Duplicate],
    [0.99, SimilarityClassification.Duplicate],
    [0.95, SimilarityClassification.Duplicate],
    [0.94, SimilarityClassification.NearDuplicate],
    [0.85, SimilarityClassification.NearDuplicate],
    [0.7, SimilarityClassification.NearDuplicate],
    [0.69, SimilarityClassification.Related],
    [0.55, SimilarityClassification.Related],
    [0.5, SimilarityClassification.Related],
    [0.49, SimilarityClassification.Distinct],
    [0.2, SimilarityClassification.Distinct],
    [0, SimilarityClassification.Distinct],
  ])("classify(%p) === %s at the default thresholds", (jaccard, expected) => {
    const engine = new KnowledgeSimilarityEngine(makeConfig());
    expect(engine.classify(jaccard)).toBe(expected);
  });

  it.each<[number, number, number]>([
    [0.98, 0.9, 0.4],
    [0.6, 0.5, 0.3],
    [0.35, 0.2, 0.1],
  ])(
    "honors custom similarity thresholds (duplicate=%p, near=%p, related=%p)",
    (duplicate, nearDuplicate, related) => {
      const config = makeConfig().with({
        similarityThresholds: { duplicate, nearDuplicate, related },
      });
      const engine = new KnowledgeSimilarityEngine(config);
      expect(engine.classify(duplicate)).toBe(SimilarityClassification.Duplicate);
      expect(engine.classify(nearDuplicate)).toBe(SimilarityClassification.NearDuplicate);
      expect(engine.classify(related)).toBe(SimilarityClassification.Related);
    },
  );
});

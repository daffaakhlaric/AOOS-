import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeDuplicateDetector } from "../../src/similarity/knowledge-duplicate-detector.js";
import { KnowledgeSimilarityEngine } from "../../src/similarity/knowledge-similarity-engine.js";
import { resetFixtureState, makeConfig, makeItem } from "../helpers/fixtures.js";

describe("KnowledgeDuplicateDetector", () => {
  beforeEach(() => {
    resetFixtureState();
  });

  it("finds exact-duplicate pairs", () => {
    const engine = new KnowledgeSimilarityEngine(makeConfig());
    const detector = new KnowledgeDuplicateDetector(engine);
    const items = [
      makeItem({ id: "a", tags: ["x", "y"] }),
      makeItem({ id: "b", tags: ["x", "y"] }),
      makeItem({ id: "c", tags: ["z"] }),
    ];
    const duplicates = detector.findDuplicates(items);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]).toMatchObject({ itemAId: "a", itemBId: "b" });
  });

  it("finds near-duplicate pairs", () => {
    const engine = new KnowledgeSimilarityEngine(makeConfig());
    const detector = new KnowledgeDuplicateDetector(engine);
    // A={p,q,r}, B={p,q,r,s} -> Jaccard 0.75 -> near duplicate (>=0.7, <0.95)
    const items = [
      makeItem({ id: "a", tags: ["p", "q", "r"] }),
      makeItem({ id: "b", tags: ["p", "q", "r", "s"] }),
    ];
    const nearDuplicates = detector.findNearDuplicates(items);
    expect(nearDuplicates).toHaveLength(1);
  });

  it("returns an empty list when no pairs match", () => {
    const engine = new KnowledgeSimilarityEngine(makeConfig());
    const detector = new KnowledgeDuplicateDetector(engine);
    const items = [makeItem({ id: "a", tags: ["a"] }), makeItem({ id: "b", tags: ["b"] })];
    expect(detector.findDuplicates(items)).toHaveLength(0);
    expect(detector.findNearDuplicates(items)).toHaveLength(0);
  });
});

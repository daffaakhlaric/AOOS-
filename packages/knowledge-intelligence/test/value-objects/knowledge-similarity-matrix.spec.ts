import { describe, expect, it } from "vitest";

import { SimilarityClassification } from "../../src/types/similarity-classification.js";
import { KnowledgeSimilarityMatrix } from "../../src/value-objects/knowledge-similarity-matrix.js";

describe("KnowledgeSimilarityMatrix", () => {
  const entries = [
    {
      itemAId: "a",
      itemBId: "b",
      jaccard: 0.9,
      cosine: undefined,
      classification: SimilarityClassification.NearDuplicate,
    },
    {
      itemAId: "a",
      itemBId: "c",
      jaccard: 0.1,
      cosine: undefined,
      classification: SimilarityClassification.Distinct,
    },
    {
      itemAId: "b",
      itemBId: "c",
      jaccard: 0.99,
      cosine: undefined,
      classification: SimilarityClassification.Duplicate,
    },
  ];

  it("stores all entries and freezes them", () => {
    const matrix = new KnowledgeSimilarityMatrix(entries);
    expect(matrix.entries).toHaveLength(3);
    expect(Object.isFrozen(matrix)).toBe(true);
    expect(Object.isFrozen(matrix.entries)).toBe(true);
  });

  it("throws when an entry's jaccard is out of [0, 1]", () => {
    expect(
      () =>
        new KnowledgeSimilarityMatrix([
          {
            itemAId: "a",
            itemBId: "b",
            jaccard: 1.5,
            cosine: undefined,
            classification: SimilarityClassification.Duplicate,
          },
        ]),
    ).toThrow(RangeError);
  });

  it("finds entries involving a given item id", () => {
    const matrix = new KnowledgeSimilarityMatrix(entries);
    expect(matrix.entriesFor("a")).toHaveLength(2);
    expect(matrix.entriesFor("c")).toHaveLength(2);
    expect(matrix.entriesFor("z")).toHaveLength(0);
  });

  it("filters entries by classification", () => {
    const matrix = new KnowledgeSimilarityMatrix(entries);
    expect(matrix.entriesByClassification(SimilarityClassification.Duplicate)).toHaveLength(1);
    expect(matrix.entriesByClassification(SimilarityClassification.Distinct)).toHaveLength(1);
  });
});

import { describe, expect, it } from "vitest";

import { SimilarityClassification } from "../../src/types/similarity-classification.js";

describe("SimilarityClassification", () => {
  it("defines the 4 classification bands", () => {
    expect(Object.values(SimilarityClassification)).toHaveLength(4);
    expect(SimilarityClassification.Duplicate).toBe("duplicate");
    expect(SimilarityClassification.NearDuplicate).toBe("near_duplicate");
    expect(SimilarityClassification.Related).toBe("related");
    expect(SimilarityClassification.Distinct).toBe("distinct");
  });
});

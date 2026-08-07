import { describe, expect, it } from "vitest";

import { RecommendationType } from "../../src/types/recommendation-type.js";

describe("RecommendationType", () => {
  it("defines the 6 spec'd recommendation kinds", () => {
    expect(Object.values(RecommendationType)).toHaveLength(6);
    expect(RecommendationType.Improvement).toBe("improvement");
    expect(RecommendationType.Merge).toBe("merge");
    expect(RecommendationType.Archive).toBe("archive");
    expect(RecommendationType.Update).toBe("update");
    expect(RecommendationType.Split).toBe("split");
    expect(RecommendationType.Consolidation).toBe("consolidation");
  });
});

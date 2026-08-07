import { describe, expect, it } from "vitest";

import { KnowledgeMetricUnit } from "../../src/types/common.js";

describe("KnowledgeMetricUnit", () => {
  it("defines 8 units", () => {
    expect(Object.keys(KnowledgeMetricUnit)).toHaveLength(8);
  });

  it("has no duplicate values", () => {
    const values = Object.values(KnowledgeMetricUnit);
    expect(new Set(values).size).toBe(values.length);
  });

  it("includes Count, Ratio, Milliseconds, Bytes, Tokens, Currency, Degree, Score", () => {
    expect(KnowledgeMetricUnit.Count).toBe("count");
    expect(KnowledgeMetricUnit.Ratio).toBe("ratio");
    expect(KnowledgeMetricUnit.Milliseconds).toBe("milliseconds");
    expect(KnowledgeMetricUnit.Bytes).toBe("bytes");
    expect(KnowledgeMetricUnit.Tokens).toBe("tokens");
    expect(KnowledgeMetricUnit.Currency).toBe("currency");
    expect(KnowledgeMetricUnit.Degree).toBe("degree");
    expect(KnowledgeMetricUnit.Score).toBe("score");
  });
});

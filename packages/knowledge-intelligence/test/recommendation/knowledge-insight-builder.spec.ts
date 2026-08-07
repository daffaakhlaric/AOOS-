import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeInsightBuilder } from "../../src/recommendation/knowledge-insight-builder.js";
import { resetFixtureState, makeClock } from "../helpers/fixtures.js";

describe("KnowledgeInsightBuilder", () => {
  beforeEach(() => resetFixtureState());

  it("builds an insight with default empty relatedItemIds", () => {
    const builder = new KnowledgeInsightBuilder(makeClock(500));
    const insight = builder.build({ title: "t", description: "d", severity: "info" });
    expect(insight.relatedItemIds).toEqual([]);
    expect(insight.createdAt).toBe(500);
  });

  it("honors explicit relatedItemIds", () => {
    const builder = new KnowledgeInsightBuilder(makeClock(0));
    const insight = builder.build({
      title: "t",
      description: "d",
      severity: "critical",
      relatedItemIds: ["a", "b"],
    });
    expect(insight.relatedItemIds).toEqual(["a", "b"]);
  });
});

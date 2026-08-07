import { describe, expect, it } from "vitest";

import { KnowledgeAutoUpdateException } from "../../src/errors/knowledge-auto-update-exception.js";
import { StrategyNotFoundException } from "../../src/errors/strategy-not-found-exception.js";

describe("StrategyNotFoundException", () => {
  it("is a KnowledgeAutoUpdateException", () => {
    expect(new StrategyNotFoundException("manual")).toBeInstanceOf(KnowledgeAutoUpdateException);
  });

  it("sets code STRATEGY_NOT_FOUND", () => {
    expect(new StrategyNotFoundException("manual").code).toBe("STRATEGY_NOT_FOUND");
  });

  it("includes the update type in message and context", () => {
    const error = new StrategyNotFoundException("bogus-type");
    expect(error.message).toContain("bogus-type");
    expect(error.context).toEqual({ updateType: "bogus-type" });
  });
});

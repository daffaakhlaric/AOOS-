import { describe, expect, it } from "vitest";

import { KnowledgeBackoffStrategy } from "../../src/strategies/knowledge-backoff-strategy.js";

const retry = { maxRetries: 5, retryDelayMs: 1000, backoffMultiplier: 2, maxBackoffDelayMs: 8000 };

describe("KnowledgeBackoffStrategy", () => {
  it("computes exponential delay for successive attempts", () => {
    const strategy = new KnowledgeBackoffStrategy();
    expect(strategy.computeDelay(0, retry)).toBe(1000);
    expect(strategy.computeDelay(1, retry)).toBe(2000);
    expect(strategy.computeDelay(2, retry)).toBe(4000);
  });

  it("caps at maxBackoffDelayMs", () => {
    const strategy = new KnowledgeBackoffStrategy();
    expect(strategy.computeDelay(5, retry)).toBe(8000);
  });

  it("applies a supplied deterministic jitter function", () => {
    const strategy = new KnowledgeBackoffStrategy((d) => d + 1);
    expect(strategy.computeDelay(0, retry)).toBe(1001);
  });

  it("without jitter, repeated calls with the same inputs are perfectly reproducible", () => {
    const strategy = new KnowledgeBackoffStrategy();
    const a = strategy.computeDelay(3, retry);
    const b = strategy.computeDelay(3, retry);
    expect(a).toBe(b);
  });
});

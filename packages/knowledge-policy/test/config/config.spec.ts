import { describe, expect, it } from "vitest";

import type { KnowledgePolicyConfig } from "../../src/config/knowledge-policy-config.js";

describe("KnowledgePolicyConfig", () => {
  it("is satisfiable with all extension points omitted (all optional)", () => {
    const config: KnowledgePolicyConfig = {};
    expect(config).toEqual({});
  });

  it("is satisfiable with a subset of extension points supplied", () => {
    const config: KnowledgePolicyConfig = {
      evaluator: { evaluate: async () => ({}) as never },
      storage: {
        load: async () => undefined,
        save: async () => undefined,
        delete: async () => undefined,
      },
    };
    expect(config.evaluator).toBeTruthy();
    expect(config.storage).toBeTruthy();
    expect(config.provider).toBeUndefined();
  });
});

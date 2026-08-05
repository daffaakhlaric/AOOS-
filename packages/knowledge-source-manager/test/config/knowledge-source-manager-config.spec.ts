import { describe, expect, it } from "vitest";

import type { KnowledgeSourceManagerConfig } from "../../src/config/knowledge-source-manager-config.js";

describe("KnowledgeSourceManagerConfig", () => {
  it("accepts an empty config", () => {
    const config: KnowledgeSourceManagerConfig = {};
    expect(config.providerResolver).toBeUndefined();
  });

  it("accepts an injected providerResolver", () => {
    const config: KnowledgeSourceManagerConfig = {
      providerResolver: { resolveProvider: async () => ({}) },
    };
    expect(config.providerResolver).toBeDefined();
  });
});

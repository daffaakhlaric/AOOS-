import { describe, expect, it } from "vitest";

import { KnowledgeUpdateConfiguration } from "../../src/value-objects/knowledge-update-configuration.js";

describe("KnowledgeUpdateConfiguration", () => {
  it("constructs with valid props", () => {
    const config = new KnowledgeUpdateConfiguration({
      maxConcurrentUpdatesPerTick: 5,
      autoRetryEnabled: true,
      autoRefreshEnabled: true,
      defaultPolicyId: "policy-1",
    });
    expect(config.maxConcurrentUpdatesPerTick).toBe(5);
  });

  it("is frozen", () => {
    const config = KnowledgeUpdateConfiguration.default("policy-1");
    expect(Object.isFrozen(config)).toBe(true);
  });

  it("throws on non-positive maxConcurrentUpdatesPerTick", () => {
    expect(
      () =>
        new KnowledgeUpdateConfiguration({
          maxConcurrentUpdatesPerTick: 0,
          autoRetryEnabled: true,
          autoRefreshEnabled: true,
          defaultPolicyId: "p",
        }),
    ).toThrow(RangeError);
  });

  it("throws on non-integer maxConcurrentUpdatesPerTick", () => {
    expect(
      () =>
        new KnowledgeUpdateConfiguration({
          maxConcurrentUpdatesPerTick: 1.5,
          autoRetryEnabled: true,
          autoRefreshEnabled: true,
          defaultPolicyId: "p",
        }),
    ).toThrow(RangeError);
  });

  it("default() builds a reasonable configuration", () => {
    const config = KnowledgeUpdateConfiguration.default("policy-9");
    expect(config.defaultPolicyId).toBe("policy-9");
    expect(config.autoRetryEnabled).toBe(true);
    expect(config.autoRefreshEnabled).toBe(true);
    expect(config.maxConcurrentUpdatesPerTick).toBeGreaterThan(0);
  });

  it("throws on negative maxConcurrentUpdatesPerTick", () => {
    expect(
      () =>
        new KnowledgeUpdateConfiguration({
          maxConcurrentUpdatesPerTick: -1,
          autoRetryEnabled: true,
          autoRefreshEnabled: true,
          defaultPolicyId: "p",
        }),
    ).toThrow(RangeError);
  });

  it("accepts maxConcurrentUpdatesPerTick of exactly 1", () => {
    expect(
      () =>
        new KnowledgeUpdateConfiguration({
          maxConcurrentUpdatesPerTick: 1,
          autoRetryEnabled: false,
          autoRefreshEnabled: false,
          defaultPolicyId: "p",
        }),
    ).not.toThrow();
  });

  it("with() returns a new instance with merged fields", () => {
    const config = KnowledgeUpdateConfiguration.default("policy-1");
    const updated = config.with({ autoRetryEnabled: false });
    expect(updated).not.toBe(config);
    expect(updated.autoRetryEnabled).toBe(false);
    expect(updated.defaultPolicyId).toBe("policy-1");
    expect(config.autoRetryEnabled).toBe(true);
  });
});

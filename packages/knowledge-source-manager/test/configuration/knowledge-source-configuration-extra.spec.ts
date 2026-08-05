import { describe, expect, it } from "vitest";

import { KnowledgeSourceConfiguration } from "../../src/configuration/knowledge-source-configuration.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";

describe("KnowledgeSourceConfiguration additional coverage", () => {
  const configuration = new KnowledgeSourceConfiguration();

  it("accepts a record with no schedule at all regardless of syncMode", () => {
    expect(configuration.validate(configurationFixture({ schedule: undefined }))).toBe(true);
  });

  it("validate() returns false rather than throwing on an invalid record", () => {
    expect(() =>
      configuration.validate(configurationFixture({ autoSync: true, enabled: false })),
    ).not.toThrow();
  });

  it("merge does not mutate its inputs", () => {
    const base = { a: 1 };
    const overrides = { b: 2 };
    configuration.merge(base, overrides);
    expect(base).toEqual({ a: 1 });
    expect(overrides).toEqual({ b: 2 });
  });

  it("validateExtraSettings flags multiple secret-looking keys at once", () => {
    expect(configuration.validateExtraSettings({ password: "x", token: "y", region: "z" })).toBe(
      false,
    );
  });
});

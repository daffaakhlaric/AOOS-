import { describe, expect, it } from "vitest";

import { KnowledgeProviderConfiguration } from "../../src/configuration/knowledge-provider-configuration.js";
import { ProviderConfigurationException } from "../../src/errors/provider-configuration-exception.js";

describe("KnowledgeProviderConfiguration", () => {
  it("validate() returns true for ordinary metadata settings", () => {
    const configuration = new KnowledgeProviderConfiguration();
    expect(configuration.validate({ syncIntervalMinutes: 15, rootFolder: "/docs" })).toBe(true);
  });

  it("validate() returns false when a key looks like a secret", () => {
    const configuration = new KnowledgeProviderConfiguration();
    expect(configuration.validate({ apiKey: "xyz" })).toBe(false);
    expect(configuration.validate({ password: "xyz" })).toBe(false);
    expect(configuration.validate({ oauthToken: "xyz" })).toBe(false);
    expect(configuration.validate({ clientSecret: "xyz" })).toBe(false);
    expect(configuration.validate({ credential: "xyz" })).toBe(false);
  });

  it("assertValid() throws ProviderConfigurationException for secret-looking keys", () => {
    const configuration = new KnowledgeProviderConfiguration();
    expect(() => configuration.assertValid({ token: "xyz" })).toThrow(
      ProviderConfigurationException,
    );
  });

  it("assertValid() does not throw for ordinary settings", () => {
    const configuration = new KnowledgeProviderConfiguration();
    expect(() => configuration.assertValid({ pageSize: 100 })).not.toThrow();
  });

  it("validate() returns true for an empty settings object", () => {
    const configuration = new KnowledgeProviderConfiguration();
    expect(configuration.validate({})).toBe(true);
  });

  it("validate() is case-insensitive when matching secret-like keys", () => {
    const configuration = new KnowledgeProviderConfiguration();
    expect(configuration.validate({ ApiKey: "xyz" })).toBe(false);
  });

  it("merge() overlays overrides onto the base settings", () => {
    const configuration = new KnowledgeProviderConfiguration();
    expect(configuration.merge({ a: 1, b: 2 }, { b: 3 })).toEqual({ a: 1, b: 3 });
  });
});

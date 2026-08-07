import { describe, expect, it } from "vitest";

import { knowledgeVersionConfigurationRecordSchema } from "../../src/configuration/knowledge-version-configuration-record.js";
import { KnowledgeVersionConfiguration } from "../../src/configuration/knowledge-version-configuration.js";
import { VersionConfigurationException } from "../../src/errors/version-configuration-exception.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";

describe("knowledgeVersionConfigurationRecordSchema", () => {
  it("parses a valid record", () => {
    const record = configurationFixture();
    expect(knowledgeVersionConfigurationRecordSchema.parse(record)).toEqual(record);
  });
});

describe("KnowledgeVersionConfiguration", () => {
  const configuration = new KnowledgeVersionConfiguration();

  it("validate() returns true for a valid record", () => {
    expect(configuration.validate(configurationFixture())).toBe(true);
  });

  it("validate() returns false for autoSnapshot=true with no maxSnapshots", () => {
    expect(
      configuration.validate(configurationFixture({ autoSnapshot: true, maxSnapshots: undefined })),
    ).toBe(false);
  });

  it("assertValid() throws for autoSnapshot=true with no maxSnapshots", () => {
    expect(() =>
      configuration.assertValid(
        configurationFixture({ autoSnapshot: true, maxSnapshots: undefined }),
      ),
    ).toThrow(VersionConfigurationException);
  });

  it("assertValid() passes autoSnapshot=true with a maxSnapshots budget", () => {
    expect(() =>
      configuration.assertValid(configurationFixture({ autoSnapshot: true, maxSnapshots: 5 })),
    ).not.toThrow();
  });

  it("validateExtraSettings()/assertValidExtraSettings() reject secret-looking keys", () => {
    expect(configuration.validateExtraSettings({ apiKey: "x" })).toBe(false);
    expect(configuration.validateExtraSettings({ label: "x" })).toBe(true);
    expect(() => configuration.assertValidExtraSettings({ password: "x" })).toThrow(
      VersionConfigurationException,
    );
    expect(() => configuration.assertValidExtraSettings({ label: "x" })).not.toThrow();
  });

  it("assertValid() rejects secret-looking settings keys", () => {
    expect(() =>
      configuration.assertValid(configurationFixture({ settings: { oauthToken: "x" } })),
    ).toThrow(VersionConfigurationException);
  });

  it("merge() shallow-merges base and overrides", () => {
    expect(configuration.merge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
    expect(configuration.merge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });
});

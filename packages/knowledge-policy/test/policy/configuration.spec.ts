import { describe, expect, it } from "vitest";

import { PolicyConfigurationException } from "../../src/errors/policy-configuration-exception.js";
import { KnowledgePolicyConfiguration } from "../../src/policy/knowledge-policy-configuration.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";

describe("KnowledgePolicyConfiguration", () => {
  const configuration = new KnowledgePolicyConfiguration();

  it("assertValid() passes a valid configuration", () => {
    expect(() => configuration.assertValid(configurationFixture())).not.toThrow();
  });

  it("assertValid() throws on invalid maxRules", () => {
    expect(() => configuration.assertValid(configurationFixture({ maxRules: 0 }))).toThrow(
      PolicyConfigurationException,
    );
  });

  it("assertValid() throws on invalid maxAssignments", () => {
    expect(() => configuration.assertValid(configurationFixture({ maxAssignments: 0 }))).toThrow(
      PolicyConfigurationException,
    );
  });

  it("assertValid() passes when maxRules/maxAssignments are undefined", () => {
    expect(() =>
      configuration.assertValid(
        configurationFixture({ maxRules: undefined, maxAssignments: undefined }),
      ),
    ).not.toThrow();
  });
});

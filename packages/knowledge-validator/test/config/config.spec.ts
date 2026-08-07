import { describe, expect, it } from "vitest";

import type { KnowledgeValidatorConfig } from "../../src/config/knowledge-validator-config.js";
import { KnowledgeValidationDecisionValue } from "../../src/domain/knowledge-validation-decision-value.js";
import { KnowledgeValidator } from "../../src/validation/knowledge-validator.js";
import { fakePublisher } from "../helpers/event-publisher-fixture.js";

describe("KnowledgeValidatorConfig", () => {
  it("accepts an empty config", () => {
    const { publisher } = fakePublisher();
    expect(() => new KnowledgeValidator(publisher, {})).not.toThrow();
  });

  it("accepts a fully populated config exercising every Extension Point", () => {
    const { publisher } = fakePublisher();
    const config: KnowledgeValidatorConfig = {
      provider: { validate: async () => ({ findings: [] }) },
      decisionProvider: {
        decide: async () => ({
          value: KnowledgeValidationDecisionValue.APPROVED,
          reportedBy: "provider-1",
        }),
      },
      ruleProvider: { evaluateRule: async () => [] },
      policyProvider: { evaluate: async () => ({ allowed: true, reasons: [] }) },
      storage: { store: async () => {}, retrieve: async () => undefined },
      publisher: { publish: async () => {} },
      auditProvider: { record: async () => {} },
      scheduler: { schedule: async () => {} },
      reporter: { render: async () => "" },
      costProvider: { estimateCost: async () => 0 },
      streamingProvider: {
        stream: () => (async function* () {})(),
      },
      metricsProvider: { publish: async () => {} },
      embeddingManagerProvider: { embedReport: async () => {} },
      knowledgeGraphProvider: { linkValidation: async () => {} },
    };
    const validator = new KnowledgeValidator(publisher, config);
    expect(validator.hasProvider()).toBe(true);
    expect(validator.hasDecisionProvider()).toBe(true);
  });

  it("defaults to no config when none is supplied to the constructor", () => {
    const { publisher } = fakePublisher();
    const validator = new KnowledgeValidator(publisher);
    expect(validator.hasProvider()).toBe(false);
    expect(validator.hasDecisionProvider()).toBe(false);
  });
});

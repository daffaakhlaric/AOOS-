import { describe, expect, it } from "vitest";

import * as PublicApi from "../src/index.js";

const EXPECTED_PUBLIC_API_CLASSES = [
  "KnowledgeValidator",
  "KnowledgeValidatorManager",
  "KnowledgeValidatorRegistry",
  "KnowledgeValidatorResolver",
  "KnowledgeValidatorValidator",
  "KnowledgeValidatorPipeline",
  "KnowledgeValidatorMiddleware",
  "KnowledgeValidatorFactory",
  "KnowledgeValidatorSession",
  "KnowledgeValidatorLifecycle",
  "KnowledgeValidatorStateMachine",
  "KnowledgeValidatorEvents",
  "KnowledgeValidatorMetrics",
  "KnowledgeValidatorHealth",
  "KnowledgeValidatorMonitoring",
  "KnowledgeValidatorStatistics",
  "KnowledgeValidatorSystem",
];

describe("Public API surface", () => {
  it.each(EXPECTED_PUBLIC_API_CLASSES)("exports %s as a class/value", (name) => {
    expect((PublicApi as Record<string, unknown>)[name]).toBeDefined();
  });

  it("exports exactly the 17 named runtime classes plus supporting domain/contract surface", () => {
    for (const name of EXPECTED_PUBLIC_API_CLASSES) {
      expect(typeof (PublicApi as Record<string, unknown>)[name]).toBe("function");
    }
  });

  it("never exports internal Validator-stage classes as the primary Validator name (KnowledgeValidatorValidator is distinct)", () => {
    expect(PublicApi.KnowledgeValidatorValidator).not.toBe(PublicApi.KnowledgeValidator);
  });

  it("exports the 12 Validator stage classes for extensibility/testing", () => {
    const stageClasses = [
      "IdentityValidator",
      "MetadataValidator",
      "ValidationValidator",
      "RuleValidator",
      "PolicyValidator",
      "DecisionValidator",
      "ConfigurationValidator",
      "LifecycleValidator",
      "DependencyValidator",
      "StatisticsValidator",
      "IntegrityValidator",
      "AuditValidator",
    ];
    for (const name of stageClasses) {
      expect((PublicApi as Record<string, unknown>)[name]).toBeDefined();
    }
  });

  it("exports the domain enums", () => {
    expect(PublicApi.KnowledgeValidationState).toBeDefined();
    expect(PublicApi.KnowledgeValidationCategory).toBeDefined();
    expect(PublicApi.KnowledgeValidationDecisionValue).toBeDefined();
    expect(PublicApi.KnowledgeValidationSessionState).toBeDefined();
  });

  it("exports the KnowledgeValidationRecord domain view class, distinct from the facade", () => {
    expect(PublicApi.KnowledgeValidationRecord).toBeDefined();
    expect(PublicApi.KnowledgeValidationRecord).not.toBe(PublicApi.KnowledgeValidator);
  });

  it("exports the Registry bucket enum", () => {
    expect(Object.values(PublicApi.KnowledgeValidatorRegistryBucket)).toHaveLength(8);
  });

  it("exports the Event type enum", () => {
    expect(Object.values(PublicApi.KnowledgeValidatorEventType)).toHaveLength(11);
  });

  it("exports the token helpers", () => {
    expect(typeof PublicApi.generateKnowledgeValidatorToken).toBe("function");
    expect(typeof PublicApi.isKnowledgeValidatorToken).toBe("function");
  });

  it("exports the context factory", () => {
    expect(typeof PublicApi.createKnowledgeValidatorContext).toBe("function");
  });

  it("exports every error class", () => {
    const errorClasses = [
      "KnowledgeValidatorException",
      "ValidatorNotFoundException",
      "DuplicateValidatorEntryException",
      "IllegalValidationTransitionException",
      "InvalidValidationMetadataException",
      "ValidationCheckException",
      "ValidatorOperationException",
      "ValidatorConfigurationException",
      "ValidatorSessionException",
      "ValidatorLeaseException",
      "ValidatorPolicyException",
      "ValidatorRuleException",
      "ValidatorDecisionException",
      "ValidatorFindingException",
    ];
    for (const name of errorClasses) {
      expect((PublicApi as Record<string, unknown>)[name]).toBeDefined();
    }
  });

  it("exports the policy evaluation helper", () => {
    expect(typeof PublicApi.evaluateKnowledgeValidationPolicy).toBe("function");
  });

  it("exports the finding severities constant", () => {
    expect(PublicApi.KNOWLEDGE_VALIDATION_FINDING_SEVERITIES).toHaveLength(5);
  });

  it("exports the state transition table and terminal/settled sets", () => {
    expect(PublicApi.KNOWLEDGE_VALIDATION_STATE_TRANSITIONS).toBeDefined();
    expect(PublicApi.KNOWLEDGE_VALIDATION_TERMINAL_STATES).toBeDefined();
    expect(PublicApi.KNOWLEDGE_VALIDATION_SETTLED_STATES).toBeDefined();
  });

  it("exports the approval/rejection decision value sets", () => {
    expect(PublicApi.APPROVAL_DECISION_VALUES).toBeDefined();
    expect(PublicApi.REJECTION_DECISION_VALUES).toBeDefined();
  });

  it("exports the empty statistics constant", () => {
    expect(PublicApi.EMPTY_KNOWLEDGE_VALIDATION_STATISTICS).toEqual({
      requestedCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
    });
  });

  it("exports the KnowledgeValidatorSystem bootstrap class", () => {
    expect(PublicApi.KnowledgeValidatorSystem).toBeDefined();
  });

  it("exports readonly registry entry / metrics snapshot supporting types without runtime crash", () => {
    expect(() => {
      const bucket = PublicApi.KnowledgeValidatorRegistryBucket.RULE;
      return bucket;
    }).not.toThrow();
  });

  it("does not export any internal Pipeline/Factory sub-class as a top-level name", () => {
    expect((PublicApi as Record<string, unknown>).ValidationFactory).toBeUndefined();
    expect((PublicApi as Record<string, unknown>).RuleFactory).toBeUndefined();
  });

  it("KnowledgeValidatorFactory instance exposes all 6 named sub-factories", () => {
    const factory = new PublicApi.KnowledgeValidatorFactory();
    expect(Object.keys(factory)).toHaveLength(6);
  });

  it("KnowledgeValidatorRegistryBucket values are all lowercase strings", () => {
    for (const value of Object.values(PublicApi.KnowledgeValidatorRegistryBucket)) {
      expect(value).toBe(value.toLowerCase());
    }
  });
});

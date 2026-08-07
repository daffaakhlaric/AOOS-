import { describe, expect, it } from "vitest";

import * as PublicApi from "../src/index.js";

const EXPECTED_TOP_LEVEL_EXPORTS = [
  "KnowledgePolicy",
  "KnowledgePolicyManager",
  "KnowledgePolicyRegistry",
  "KnowledgePolicyResolver",
  "KnowledgePolicyValidator",
  "KnowledgePolicyPipeline",
  "KnowledgePolicyMiddleware",
  "KnowledgePolicyFactory",
  "KnowledgePolicyContext",
  "KnowledgePolicySession",
  "KnowledgePolicyLifecycle",
  "KnowledgePolicyStateMachine",
  "KnowledgePolicyEvents",
  "KnowledgePolicyMetrics",
  "KnowledgePolicyHealth",
  "KnowledgePolicyMonitoring",
  "KnowledgePolicyStatistics",
  "KnowledgePolicySystem",
];

describe("public API", () => {
  it.each(EXPECTED_TOP_LEVEL_EXPORTS.filter((name) => name !== "KnowledgePolicyContext"))(
    "exports %s as a value",
    (name) => {
      expect(Reflect.has(PublicApi, name)).toBe(true);
      expect((PublicApi as Record<string, unknown>)[name]).toBeDefined();
    },
  );

  it("exports the KnowledgePolicyRegistryBucket enum with 7 members", () => {
    expect(Object.values(PublicApi.KnowledgePolicyRegistryBucket)).toHaveLength(7);
  });

  it("exports the KnowledgePolicyEventType enum with 10 members", () => {
    expect(Object.values(PublicApi.KnowledgePolicyEventType)).toHaveLength(10);
  });

  it("exports the KnowledgePolicyState enum with 9 members", () => {
    expect(Object.values(PublicApi.KnowledgePolicyState)).toHaveLength(9);
  });

  it("exports the KnowledgePolicyType enum with 10 members", () => {
    expect(Object.values(PublicApi.KnowledgePolicyType)).toHaveLength(10);
  });

  it("exports the KnowledgePolicyScopeType enum with 9 members", () => {
    expect(Object.values(PublicApi.KnowledgePolicyScopeType)).toHaveLength(9);
  });

  it("exports the KnowledgePolicyRuleType enum with 5 members", () => {
    expect(Object.values(PublicApi.KnowledgePolicyRuleType)).toHaveLength(5);
  });

  it("exports the KnowledgePolicyOperation enum with 10 members", () => {
    expect(Object.values(PublicApi.KnowledgePolicyOperation)).toHaveLength(10);
  });

  it("exports token helpers", () => {
    expect(typeof PublicApi.generateKnowledgePolicyToken).toBe("function");
    expect(typeof PublicApi.isKnowledgePolicyToken).toBe("function");
  });

  it("exports createKnowledgePolicyContext", () => {
    expect(typeof PublicApi.createKnowledgePolicyContext).toBe("function");
  });

  it("exports the 10 individual validator stage classes for reuse", () => {
    expect(PublicApi.IdentityValidator).toBeTruthy();
    expect(PublicApi.MetadataValidator).toBeTruthy();
    expect(PublicApi.ScopeValidator).toBeTruthy();
    expect(PublicApi.RulesValidator).toBeTruthy();
    expect(PublicApi.ConditionsValidator).toBeTruthy();
    expect(PublicApi.AssignmentValidator).toBeTruthy();
    expect(PublicApi.PolicyTypeValidator).toBeTruthy();
    expect(PublicApi.ConfigurationValidator).toBeTruthy();
    expect(PublicApi.DependencyValidator).toBeTruthy();
    expect(PublicApi.IntegrityValidator).toBeTruthy();
  });

  it("exports the KnowledgePolicyRecord domain view distinct from the KnowledgePolicy façade", () => {
    expect(PublicApi.KnowledgePolicyRecord).toBeTruthy();
    expect(PublicApi.KnowledgePolicyRecord).not.toBe(PublicApi.KnowledgePolicy);
  });

  it("exports all 14 error classes", () => {
    expect(PublicApi.KnowledgePolicyException).toBeTruthy();
    expect(PublicApi.DuplicatePolicyEntryException).toBeTruthy();
    expect(PublicApi.IllegalPolicyTransitionException).toBeTruthy();
    expect(PublicApi.InvalidPolicyMetadataException).toBeTruthy();
    expect(PublicApi.PolicyNotFoundException).toBeTruthy();
    expect(PublicApi.PolicyOperationException).toBeTruthy();
    expect(PublicApi.PolicyPermissionDeniedException).toBeTruthy();
    expect(PublicApi.PolicyValidationException).toBeTruthy();
    expect(PublicApi.PolicyViolationException).toBeTruthy();
    expect(PublicApi.PolicyConfigurationException).toBeTruthy();
    expect(PublicApi.PolicySessionException).toBeTruthy();
    expect(PublicApi.PolicyLeaseException).toBeTruthy();
    expect(PublicApi.PolicyAssignmentException).toBeTruthy();
    expect(PublicApi.PolicyEvaluationException).toBeTruthy();
    expect(PublicApi.PolicyRuleException).toBeTruthy();
  });

  it("exports the KnowledgePolicyPermission and KnowledgePolicyConfiguration façade helpers", () => {
    expect(PublicApi.KnowledgePolicyPermission).toBeTruthy();
    expect(PublicApi.KnowledgePolicyConfiguration).toBeTruthy();
  });
});

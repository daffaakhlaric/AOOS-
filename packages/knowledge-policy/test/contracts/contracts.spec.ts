import { describe, expect, it } from "vitest";

import type { IKnowledgeActionResolver } from "../../src/contracts/i-knowledge-action-resolver.js";
import type { IKnowledgeComplianceProvider } from "../../src/contracts/i-knowledge-compliance-provider.js";
import type { IKnowledgeConditionResolver } from "../../src/contracts/i-knowledge-condition-resolver.js";
import type { IKnowledgeGeneratorPolicy } from "../../src/contracts/i-knowledge-generator-policy.js";
import type { IKnowledgeMarketplacePolicy } from "../../src/contracts/i-knowledge-marketplace-policy.js";
import type { IKnowledgePolicyAuditProvider } from "../../src/contracts/i-knowledge-policy-audit-provider.js";
import type { IKnowledgePolicyConflictResolver } from "../../src/contracts/i-knowledge-policy-conflict-resolver.js";
import type { IKnowledgePolicyEvaluator } from "../../src/contracts/i-knowledge-policy-evaluator.js";
import type {
  ActivatePolicyInput,
  ArchivePolicyInput,
  AssignPolicyInput,
  DestroyPolicyInput,
  EvaluatePolicyInput,
  RestorePolicyInput,
  SuspendPolicyInput,
  UnassignPolicyInput,
  ValidatePolicyInput,
} from "../../src/contracts/i-knowledge-policy-operations.js";
import type { IKnowledgePolicyProvider } from "../../src/contracts/i-knowledge-policy-provider.js";
import type { IKnowledgePolicyPublisher } from "../../src/contracts/i-knowledge-policy-publisher.js";
import type { IKnowledgePolicyStorage } from "../../src/contracts/i-knowledge-policy-storage.js";
import type { IKnowledgePolicyValidator } from "../../src/contracts/i-knowledge-policy-validator.js";
import type { IKnowledgePolicy } from "../../src/contracts/i-knowledge-policy.js";
import type { IKnowledgeQualityPolicy } from "../../src/contracts/i-knowledge-quality-policy.js";
import type { IKnowledgeScopeResolver } from "../../src/contracts/i-knowledge-scope-resolver.js";
import type { IKnowledgeValidatorAiPolicy } from "../../src/contracts/i-knowledge-validator-ai-policy.js";
import { KnowledgePolicyRecord } from "../../src/domain/knowledge-policy-record.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Extension Point contracts — interface-only, minimally implementable", () => {
  it("IKnowledgePolicyEvaluator", async () => {
    const evaluator: IKnowledgePolicyEvaluator = {
      evaluate: async (policyId, targetId) => ({
        id: "eval-1",
        policyId,
        targetId,
        result: "pass" as never,
        violations: [],
        evaluatedAt: new Date().toISOString(),
        metadata: {},
      }),
    };
    await expect(evaluator.evaluate("policy-1", "target-1")).resolves.toMatchObject({
      policyId: "policy-1",
    });
  });

  it("IKnowledgePolicyProvider", async () => {
    const provider: IKnowledgePolicyProvider = {
      load: async () => undefined,
      save: async () => undefined,
    };
    await expect(provider.load("policy-1")).resolves.toBeUndefined();
    await expect(provider.save(executionFixture())).resolves.toBeUndefined();
  });

  it("IKnowledgeComplianceProvider", async () => {
    const provider: IKnowledgeComplianceProvider = {
      checkCompliance: async () => ({ compliant: true, details: {} }),
    };
    await expect(provider.checkCompliance("policy-1", "target-1")).resolves.toEqual({
      compliant: true,
      details: {},
    });
  });

  it("IKnowledgeConditionResolver", async () => {
    const resolver: IKnowledgeConditionResolver = {
      resolve: async () => true,
    };
    await expect(
      resolver.resolve(
        { id: "c1", ruleId: "r1", field: "f", operator: "eq", value: 1, metadata: {} },
        {},
      ),
    ).resolves.toBe(true);
  });

  it("IKnowledgeActionResolver", async () => {
    const resolver: IKnowledgeActionResolver = {
      execute: async () => undefined,
    };
    await expect(
      resolver.execute(
        { id: "a1", ruleId: "r1", actionType: "notify", parameters: {}, metadata: {} },
        {},
      ),
    ).resolves.toBeUndefined();
  });

  it("IKnowledgeScopeResolver", async () => {
    const resolver: IKnowledgeScopeResolver = {
      resolve: async () => ["target-1"],
    };
    await expect(
      resolver.resolve({ id: "s1", policyId: "p1", scopeType: "global" as never, metadata: {} }),
    ).resolves.toEqual(["target-1"]);
  });

  it("IKnowledgePolicyStorage", async () => {
    const storage: IKnowledgePolicyStorage = {
      load: async () => undefined,
      save: async () => undefined,
      delete: async () => undefined,
    };
    await expect(storage.load("policy-1")).resolves.toBeUndefined();
    await expect(storage.save(executionFixture())).resolves.toBeUndefined();
    await expect(storage.delete("policy-1")).resolves.toBeUndefined();
  });

  it("IKnowledgePolicyPublisher", async () => {
    const publisher: IKnowledgePolicyPublisher = {
      publish: async () => undefined,
    };
    await expect(publisher.publish({ type: "x" })).resolves.toBeUndefined();
  });

  it("IKnowledgePolicyAuditProvider", async () => {
    const provider: IKnowledgePolicyAuditProvider = {
      record: async () => undefined,
    };
    await expect(
      provider.record({
        id: "audit-1",
        operation: "create_policy",
        policyId: "policy-1",
        tenantId: "tenant-1",
        occurredAt: new Date().toISOString(),
      }),
    ).resolves.toBeUndefined();
  });

  it("IKnowledgePolicyConflictResolver", async () => {
    const resolver: IKnowledgePolicyConflictResolver = {
      resolve: async (policyIds) => policyIds[0] ?? "",
    };
    await expect(resolver.resolve(["p1", "p2"], "target-1")).resolves.toBe("p1");
  });

  it("IKnowledgePolicy is satisfied by a KnowledgePolicyRecord", () => {
    const record: IKnowledgePolicy = new KnowledgePolicyRecord(executionFixture());
    expect(record.id).toBeTruthy();
  });
});

describe("Future-readiness contracts — 005.7J/K/L/M", () => {
  it("IKnowledgeMarketplacePolicy (005.7J)", async () => {
    const impl: IKnowledgeMarketplacePolicy = {
      evaluateMarketplacePolicy: async () => ({ allowed: true }),
    };
    await expect(impl.evaluateMarketplacePolicy("p1", "listing-1")).resolves.toEqual({
      allowed: true,
    });
  });

  it("IKnowledgeGeneratorPolicy (005.7K)", async () => {
    const impl: IKnowledgeGeneratorPolicy = {
      evaluateGenerationPolicy: async () => ({ allowed: false }),
    };
    await expect(impl.evaluateGenerationPolicy("p1", "generator-1")).resolves.toEqual({
      allowed: false,
    });
  });

  it("IKnowledgeQualityPolicy (005.7L)", async () => {
    const impl: IKnowledgeQualityPolicy = {
      evaluateQualityPolicy: async () => ({ score: 0.9, passed: true }),
    };
    await expect(impl.evaluateQualityPolicy("p1", "asset-1")).resolves.toEqual({
      score: 0.9,
      passed: true,
    });
  });

  it("IKnowledgeValidatorAiPolicy (005.7M)", async () => {
    const impl: IKnowledgeValidatorAiPolicy = {
      evaluateValidationPolicy: async () => ({ valid: true, confidence: 0.95 }),
    };
    await expect(impl.evaluateValidationPolicy("p1", "validation-1")).resolves.toEqual({
      valid: true,
      confidence: 0.95,
    });
  });
});

describe("Policy Operation input contracts — shape only", () => {
  it("accepts minimal ValidatePolicyInput/ActivatePolicyInput/SuspendPolicyInput", () => {
    const validate: ValidatePolicyInput = { token: "kpol_1" };
    const activate: ActivatePolicyInput = { token: "kpol_1", reason: "go-live" };
    const suspend: SuspendPolicyInput = { token: "kpol_1" };
    expect(validate.token).toBe("kpol_1");
    expect(activate.reason).toBe("go-live");
    expect(suspend.token).toBe("kpol_1");
  });

  it("accepts minimal ArchivePolicyInput/RestorePolicyInput/DestroyPolicyInput", () => {
    const archive: ArchivePolicyInput = { token: "kpol_1" };
    const restore: RestorePolicyInput = { token: "kpol_1" };
    const destroy: DestroyPolicyInput = { token: "kpol_1" };
    expect(archive.token).toBe("kpol_1");
    expect(restore.token).toBe("kpol_1");
    expect(destroy.token).toBe("kpol_1");
  });

  it("accepts minimal AssignPolicyInput/UnassignPolicyInput/EvaluatePolicyInput", () => {
    const assign: AssignPolicyInput = { token: "kpol_1", targetType: "workspace", targetId: "w1" };
    const unassign: UnassignPolicyInput = { token: "kpol_1", assignmentId: "a1" };
    const evaluate: EvaluatePolicyInput = { token: "kpol_1", targetId: "target-1" };
    expect(assign.targetType).toBe("workspace");
    expect(unassign.assignmentId).toBe("a1");
    expect(evaluate.targetId).toBe("target-1");
  });
});

describe("IKnowledgePolicyValidator contract", () => {
  it("is satisfiable by a minimal custom stage", () => {
    const stage: IKnowledgePolicyValidator = {
      name: "custom",
      validate: () => ({ valid: true, issues: [] }),
    };
    expect(stage.validate({} as never)).toEqual({ valid: true, issues: [] });
  });
});

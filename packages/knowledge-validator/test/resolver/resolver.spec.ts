import { describe, expect, it } from "vitest";

import { KnowledgeValidationCategory } from "../../src/domain/knowledge-validation-category.js";
import { ValidatorNotFoundException } from "../../src/errors/validator-not-found-exception.js";
import { KnowledgeValidatorRegistryBucket } from "../../src/registry/knowledge-validator-registry-bucket.js";
import { KnowledgeValidatorRegistry } from "../../src/registry/knowledge-validator-registry.js";
import { KnowledgeValidatorResolver } from "../../src/resolver/knowledge-validator-resolver.js";

const now = "2026-01-01T00:00:00.000Z";

function buildRegistry(): KnowledgeValidatorRegistry {
  const registry = new KnowledgeValidatorRegistry();
  registry.register(KnowledgeValidatorRegistryBucket.VALIDATION, {
    id: "v-1",
    token: "kval_1",
    metadata: {},
  });
  registry.register(KnowledgeValidatorRegistryBucket.RULE, {
    id: "rule-1",
    ruleId: "rule-1",
    name: "Rule",
    tenantId: "t-1",
    category: KnowledgeValidationCategory.SECURITY_VALIDATION,
    severity: "medium",
    active: true,
    createdAt: now,
    updatedAt: now,
  });
  registry.register(KnowledgeValidatorRegistryBucket.CONFIGURATION, {
    id: "c-1",
    configurationId: "c-1",
    validationId: "v-1",
    tenantId: "t-1",
    custom: {},
    createdAt: now,
  });
  registry.register(KnowledgeValidatorRegistryBucket.DECISION, {
    id: "d-1",
    decisionId: "d-1",
    validationId: "v-1",
    tenantId: "t-1",
    value: "approved",
    reportedBy: "user-1",
    recordedAt: now,
  });
  return registry;
}

describe("KnowledgeValidatorResolver", () => {
  describe("Validation Resolver", () => {
    it("resolveValidation resolves a registered validation", () => {
      const resolver = new KnowledgeValidatorResolver(buildRegistry());
      expect(resolver.resolveValidation("v-1")).toBeDefined();
    });

    it("resolveValidation throws for an unregistered id", () => {
      const resolver = new KnowledgeValidatorResolver(buildRegistry());
      expect(() => resolver.resolveValidation("missing")).toThrow(ValidatorNotFoundException);
    });

    it("tryResolveValidation returns undefined for an unregistered id", () => {
      const resolver = new KnowledgeValidatorResolver(buildRegistry());
      expect(resolver.tryResolveValidation("missing")).toBeUndefined();
    });
  });

  describe("Rule Resolver", () => {
    it("resolveRule resolves a registered rule", () => {
      const resolver = new KnowledgeValidatorResolver(buildRegistry());
      expect(resolver.resolveRule("rule-1")?.name).toBe("Rule");
    });

    it("resolveRule throws for an unregistered id", () => {
      const resolver = new KnowledgeValidatorResolver(buildRegistry());
      expect(() => resolver.resolveRule("missing")).toThrow(ValidatorNotFoundException);
    });

    it("tryResolveRule returns undefined for an unregistered id", () => {
      const resolver = new KnowledgeValidatorResolver(buildRegistry());
      expect(resolver.tryResolveRule("missing")).toBeUndefined();
    });

    it("resolveRules resolves every id", () => {
      const resolver = new KnowledgeValidatorResolver(buildRegistry());
      expect(resolver.resolveRules(["rule-1"])).toHaveLength(1);
    });

    it("resolveRules throws when any id is missing", () => {
      const resolver = new KnowledgeValidatorResolver(buildRegistry());
      expect(() => resolver.resolveRules(["rule-1", "missing"])).toThrow(
        ValidatorNotFoundException,
      );
    });

    it("tryResolveRules partitions resolved vs missing ids", () => {
      const resolver = new KnowledgeValidatorResolver(buildRegistry());
      const result = resolver.tryResolveRules(["rule-1", "missing"]);
      expect(result.resolved).toHaveLength(1);
      expect(result.missing).toEqual(["missing"]);
    });

    it("tryResolveRules returns everything resolved when all ids exist", () => {
      const resolver = new KnowledgeValidatorResolver(buildRegistry());
      const result = resolver.tryResolveRules(["rule-1"]);
      expect(result.missing).toEqual([]);
    });
  });

  describe("Policy Resolver", () => {
    it("registerPolicy + resolvePolicy round-trips a policy", () => {
      const resolver = new KnowledgeValidatorResolver(buildRegistry());
      resolver.registerPolicy({
        id: "p-1",
        policyId: "p-1",
        name: "Policy",
        tenantId: "t-1",
        allowedCategories: [],
        requireApproval: false,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      expect(resolver.resolvePolicy("p-1")?.name).toBe("Policy");
    });

    it("resolvePolicy throws for an unregistered id", () => {
      const resolver = new KnowledgeValidatorResolver(buildRegistry());
      expect(() => resolver.resolvePolicy("missing")).toThrow(ValidatorNotFoundException);
    });

    it("tryResolvePolicy returns undefined for an unregistered id", () => {
      const resolver = new KnowledgeValidatorResolver(buildRegistry());
      expect(resolver.tryResolvePolicy("missing")).toBeUndefined();
    });
  });

  describe("Configuration Resolver", () => {
    it("resolveConfiguration resolves a registered configuration", () => {
      const resolver = new KnowledgeValidatorResolver(buildRegistry());
      expect(resolver.resolveConfiguration("c-1")).toBeDefined();
    });

    it("resolveConfiguration throws for an unregistered id", () => {
      const resolver = new KnowledgeValidatorResolver(buildRegistry());
      expect(() => resolver.resolveConfiguration("missing")).toThrow(ValidatorNotFoundException);
    });

    it("tryResolveConfiguration returns undefined for an unregistered id", () => {
      const resolver = new KnowledgeValidatorResolver(buildRegistry());
      expect(resolver.tryResolveConfiguration("missing")).toBeUndefined();
    });
  });

  describe("Decision Resolver", () => {
    it("resolveDecision resolves a registered decision", () => {
      const resolver = new KnowledgeValidatorResolver(buildRegistry());
      expect(resolver.resolveDecision("d-1")).toBeDefined();
    });

    it("resolveDecision throws for an unregistered id", () => {
      const resolver = new KnowledgeValidatorResolver(buildRegistry());
      expect(() => resolver.resolveDecision("missing")).toThrow(ValidatorNotFoundException);
    });

    it("tryResolveDecision returns undefined for an unregistered id", () => {
      const resolver = new KnowledgeValidatorResolver(buildRegistry());
      expect(resolver.tryResolveDecision("missing")).toBeUndefined();
    });
  });
});

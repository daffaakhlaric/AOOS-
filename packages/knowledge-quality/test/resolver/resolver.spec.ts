import { describe, expect, it } from "vitest";

import { KnowledgeQualityDimension } from "../../src/domain/knowledge-quality-dimension.js";
import { QualityNotFoundException } from "../../src/errors/quality-not-found-exception.js";
import { KnowledgeQualityRegistryBucket } from "../../src/registry/knowledge-quality-registry-bucket.js";
import { KnowledgeQualityRegistry } from "../../src/registry/knowledge-quality-registry.js";
import { KnowledgeQualityResolver } from "../../src/resolver/knowledge-quality-resolver.js";

const now = new Date().toISOString();

function buildResolver(): {
  registry: KnowledgeQualityRegistry;
  resolver: KnowledgeQualityResolver;
} {
  const registry = new KnowledgeQualityRegistry();
  return { registry, resolver: new KnowledgeQualityResolver(registry) };
}

describe("KnowledgeQualityResolver — Assessment Resolver", () => {
  it("resolves a registered Assessment", () => {
    const { registry, resolver } = buildResolver();
    registry.register(KnowledgeQualityRegistryBucket.ASSESSMENT, {
      id: "g-1",
      assessmentId: "g-1",
    });
    expect(resolver.resolveAssessment("g-1")).toBeDefined();
    expect(resolver.tryResolveAssessment("g-1")).toBeDefined();
  });

  it("throws QualityNotFoundException for an unregistered Assessment", () => {
    const { resolver } = buildResolver();
    expect(() => resolver.resolveAssessment("missing")).toThrow(QualityNotFoundException);
  });

  it("tryResolveAssessment() returns undefined for an unregistered Assessment", () => {
    const { resolver } = buildResolver();
    expect(resolver.tryResolveAssessment("missing")).toBeUndefined();
  });
});

describe("KnowledgeQualityResolver — Rule Resolver", () => {
  it("resolves a registered Rule", () => {
    const { registry, resolver } = buildResolver();
    registry.register(KnowledgeQualityRegistryBucket.RULE, {
      id: "r-1",
      ruleId: "r-1",
      name: "Rule",
      tenantId: "tenant-1",
      dimension: KnowledgeQualityDimension.ACCURACY,
      severity: "medium",
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    expect(resolver.resolveRule("r-1").ruleId).toBe("r-1");
  });

  it("throws for an unregistered Rule", () => {
    const { resolver } = buildResolver();
    expect(() => resolver.resolveRule("missing")).toThrow(QualityNotFoundException);
  });

  it("tryResolveRule() returns undefined when unresolved", () => {
    const { resolver } = buildResolver();
    expect(resolver.tryResolveRule("missing")).toBeUndefined();
  });

  it("resolveRules() resolves every id in order", () => {
    const { registry, resolver } = buildResolver();
    registry.register(KnowledgeQualityRegistryBucket.RULE, {
      id: "r-1",
      ruleId: "r-1",
      name: "Rule 1",
      tenantId: "tenant-1",
      dimension: KnowledgeQualityDimension.ACCURACY,
      severity: "medium",
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    registry.register(KnowledgeQualityRegistryBucket.RULE, {
      id: "r-2",
      ruleId: "r-2",
      name: "Rule 2",
      tenantId: "tenant-1",
      dimension: KnowledgeQualityDimension.CLARITY,
      severity: "low",
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    const resolved = resolver.resolveRules(["r-1", "r-2"]);
    expect(resolved.map((rule) => rule.ruleId)).toEqual(["r-1", "r-2"]);
  });

  it("resolveRules() throws when any id is missing", () => {
    const { registry, resolver } = buildResolver();
    registry.register(KnowledgeQualityRegistryBucket.RULE, {
      id: "r-1",
      ruleId: "r-1",
      name: "Rule 1",
      tenantId: "tenant-1",
      dimension: KnowledgeQualityDimension.ACCURACY,
      severity: "medium",
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    expect(() => resolver.resolveRules(["r-1", "missing"])).toThrow(QualityNotFoundException);
  });

  it("tryResolveRules() partitions resolved and missing ids", () => {
    const { registry, resolver } = buildResolver();
    registry.register(KnowledgeQualityRegistryBucket.RULE, {
      id: "r-1",
      ruleId: "r-1",
      name: "Rule 1",
      tenantId: "tenant-1",
      dimension: KnowledgeQualityDimension.ACCURACY,
      severity: "medium",
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    const { resolved, missing } = resolver.tryResolveRules(["r-1", "missing"]);
    expect(resolved.map((rule) => rule.ruleId)).toEqual(["r-1"]);
    expect(missing).toEqual(["missing"]);
  });
});

describe("KnowledgeQualityResolver — Profile Resolver", () => {
  it("resolves a registered Profile", () => {
    const { registry, resolver } = buildResolver();
    registry.register(KnowledgeQualityRegistryBucket.PROFILE, {
      id: "p-1",
      profileId: "p-1",
      name: "Profile",
      tenantId: "tenant-1",
      ruleIds: [],
      dimensionWeights: {},
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    expect(resolver.resolveProfile("p-1").profileId).toBe("p-1");
  });

  it("throws for an unregistered Profile", () => {
    const { resolver } = buildResolver();
    expect(() => resolver.resolveProfile("missing")).toThrow(QualityNotFoundException);
  });

  it("tryResolveProfile() returns undefined when unresolved", () => {
    const { resolver } = buildResolver();
    expect(resolver.tryResolveProfile("missing")).toBeUndefined();
  });
});

describe("KnowledgeQualityResolver — Policy Resolver", () => {
  it("resolves a registered Policy", () => {
    const { resolver } = buildResolver();
    resolver.registerPolicy({
      id: "pol-1",
      policyId: "pol-1",
      name: "Policy",
      tenantId: "tenant-1",
      allowedDimensions: [],
      allowedModes: [],
      requireApproval: false,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    expect(resolver.resolvePolicy("pol-1").policyId).toBe("pol-1");
  });

  it("throws for an unregistered Policy", () => {
    const { resolver } = buildResolver();
    expect(() => resolver.resolvePolicy("missing")).toThrow(QualityNotFoundException);
  });

  it("tryResolvePolicy() returns undefined when unresolved", () => {
    const { resolver } = buildResolver();
    expect(resolver.tryResolvePolicy("missing")).toBeUndefined();
  });

  it("registerPolicy() returns the registered Policy", () => {
    const { resolver } = buildResolver();
    const policy = resolver.registerPolicy({
      id: "pol-2",
      policyId: "pol-2",
      name: "Policy 2",
      tenantId: "tenant-1",
      allowedDimensions: [],
      allowedModes: [],
      requireApproval: false,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    expect(policy.policyId).toBe("pol-2");
  });
});

describe("KnowledgeQualityResolver — Configuration Resolver", () => {
  it("resolves a registered Configuration", () => {
    const { registry, resolver } = buildResolver();
    registry.register(KnowledgeQualityRegistryBucket.CONFIGURATION, {
      id: "cfg-1",
      configurationId: "cfg-1",
      assessmentId: "g-1",
      tenantId: "tenant-1",
      custom: {},
      createdAt: now,
    });
    expect(resolver.resolveConfiguration("cfg-1").configurationId).toBe("cfg-1");
  });

  it("throws for an unregistered Configuration", () => {
    const { resolver } = buildResolver();
    expect(() => resolver.resolveConfiguration("missing")).toThrow(QualityNotFoundException);
  });

  it("tryResolveConfiguration() returns undefined when unresolved", () => {
    const { resolver } = buildResolver();
    expect(resolver.tryResolveConfiguration("missing")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

import { PolicyNotFoundException } from "../../src/errors/policy-not-found-exception.js";
import { KnowledgePolicyRegistryBucket } from "../../src/registry/knowledge-policy-registry-bucket.js";
import { KnowledgePolicyRegistry } from "../../src/registry/knowledge-policy-registry.js";
import { KnowledgePolicyResolver } from "../../src/resolver/knowledge-policy-resolver.js";
import { assignmentFixture } from "../helpers/assignment-fixture.js";
import { ruleFixture } from "../helpers/rule-fixture.js";
import { scopeFixture } from "../helpers/scope-fixture.js";

function buildResolver() {
  const registry = new KnowledgePolicyRegistry();
  const resolver = new KnowledgePolicyResolver(registry);
  return { registry, resolver };
}

describe("KnowledgePolicyResolver — policy", () => {
  it("resolvePolicy() throws PolicyNotFoundException when unresolved", () => {
    const { resolver } = buildResolver();
    expect(() => resolver.resolvePolicy("missing")).toThrow(PolicyNotFoundException);
  });

  it("tryResolvePolicy() returns undefined when unresolved", () => {
    const { resolver } = buildResolver();
    expect(resolver.tryResolvePolicy("missing")).toBeUndefined();
  });

  it("resolvePolicy() returns the registered entry", () => {
    const { registry, resolver } = buildResolver();
    const entry = { id: "policy-1", token: "kpol_1", metadata: {}, configuration: {} } as never;
    registry.register(KnowledgePolicyRegistryBucket.POLICY, entry);
    expect(resolver.resolvePolicy("policy-1")).toEqual(entry);
  });
});

describe("KnowledgePolicyResolver — rule", () => {
  it("resolveRule() throws when unresolved", () => {
    const { resolver } = buildResolver();
    expect(() => resolver.resolveRule("missing")).toThrow(PolicyNotFoundException);
  });

  it("tryResolveRule() resolves a registered rule", () => {
    const { registry, resolver } = buildResolver();
    const rule = ruleFixture();
    registry.register(KnowledgePolicyRegistryBucket.RULE, rule);
    expect(resolver.tryResolveRule(rule.id)).toEqual(rule);
    expect(resolver.resolveRule(rule.id)).toEqual(rule);
  });
});

describe("KnowledgePolicyResolver — scope", () => {
  it("resolveScope() throws when unresolved", () => {
    const { resolver } = buildResolver();
    expect(() => resolver.resolveScope("missing")).toThrow(PolicyNotFoundException);
  });

  it("tryResolveScope() resolves a registered scope", () => {
    const { registry, resolver } = buildResolver();
    const scope = scopeFixture();
    registry.register(KnowledgePolicyRegistryBucket.SCOPE, scope);
    expect(resolver.tryResolveScope(scope.id)).toEqual(scope);
    expect(resolver.resolveScope(scope.id)).toEqual(scope);
  });
});

describe("KnowledgePolicyResolver — assignment", () => {
  it("resolveAssignment() throws when unresolved", () => {
    const { resolver } = buildResolver();
    expect(() => resolver.resolveAssignment("missing")).toThrow(PolicyNotFoundException);
  });

  it("tryResolveAssignment() resolves a registered assignment", () => {
    const { registry, resolver } = buildResolver();
    const assignment = assignmentFixture();
    registry.register(KnowledgePolicyRegistryBucket.ASSIGNMENT, assignment);
    expect(resolver.tryResolveAssignment(assignment.id)).toEqual(assignment);
    expect(resolver.resolveAssignment(assignment.id)).toEqual(assignment);
  });
});

describe("KnowledgePolicyResolver — evaluation", () => {
  it("resolveEvaluation() throws when unresolved", () => {
    const { resolver } = buildResolver();
    expect(() => resolver.resolveEvaluation("missing")).toThrow(PolicyNotFoundException);
  });

  it("tryResolveEvaluation() resolves a registered evaluation", () => {
    const { registry, resolver } = buildResolver();
    const evaluation = {
      id: "eval-1",
      policyId: "policy-1",
      targetId: "target-1",
      result: "pass",
      violations: [],
      evaluatedAt: "2026-01-01T00:00:00.000Z",
      metadata: {},
    } as never;
    registry.register(KnowledgePolicyRegistryBucket.EVALUATION, evaluation);
    expect(resolver.tryResolveEvaluation("eval-1")).toEqual(evaluation);
    expect(resolver.resolveEvaluation("eval-1")).toEqual(evaluation);
  });
});

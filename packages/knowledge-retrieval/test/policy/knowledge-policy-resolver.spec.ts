import { KnowledgePolicyType } from "@aos/knowledge-engine";
import { describe, expect, it } from "vitest";

import { KnowledgePolicyResolver } from "../../src/policy/knowledge-policy-resolver.js";
import { KnowledgeResolver } from "../../src/resolver/knowledge-resolver.js";
import { engineFixture } from "../helpers/engine-fixture.js";
import { resultFixture } from "../helpers/result-fixture.js";

async function policyResolverFixture() {
  const { engine, indexing, asset } = await engineFixture();
  const resolver = new KnowledgeResolver(
    engine.repository,
    engine.relationshipEngine,
    engine.policyEngine,
    engine.permissionEngine,
    engine.versionEngine,
    engine.templateEngine,
    indexing.resolver,
  );
  return {
    engine,
    resolver,
    asset,
    policyResolver: new KnowledgePolicyResolver(engine.policyEngine, resolver),
  };
}

describe("KnowledgePolicyResolver", () => {
  it("allows every Result when no Policy is registered", async () => {
    const { policyResolver, asset } = await policyResolverFixture();
    const { allowed, rejectedCount } = policyResolver.resolve([resultFixture(asset)]);
    expect(allowed).toHaveLength(1);
    expect(rejectedCount).toBe(0);
  });

  it("filters out a Result whose Asset violates a Retention Policy", async () => {
    const { engine, policyResolver, asset } = await policyResolverFixture();
    engine.policyEngine.register({
      id: "policy-retention",
      name: "Retention",
      type: KnowledgePolicyType.RETENTION,
      scope: asset.scope,
      rule: { maxAgeDays: 0 },
      enabled: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    });
    const agedAsset = {
      ...asset,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    };
    engine.repository.update(agedAsset);
    const { allowed, rejectedCount } = policyResolver.resolve([resultFixture(asset)]);
    expect(allowed).toEqual([]);
    expect(rejectedCount).toBe(1);
  });

  it("passes through a Result whose Asset can no longer be resolved", async () => {
    const { policyResolver, asset } = await policyResolverFixture();
    const orphaned = resultFixture(asset, { assetId: "missing-asset" });
    const { allowed, rejectedCount } = policyResolver.resolve([orphaned]);
    expect(allowed).toEqual([orphaned]);
    expect(rejectedCount).toBe(0);
  });
});

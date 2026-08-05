import {
  KnowledgeRelationshipType,
  KnowledgePolicyType,
  KnowledgeTemplateCategory,
} from "@aos/knowledge-engine";
import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeResolver } from "../../src/resolver/knowledge-runtime-resolver.js";
import { engineFixture } from "../helpers/engine-fixture.js";

function buildResolver(engine: Awaited<ReturnType<typeof engineFixture>>["engine"]) {
  return new KnowledgeRuntimeResolver(
    engine.repository,
    engine.relationshipEngine,
    engine.policyEngine,
    engine.permissionEngine,
    engine.versionEngine,
    engine.templateEngine,
  );
}

describe("Resolver Test — KnowledgeRuntimeResolver", () => {
  it("resolveAsset() reads a saved KnowledgeAsset", async () => {
    const { engine, asset } = await engineFixture();
    const resolver = buildResolver(engine);
    expect(resolver.resolveAsset(asset.id)).toBe(asset);
  });

  it("resolveNamespace() parses a knowledge:// namespace URI", async () => {
    const { engine, asset } = await engineFixture();
    const resolver = buildResolver(engine);
    expect(resolver.resolveNamespace(asset.namespace).document).toBe("doc-1");
  });

  it("resolveRelationships()/resolveDependencies()/resolveReferences() reflect the Relationship Engine", async () => {
    const { engine, asset: a } = await engineFixture({ tenantId: "tenant-1" });
    const { asset: b } = await engineFixture({ tenantId: "tenant-1", workspaceId: "workspace-2" });
    const resolver = buildResolver(engine);

    engine.relationshipEngine.add({
      id: "r-1",
      fromAssetId: a.id,
      toAssetId: b.id,
      type: KnowledgeRelationshipType.DEPENDS_ON,
      createdAt: new Date().toISOString(),
    });
    engine.relationshipEngine.add({
      id: "r-2",
      fromAssetId: a.id,
      toAssetId: b.id,
      type: KnowledgeRelationshipType.REFERENCE,
      createdAt: new Date().toISOString(),
    });

    expect(resolver.resolveRelationships(a.id).length).toBeGreaterThanOrEqual(2);
    expect(resolver.resolveDependencies(a.id)).toHaveLength(1);
    expect(resolver.resolveReferences(a.id)).toHaveLength(1);
  });

  it("resolvePolicies() delegates to the Policy Engine", async () => {
    const { engine, asset } = await engineFixture();
    const resolver = buildResolver(engine);
    engine.policyEngine.register({
      id: "p-1",
      name: "retention",
      type: KnowledgePolicyType.RETENTION,
      scope: { tenantId: asset.scope.tenantId },
      rule: { maxAgeDays: -1 },
      enabled: true,
      createdAt: new Date().toISOString(),
    });
    expect(resolver.resolvePolicies(asset).length).toBeGreaterThan(0);
  });

  it("resolvePermission() delegates to the Permission Engine (permissive default)", async () => {
    const { engine, asset } = await engineFixture();
    const resolver = buildResolver(engine);
    const context = {
      token: {
        workflowExecutionId: "w-1",
        workflowInstanceId: "wi-1",
        executionId: "e-1",
        startedAt: new Date().toISOString(),
        correlationId: "c-1",
      },
      tenantId: asset.scope.tenantId,
      correlationId: "c-1",
      metadata: {},
      permissions: [],
      policies: [],
      labels: [],
      tags: [],
      variables: {},
    } as never;
    expect(resolver.resolvePermission(context, asset, "read")).toBe(true);
  });

  it("resolveVersionHistory() delegates to the Version Engine", async () => {
    const { engine, asset } = await engineFixture();
    const resolver = buildResolver(engine);
    engine.versionEngine.snapshot(asset);
    expect(resolver.resolveVersionHistory(asset.id)).toHaveLength(1);
  });

  it("resolveTemplate() delegates to the Template Engine", async () => {
    const { engine } = await engineFixture();
    const resolver = buildResolver(engine);
    engine.templateEngine.register({
      id: "t-1",
      name: "Support Template",
      category: KnowledgeTemplateCategory.SUPPORT,
      defaultMetadata: {},
      createdAt: new Date().toISOString(),
    });
    expect(resolver.resolveTemplate("t-1").id).toBe("t-1");
  });
});

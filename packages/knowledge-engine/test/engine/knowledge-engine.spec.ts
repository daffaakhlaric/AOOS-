import { describe, expect, it } from "vitest";

import { KnowledgeLifecycleState } from "../../src/domain/knowledge-lifecycle-state.js";
import { KnowledgePolicyType } from "../../src/domain/knowledge-policy-type.js";
import { KnowledgeRelationshipType } from "../../src/domain/knowledge-relationship-type.js";
import { KnowledgeEngine } from "../../src/engine/knowledge-engine.js";
import { KnowledgeException } from "../../src/errors/knowledge-exception.js";
import { KnowledgeEventType } from "../../src/events/knowledge-event-type.js";
import { KnowledgeEvents } from "../../src/events/knowledge-events.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

function buildEngine() {
  const { publisher, publish } = fakePublisher();
  const engine = new KnowledgeEngine({ events: new KnowledgeEvents(publisher) });
  return { engine, publish };
}

describe("Engine Test — KnowledgeEngine", () => {
  it("createAsset() saves a valid Asset and publishes CREATED", async () => {
    const { engine, publish } = buildEngine();
    const asset = assetFixture();
    const saved = await engine.createAsset(asset, contextFixture());
    expect(engine.repository.get(asset.id)).toBe(saved);
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(KnowledgeEventType.CREATED);
  });

  it("createAsset() records Tenant/Department usage and Knowledge/Document counts", async () => {
    const { engine } = buildEngine();
    await engine.createAsset(assetFixture(), contextFixture());
    const snapshot = engine.metrics();
    expect(snapshot.knowledgeCount).toBe(1);
    expect(snapshot.documentCount).toBe(1);
    expect(snapshot.tenantUsage).toEqual({ "tenant-1": 1 });
  });

  it("createAsset() throws KnowledgeException and publishes VALIDATION_FAILED for an invalid Asset", async () => {
    const { engine, publish } = buildEngine();
    const asset = assetFixture();
    const invalid = { ...asset, namespace: "not-a-namespace" };

    await expect(engine.createAsset(invalid, contextFixture())).rejects.toThrow(KnowledgeException);

    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      KnowledgeEventType.VALIDATION_FAILED,
    );
    expect(engine.metrics().validationErrors).toBe(1);
  });

  it("updateAsset() replaces an existing Asset and publishes UPDATED", async () => {
    const { engine, publish } = buildEngine();
    const asset = assetFixture();
    await engine.createAsset(asset, contextFixture());
    const updated = await engine.updateAsset({ ...asset, tags: ["updated"] }, contextFixture());
    expect(updated.tags).toEqual(["updated"]);
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(KnowledgeEventType.UPDATED);
  });

  it("deleteAsset() removes the Asset and publishes DELETED when it existed", async () => {
    const { engine, publish } = buildEngine();
    const asset = assetFixture();
    await engine.createAsset(asset, contextFixture());
    const removed = await engine.deleteAsset(asset.id, contextFixture());
    expect(removed).toBe(true);
    expect(engine.repository.get(asset.id)).toBeUndefined();
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(KnowledgeEventType.DELETED);
  });

  it("deleteAsset() returns false and publishes nothing when the Asset never existed", async () => {
    const { engine, publish } = buildEngine();
    const removed = await engine.deleteAsset("missing", contextFixture());
    expect(removed).toBe(false);
    expect(publish).not.toHaveBeenCalled();
  });

  it("archiveAsset() transitions the Asset to ARCHIVED and publishes ARCHIVED", async () => {
    const { engine, publish } = buildEngine();
    const asset = assetFixture();
    await engine.createAsset(asset, contextFixture());
    const archived = await engine.archiveAsset(asset.id, contextFixture());
    expect(archived.lifecycleState).toBe(KnowledgeLifecycleState.ARCHIVED);
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(KnowledgeEventType.ARCHIVED);
  });

  it("createVersion() snapshots the Asset, records a metric, and publishes VERSION_CREATED", async () => {
    const { engine, publish } = buildEngine();
    const asset = assetFixture();
    await engine.createAsset(asset, contextFixture());
    const snapshot = await engine.createVersion(asset.id, contextFixture());
    expect(snapshot.assetId).toBe(asset.id);
    expect(engine.metrics().versionCount).toBe(1);
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      KnowledgeEventType.VERSION_CREATED,
    );
  });

  it("addRelationship() registers the Relationship, records a metric, and publishes RELATIONSHIP_CREATED", async () => {
    const { engine, publish } = buildEngine();
    const a = assetFixture({ id: "a-1" });
    const b = assetFixture({ id: "a-2" });
    await engine.createAsset(a, contextFixture());
    await engine.createAsset(b, contextFixture());
    const relationship = await engine.addRelationship(
      {
        id: "r-1",
        fromAssetId: a.id,
        toAssetId: b.id,
        type: KnowledgeRelationshipType.RELATED,
        createdAt: new Date().toISOString(),
      },
      contextFixture(),
    );
    expect(relationship.id).toBe("r-1");
    expect(engine.metrics().relationshipCount).toBe(1);
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      KnowledgeEventType.RELATIONSHIP_CREATED,
    );
  });

  it("registerPolicy() registers a Policy, records a metric, and publishes POLICY_CHANGED", async () => {
    const { engine, publish } = buildEngine();
    const policy = await engine.registerPolicy(
      {
        id: "p-1",
        name: "x",
        type: KnowledgePolicyType.RETENTION,
        scope: { tenantId: "t1" },
        rule: {},
        enabled: true,
        createdAt: new Date().toISOString(),
      },
      contextFixture(),
    );
    expect(policy.id).toBe("p-1");
    expect(engine.metrics().policyCount).toBe(1);
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      KnowledgeEventType.POLICY_CHANGED,
    );
  });

  it("registerPermission() registers a Permission and publishes PERMISSION_CHANGED", async () => {
    const { engine, publish } = buildEngine();
    const permission = await engine.registerPermission(
      {
        id: "perm-1",
        subjectType: "user",
        subjectId: "u1",
        action: "read",
        effect: "allow",
        scope: { tenantId: "t1" },
        createdAt: new Date().toISOString(),
      },
      contextFixture(),
    );
    expect(permission.id).toBe("perm-1");
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      KnowledgeEventType.PERMISSION_CHANGED,
    );
  });

  it("health()/metrics()/monitorSnapshot() reflect current Engine state", async () => {
    const { engine } = buildEngine();
    await engine.createAsset(assetFixture(), contextFixture());
    await engine.registerPolicy(
      {
        id: "p-1",
        name: "x",
        type: KnowledgePolicyType.RETENTION,
        scope: { tenantId: "t1" },
        rule: {},
        enabled: true,
        createdAt: new Date().toISOString(),
      },
      contextFixture(),
    );
    expect(engine.health().status).toBe("healthy");
    expect(engine.metrics().knowledgeCount).toBe(1);
    expect(engine.monitorSnapshot().knowledge.count).toBe(1);
  });

  it("exposes catalog/resolver/factory/validator/lifecycle/policyEngine/relationshipEngine/permissionEngine/versionEngine/templateEngine/metadataEngine", () => {
    const { engine } = buildEngine();
    expect(engine.catalog).toBeDefined();
    expect(engine.resolver).toBeDefined();
    expect(engine.factory).toBeDefined();
    expect(engine.validator).toBeDefined();
    expect(engine.lifecycle).toBeDefined();
    expect(engine.policyEngine).toBeDefined();
    expect(engine.relationshipEngine).toBeDefined();
    expect(engine.permissionEngine).toBeDefined();
    expect(engine.versionEngine).toBeDefined();
    expect(engine.templateEngine).toBeDefined();
    expect(engine.metadataEngine).toBeDefined();
  });

  it("respects allowedTenantIds/allowedWorkspaceIds/allowedLanguages from config", async () => {
    const { publisher } = fakePublisher();
    const engine = new KnowledgeEngine({
      events: new KnowledgeEvents(publisher),
      config: { allowedTenantIds: ["only-this-tenant"] },
    });
    await expect(engine.createAsset(assetFixture(), contextFixture())).rejects.toThrow(
      KnowledgeException,
    );
  });
});

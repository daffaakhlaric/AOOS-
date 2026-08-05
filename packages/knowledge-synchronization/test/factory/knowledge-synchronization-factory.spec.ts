import { describe, expect, it } from "vitest";

import { KnowledgeSynchronizationJobType } from "../../src/domain/knowledge-synchronization-job-type.js";
import { KnowledgeSynchronizationMode } from "../../src/domain/knowledge-synchronization-mode.js";
import { KnowledgeSynchronizationFactory } from "../../src/factory/knowledge-synchronization-factory.js";

describe("KnowledgeSynchronizationFactory", () => {
  it("composes all 5 sub-factories", () => {
    const factory = new KnowledgeSynchronizationFactory();
    expect(factory.job).toBeDefined();
    expect(factory.context).toBeDefined();
    expect(factory.session).toBeDefined();
    expect(factory.policy).toBeDefined();
    expect(factory.statistics).toBeDefined();
  });
});

describe("SynchronizationJobFactory", () => {
  it("generates an id and createdAt", () => {
    const factory = new KnowledgeSynchronizationFactory();
    const job = factory.job.create({
      type: KnowledgeSynchronizationJobType.MANUAL_SYNC,
      mode: KnowledgeSynchronizationMode.MANUAL,
      providerId: "provider-1",
      sourceId: "source-1",
      tenantId: "tenant-1",
    });
    expect(job.id.length).toBeGreaterThan(0);
    expect(job.createdAt.length).toBeGreaterThan(0);
  });

  it("preserves supplied optional fields", () => {
    const factory = new KnowledgeSynchronizationFactory();
    const job = factory.job.create({
      type: KnowledgeSynchronizationJobType.FULL_SYNC,
      mode: KnowledgeSynchronizationMode.FULL,
      providerId: "provider-1",
      sourceId: "source-1",
      tenantId: "tenant-1",
      workspaceId: "workspace-1",
      collection: "collection-1",
      namespace: "ns",
    });
    expect(job.workspaceId).toBe("workspace-1");
    expect(job.collection).toBe("collection-1");
    expect(job.namespace).toBe("ns");
  });
});

describe("SynchronizationContextFactory", () => {
  it("wraps createKnowledgeSynchronizationContext()", () => {
    const factory = new KnowledgeSynchronizationFactory();
    const context = factory.context.create({
      tenantId: "tenant-1",
      providerId: "provider-1",
      sourceId: "source-1",
      sourceType: "document" as never,
    });
    expect(context.tenantId).toBe("tenant-1");
    expect(context.token.length).toBeGreaterThan(0);
  });
});

describe("SynchronizationSessionFactory", () => {
  it("produces an unregistered OPEN session record", () => {
    const factory = new KnowledgeSynchronizationFactory();
    const record = factory.session.create("stok_1", "holder-1");
    expect(record.state).toBe("open");
    expect(record.token).toBe("stok_1");
  });
});

describe("SynchronizationPolicyFactory", () => {
  it("defaults enabled to true", () => {
    const factory = new KnowledgeSynchronizationFactory();
    const policy = factory.policy.create({ name: "Policy 1", tenantId: "tenant-1" });
    expect(policy.enabled).toBe(true);
    expect(policy.id.length).toBeGreaterThan(0);
  });

  it("preserves supplied allowedModes/deniedModes/enabled", () => {
    const factory = new KnowledgeSynchronizationFactory();
    const policy = factory.policy.create({
      name: "Policy 1",
      tenantId: "tenant-1",
      workspaceId: "workspace-1",
      enabled: false,
      allowedModes: [KnowledgeSynchronizationMode.MANUAL],
      deniedModes: [KnowledgeSynchronizationMode.STREAMING],
    });
    expect(policy.enabled).toBe(false);
    expect(policy.allowedModes).toEqual([KnowledgeSynchronizationMode.MANUAL]);
    expect(policy.deniedModes).toEqual([KnowledgeSynchronizationMode.STREAMING]);
  });
});

describe("SynchronizationStatisticsFactory", () => {
  it("returns an empty statistics snapshot", () => {
    const factory = new KnowledgeSynchronizationFactory();
    expect(factory.statistics.create()).toEqual({ syncCount: 0, changeCount: 0 });
  });
});

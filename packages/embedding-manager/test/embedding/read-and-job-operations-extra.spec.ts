import { describe, expect, it } from "vitest";

import { createDraftEmbedding, managerFixture } from "../helpers/manager-fixture.js";

describe("EmbeddingManager — extra Read Operations", () => {
  it("list() returns an empty result before any Embedding is created", () => {
    const { manager } = managerFixture();
    expect(manager.list().embeddings).toEqual([]);
  });

  it("count() is 0 before any Embedding is created", () => {
    const { manager } = managerFixture();
    expect(manager.count()).toBe(0);
  });

  it("get()/require() return consistent data for the same token", async () => {
    const { manager } = managerFixture();
    const token = await createDraftEmbedding(manager);
    expect(manager.get(token)?.embeddingId).toBe(manager.require(token).embeddingId);
  });

  it("list() reflects every created Embedding, not just the most recent", async () => {
    const { manager } = managerFixture();
    await createDraftEmbedding(manager);
    await createDraftEmbedding(manager);
    await createDraftEmbedding(manager);
    expect(manager.list().embeddings).toHaveLength(3);
  });
});

describe("EmbeddingManager — extra Job Operations", () => {
  it("createJob() honors an explicit priority", () => {
    const { manager } = managerFixture();
    const { job } = manager.createJob({ embeddingId: "e-1", tenantId: "tenant-1", priority: 9 });
    expect(job.priority).toBe(9);
  });

  it("createJob() honors an explicit scheduledAt", () => {
    const { manager } = managerFixture();
    const { job } = manager.createJob({
      embeddingId: "e-1",
      tenantId: "tenant-1",
      scheduledAt: "2026-02-01T00:00:00.000Z",
    });
    expect(job.scheduledAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("completeJob() throws for an unregistered jobId", () => {
    const { manager } = managerFixture();
    expect(() => manager.completeJob({ jobId: "missing" })).toThrow();
  });

  it("failJob() throws for an unregistered jobId", () => {
    const { manager } = managerFixture();
    expect(() => manager.failJob({ jobId: "missing", reason: "x" })).toThrow();
  });

  it("multiple Jobs for the same Embedding are tracked independently", () => {
    const { manager } = managerFixture();
    const { job: jobA } = manager.createJob({ embeddingId: "e-1", tenantId: "tenant-1" });
    const { job: jobB } = manager.createJob({ embeddingId: "e-1", tenantId: "tenant-1" });
    expect(jobA.jobId).not.toBe(jobB.jobId);
  });
});

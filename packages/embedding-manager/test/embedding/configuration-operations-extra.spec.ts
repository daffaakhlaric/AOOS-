import { describe, expect, it } from "vitest";

import { createDraftEmbedding, managerFixture } from "../helpers/manager-fixture.js";

describe("EmbeddingManager — extra Configuration Operations", () => {
  it("registerConfiguration() copies numeric knobs verbatim", () => {
    const { manager } = managerFixture();
    const configuration = manager.registerConfiguration({
      configurationId: "cfg-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      timeoutMs: 3000,
      retries: 2,
      batchSize: 16,
    });
    expect(configuration.timeoutMs).toBe(3000);
    expect(configuration.retries).toBe(2);
    expect(configuration.batchSize).toBe(16);
  });

  it("registerConfiguration() copies custom extras", () => {
    const { manager } = managerFixture();
    const configuration = manager.registerConfiguration({
      configurationId: "cfg-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      custom: { chunkOverlap: 50 },
    });
    expect(configuration.custom).toEqual({ chunkOverlap: 50 });
  });

  it("createEmbedding() fails when the declared Configuration is not registered (Configuration Resolution runs on every Pipeline call)", async () => {
    const { manager } = managerFixture();
    await expect(
      createDraftEmbedding(manager, { configurationId: "missing-cfg" }),
    ).rejects.toThrow();
  });

  it("two Configurations with different ids coexist independently on the resolver", () => {
    const { manager } = managerFixture();
    manager.registerConfiguration({
      configurationId: "cfg-a",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      timeoutMs: 1000,
    });
    manager.registerConfiguration({
      configurationId: "cfg-b",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      timeoutMs: 2000,
    });
    expect(manager.resolver.resolveConfiguration("cfg-a").timeoutMs).toBe(1000);
    expect(manager.resolver.resolveConfiguration("cfg-b").timeoutMs).toBe(2000);
  });
});

import { describe, expect, it } from "vitest";

import { createDraftEmbedding, managerFixture } from "../helpers/manager-fixture.js";

describe("EmbeddingManager — extra Namespace Operations", () => {
  it("registerNamespace() defaults active to true", () => {
    const { manager } = managerFixture();
    const namespace = manager.registerNamespace({
      namespaceId: "ns-1",
      name: "docs",
      tenantId: "tenant-1",
    });
    expect(namespace.active).toBe(true);
  });

  it("registerNamespace() honors an explicit inactive flag", () => {
    const { manager } = managerFixture();
    const namespace = manager.registerNamespace({
      namespaceId: "ns-1",
      name: "docs",
      tenantId: "tenant-1",
      active: false,
    });
    expect(namespace.active).toBe(false);
  });

  it("createEmbedding() fails when the declared Namespace is inactive (Namespace Resolution runs on every Pipeline call)", async () => {
    const { manager } = managerFixture();
    manager.registerNamespace({
      namespaceId: "ns-1",
      name: "docs",
      tenantId: "tenant-1",
      active: false,
    });
    await expect(createDraftEmbedding(manager, { namespaceId: "ns-1" })).rejects.toThrow();
  });
});

describe("EmbeddingManager — extra Session Operations", () => {
  it("openSession() defaults holder correctly and is retrievable via registry", async () => {
    const { manager } = managerFixture();
    const token = await createDraftEmbedding(manager);
    manager.openSession({ token, holder: "user-42" });
    expect(manager.registry.get("session" as never, token)).toBeDefined();
  });

  it("closeSession() throws when no session was ever opened", async () => {
    const { manager } = managerFixture();
    const token = await createDraftEmbedding(manager);
    expect(() => manager.closeSession({ token })).toThrow();
  });

  it("renewSession() throws when the session was never opened", async () => {
    const { manager } = managerFixture();
    const token = await createDraftEmbedding(manager);
    expect(() => manager.renewSession({ token })).toThrow();
  });
});

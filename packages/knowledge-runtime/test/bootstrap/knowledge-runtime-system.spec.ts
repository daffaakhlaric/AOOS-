import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeSystem } from "../../src/bootstrap/knowledge-runtime-system.js";
import { engineFixture } from "../helpers/engine-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("Bootstrap Test — KnowledgeRuntimeSystem", () => {
  it("exposes name/version and wraps a working KnowledgeRuntime", async () => {
    const { engine, asset } = await engineFixture();
    const { publisher } = fakePublisher();
    const system = new KnowledgeRuntimeSystem(publisher, engine);

    expect(system.name).toBe("KnowledgeRuntimeSystemModule");
    expect(system.version).toBe("0.1.0");

    const execution = await system.runtime.createInstance({
      knowledgeId: asset.id,
      tenantId: "tenant-1",
    });
    expect(system.runtime.getInstance(execution.instance.token)).toBe(execution);
  });

  it("accepts an optional KnowledgeRuntimeConfig", async () => {
    const { engine } = await engineFixture();
    const { publisher } = fakePublisher();
    const system = new KnowledgeRuntimeSystem(publisher, engine, {
      allowedTenantIds: ["tenant-1"],
    });
    expect(system.runtime).toBeDefined();
  });

  it("onBootstrap()/onShutdown() resolve without error", async () => {
    const { engine } = await engineFixture();
    const { publisher } = fakePublisher();
    const system = new KnowledgeRuntimeSystem(publisher, engine);
    await expect(system.onBootstrap()).resolves.toBeUndefined();
    await expect(system.onShutdown()).resolves.toBeUndefined();
  });
});

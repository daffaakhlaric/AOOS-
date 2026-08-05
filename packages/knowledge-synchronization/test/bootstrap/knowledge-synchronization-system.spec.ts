import { describe, expect, it } from "vitest";

import { KnowledgeSynchronizationSystem } from "../../src/bootstrap/knowledge-synchronization-system.js";
import { engineFixture } from "../helpers/engine-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("KnowledgeSynchronizationSystem", () => {
  it("wraps a KnowledgeSynchronization as an IModule", async () => {
    const { engine, indexing, retrieval } = await engineFixture();
    const { publisher } = fakePublisher();
    const system = new KnowledgeSynchronizationSystem(publisher, engine, indexing, retrieval);
    expect(system.name).toBe("KnowledgeSynchronizationSystemModule");
    expect(system.synchronization).toBeDefined();
  });

  it("onBootstrap()/onShutdown() resolve without error", async () => {
    const { engine, indexing, retrieval } = await engineFixture();
    const { publisher } = fakePublisher();
    const system = new KnowledgeSynchronizationSystem(publisher, engine, indexing, retrieval);
    await expect(system.onBootstrap()).resolves.toBeUndefined();
    await expect(system.onShutdown()).resolves.toBeUndefined();
  });
});

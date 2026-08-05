import { describe, expect, it } from "vitest";

import { KnowledgeRetrievalSystem } from "../../src/bootstrap/knowledge-retrieval-system.js";
import { engineFixture } from "../helpers/engine-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("KnowledgeRetrievalSystem", () => {
  it("wraps a KnowledgeRetrieval as an IModule", async () => {
    const { engine, indexing } = await engineFixture();
    const { publisher } = fakePublisher();
    const system = new KnowledgeRetrievalSystem(publisher, engine, indexing);
    expect(system.name).toBe("KnowledgeRetrievalSystemModule");
    expect(system.retrieval).toBeDefined();
  });

  it("onBootstrap()/onShutdown() resolve without error", async () => {
    const { engine, indexing } = await engineFixture();
    const { publisher } = fakePublisher();
    const system = new KnowledgeRetrievalSystem(publisher, engine, indexing);
    await expect(system.onBootstrap()).resolves.toBeUndefined();
    await expect(system.onShutdown()).resolves.toBeUndefined();
  });
});

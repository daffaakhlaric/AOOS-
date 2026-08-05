import { describe, expect, it } from "vitest";

import { KnowledgeProviderSystem } from "../../src/bootstrap/knowledge-provider-system.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("KnowledgeProviderSystem", () => {
  it("wraps a KnowledgeProvider as an IModule", () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeProviderSystem(publisher);
    expect(system.name).toBe("KnowledgeProviderSystemModule");
    expect(system.provider).toBeDefined();
  });

  it("onBootstrap()/onShutdown() resolve without error", async () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeProviderSystem(publisher);
    await expect(system.onBootstrap()).resolves.toBeUndefined();
    await expect(system.onShutdown()).resolves.toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

import { KnowledgeSourceManagerSystem } from "../../src/bootstrap/knowledge-source-manager-system.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("KnowledgeSourceManagerSystem", () => {
  it("implements IModule with a name and version", () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeSourceManagerSystem(publisher);
    expect(system.name).toBe("KnowledgeSourceManagerSystemModule");
    expect(system.version).toBe("0.1.0");
  });

  it("constructs a ready-to-use KnowledgeSourceManager", () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeSourceManagerSystem(publisher);
    expect(system.manager).toBeDefined();
  });

  it("onBootstrap/onShutdown resolve without throwing", async () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeSourceManagerSystem(publisher);
    await expect(system.onBootstrap()).resolves.toBeUndefined();
    await expect(system.onShutdown()).resolves.toBeUndefined();
  });

  it("passes through an optional config", () => {
    const { publisher } = fakePublisher();
    const resolveProvider = async (): Promise<unknown> => ({});
    const system = new KnowledgeSourceManagerSystem(publisher, {
      providerResolver: { resolveProvider },
    });
    expect(system.manager).toBeDefined();
  });
});

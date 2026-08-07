import { describe, expect, it } from "vitest";

import { KnowledgeVersionSystem } from "../../src/bootstrap/knowledge-version-system.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("KnowledgeVersionSystem", () => {
  it("implements IModule with a name/version and a constructed versioning facade", async () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeVersionSystem(publisher);
    expect(system.name).toBe("KnowledgeVersionSystemModule");
    expect(system.version).toBe("0.1.0");
    expect(system.versioning).toBeTruthy();
    await expect(system.onBootstrap()).resolves.toBeUndefined();
    await expect(system.onShutdown()).resolves.toBeUndefined();
  });

  it("accepts an optional config", () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeVersionSystem(publisher, {});
    expect(system.versioning).toBeTruthy();
  });
});

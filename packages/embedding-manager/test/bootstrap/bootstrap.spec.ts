import { describe, expect, it } from "vitest";

import { EmbeddingManagerSystem } from "../../src/bootstrap/embedding-manager-system.js";
import { fakePublisher } from "../helpers/event-publisher-fixture.js";

describe("EmbeddingManagerSystem", () => {
  it("exposes the documented name and version", () => {
    const { publisher } = fakePublisher();
    const system = new EmbeddingManagerSystem(publisher);
    expect(system.name).toBe("@aos/embedding-manager");
    expect(system.version).toBe("0.1.0");
  });

  it("wires an EmbeddingManager instance", () => {
    const { publisher } = fakePublisher();
    const system = new EmbeddingManagerSystem(publisher);
    expect(system.manager).toBeDefined();
    expect(system.manager.count()).toBe(0);
  });

  it("start() resolves (no-op)", async () => {
    const { publisher } = fakePublisher();
    const system = new EmbeddingManagerSystem(publisher);
    await expect(system.start()).resolves.toBeUndefined();
  });

  it("stop() resolves (no-op)", async () => {
    const { publisher } = fakePublisher();
    const system = new EmbeddingManagerSystem(publisher);
    await expect(system.stop()).resolves.toBeUndefined();
  });

  it("accepts an EmbeddingManagerConfig", () => {
    const { publisher } = fakePublisher();
    const system = new EmbeddingManagerSystem(publisher, {});
    expect(system.manager.hasProvider()).toBe(false);
  });
});

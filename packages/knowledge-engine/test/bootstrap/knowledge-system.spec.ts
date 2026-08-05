import { describe, expect, it } from "vitest";

import { KnowledgeSystem } from "../../src/bootstrap/knowledge-system.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("Bootstrap Test — KnowledgeSystem", () => {
  it("exposes name/version and wraps a working KnowledgeEngine", async () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeSystem(publisher);

    expect(system.name).toBe("KnowledgeSystemModule");
    expect(system.version).toBe("0.1.0");

    const asset = assetFixture();
    const saved = await system.engine.createAsset(asset, contextFixture());
    expect(saved.id).toBe(asset.id);
    expect(system.engine.repository.get(asset.id)).toBe(saved);
  });

  it("accepts an optional KnowledgeEngineConfig", () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeSystem(publisher, { allowedLanguages: ["en"] });
    expect(system.engine).toBeDefined();
  });

  it("onBootstrap()/onShutdown() resolve without error", async () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeSystem(publisher);
    await expect(system.onBootstrap()).resolves.toBeUndefined();
    await expect(system.onShutdown()).resolves.toBeUndefined();
  });
});

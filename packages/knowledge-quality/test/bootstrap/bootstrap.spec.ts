import { describe, expect, it } from "vitest";

import { KnowledgeQualitySystem } from "../../src/bootstrap/knowledge-quality-system.js";
import { KnowledgeQuality } from "../../src/quality/knowledge-quality.js";
import { fakePublisher } from "../helpers/event-publisher-fixture.js";

describe("KnowledgeQualitySystem", () => {
  it("wires a working KnowledgeQuality façade", () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeQualitySystem(publisher);
    expect(system.quality).toBeInstanceOf(KnowledgeQuality);
  });

  it("exposes name and version", () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeQualitySystem(publisher);
    expect(system.name).toBe("@aos/knowledge-quality");
    expect(system.version).toBeDefined();
  });

  it("start() resolves (no-op)", async () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeQualitySystem(publisher);
    await expect(system.start()).resolves.toBeUndefined();
  });

  it("stop() resolves (no-op)", async () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeQualitySystem(publisher);
    await expect(system.stop()).resolves.toBeUndefined();
  });

  it("passes config through to the wired KnowledgeQuality", () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeQualitySystem(publisher, {});
    expect(system.quality.count()).toBe(0);
  });
});

import { describe, expect, it } from "vitest";

import { KnowledgeGeneratorSystem } from "../../src/bootstrap/knowledge-generator-system.js";
import { KnowledgeGenerator } from "../../src/generator/knowledge-generator.js";
import { fakePublisher } from "../helpers/event-publisher-fixture.js";

describe("KnowledgeGeneratorSystem", () => {
  it("wires a working KnowledgeGenerator façade", () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeGeneratorSystem(publisher);
    expect(system.generator).toBeInstanceOf(KnowledgeGenerator);
  });

  it("exposes name and version", () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeGeneratorSystem(publisher);
    expect(system.name).toBe("@aos/knowledge-generator");
    expect(system.version).toBeDefined();
  });

  it("start() resolves (no-op)", async () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeGeneratorSystem(publisher);
    await expect(system.start()).resolves.toBeUndefined();
  });

  it("stop() resolves (no-op)", async () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeGeneratorSystem(publisher);
    await expect(system.stop()).resolves.toBeUndefined();
  });

  it("passes config through to the wired KnowledgeGenerator", () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeGeneratorSystem(publisher, {});
    expect(system.generator.count()).toBe(0);
  });
});

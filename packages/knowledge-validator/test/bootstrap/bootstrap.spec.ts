import { describe, expect, it } from "vitest";

import { KnowledgeValidatorSystem } from "../../src/bootstrap/knowledge-validator-system.js";
import { fakePublisher } from "../helpers/event-publisher-fixture.js";

describe("KnowledgeValidatorSystem", () => {
  it("exposes the package name", () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeValidatorSystem(publisher);
    expect(system.name).toBe("@aos/knowledge-validator");
  });

  it("exposes a version", () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeValidatorSystem(publisher);
    expect(system.version).toBe("0.1.0");
  });

  it("constructs a KnowledgeValidator facade instance", () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeValidatorSystem(publisher);
    expect(system.validator).toBeDefined();
  });

  it("start resolves without error (no-op)", async () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeValidatorSystem(publisher);
    await expect(system.start()).resolves.toBeUndefined();
  });

  it("stop resolves without error (no-op)", async () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeValidatorSystem(publisher);
    await expect(system.stop()).resolves.toBeUndefined();
  });

  it("accepts an optional config", () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgeValidatorSystem(publisher, {});
    expect(system.validator.hasProvider()).toBe(false);
  });
});

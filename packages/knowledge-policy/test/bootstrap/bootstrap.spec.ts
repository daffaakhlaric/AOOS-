import { describe, expect, it } from "vitest";

import { KnowledgePolicySystem } from "../../src/bootstrap/knowledge-policy-system.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("KnowledgePolicySystem", () => {
  it("exposes name, version, and a policy facade", () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgePolicySystem(publisher);
    expect(system.name).toBe("@aos/knowledge-policy");
    expect(system.version).toBeTruthy();
    expect(system.policy).toBeTruthy();
  });

  it("start() resolves without error", async () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgePolicySystem(publisher);
    await expect(system.start()).resolves.toBeUndefined();
  });

  it("stop() resolves without error", async () => {
    const { publisher } = fakePublisher();
    const system = new KnowledgePolicySystem(publisher);
    await expect(system.stop()).resolves.toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

import { KnowledgeMarketplaceSystem } from "../../src/bootstrap/knowledge-marketplace-system.js";
import { KnowledgeMarketplace } from "../../src/marketplace/knowledge-marketplace.js";
import { fakePublisher } from "../helpers/event-publisher-fixture.js";

describe("KnowledgeMarketplaceSystem", () => {
  it("carries the package name and version", () => {
    const system = new KnowledgeMarketplaceSystem(fakePublisher().publisher);
    expect(system.name).toBe("@aos/knowledge-marketplace");
    expect(system.version).toBe("0.1.0");
  });

  it("wires up a KnowledgeMarketplace facade", () => {
    const system = new KnowledgeMarketplaceSystem(fakePublisher().publisher);
    expect(system.marketplace).toBeInstanceOf(KnowledgeMarketplace);
  });

  it("start resolves without error", async () => {
    const system = new KnowledgeMarketplaceSystem(fakePublisher().publisher);
    await expect(system.start()).resolves.toBeUndefined();
  });

  it("stop resolves without error", async () => {
    const system = new KnowledgeMarketplaceSystem(fakePublisher().publisher);
    await expect(system.stop()).resolves.toBeUndefined();
  });
});

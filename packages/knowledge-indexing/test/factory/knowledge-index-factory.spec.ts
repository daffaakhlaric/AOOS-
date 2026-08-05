import { describe, expect, it } from "vitest";

import { KnowledgeIndexType } from "../../src/domain/knowledge-index-type.js";
import { KnowledgeIndexFactory } from "../../src/factory/knowledge-index-factory.js";
import { assetFixture } from "../helpers/asset-fixture.js";

describe("Factory Test — KnowledgeIndexFactory", () => {
  it("createContext() wraps createKnowledgeIndexContext()", () => {
    const factory = new KnowledgeIndexFactory();
    const context = factory.createContext({ assetId: "a-1", tenantId: "tenant-1" });
    expect(context.assetId).toBe("a-1");
  });

  it("createEntries() builds entries across every requested KnowledgeIndexType", () => {
    const factory = new KnowledgeIndexFactory();
    const asset = assetFixture({ tags: ["a", "b"] });
    const context = factory.createContext({ assetId: asset.id, tenantId: "tenant-1" });
    const entries = factory.createEntries(
      asset,
      [KnowledgeIndexType.KEYWORD, KnowledgeIndexType.TAG],
      context,
    );
    expect(entries).toHaveLength(3);
  });
});

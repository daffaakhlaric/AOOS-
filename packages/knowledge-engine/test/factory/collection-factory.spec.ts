import { describe, expect, it } from "vitest";

import { CollectionFactory } from "../../src/factory/collection-factory.js";

describe("Factory Test — CollectionFactory", () => {
  it("creates a Collection with an empty assetIds array by default", () => {
    const collection = new CollectionFactory().create({
      name: "Playbooks",
      scope: { tenantId: "t1" },
    });
    expect(collection.assetIds).toEqual([]);
    expect(collection.id).toEqual(expect.any(String));
  });

  it("accepts initial assetIds", () => {
    const collection = new CollectionFactory().create({
      name: "Playbooks",
      scope: { tenantId: "t1" },
      assetIds: ["a-1", "a-2"],
    });
    expect(collection.assetIds).toEqual(["a-1", "a-2"]);
  });
});

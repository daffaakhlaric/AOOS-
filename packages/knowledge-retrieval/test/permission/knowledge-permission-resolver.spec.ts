import { describe, expect, it } from "vitest";

import { KnowledgePermissionResolver } from "../../src/permission/knowledge-permission-resolver.js";
import { assetFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { resultFixture } from "../helpers/result-fixture.js";

describe("KnowledgePermissionResolver", () => {
  it("passes every Result through when no checker is configured", async () => {
    const resolver = new KnowledgePermissionResolver();
    const asset = assetFixture();
    const results = [resultFixture(asset), resultFixture(asset)];
    const { allowed, rejectedCount } = await resolver.resolve(results, contextFixture());
    expect(allowed).toHaveLength(2);
    expect(rejectedCount).toBe(0);
  });

  it("filters out Results the checker rejects", async () => {
    const assetAllowed = assetFixture({ id: "allowed" });
    const assetRejected = assetFixture({ id: "rejected" });
    const resolver = new KnowledgePermissionResolver({
      check: (result) => result.assetId === "allowed",
    });
    const results = [resultFixture(assetAllowed), resultFixture(assetRejected)];
    const { allowed, rejectedCount } = await resolver.resolve(results, contextFixture());
    expect(allowed).toHaveLength(1);
    expect(allowed[0]?.assetId).toBe("allowed");
    expect(rejectedCount).toBe(1);
  });

  it("supports an async checker", async () => {
    const asset = assetFixture();
    const resolver = new KnowledgePermissionResolver({
      check: async () => Promise.resolve(true),
    });
    const { allowed } = await resolver.resolve([resultFixture(asset)], contextFixture());
    expect(allowed).toHaveLength(1);
  });

  it("returns an empty allowed list when every Result is rejected", async () => {
    const asset = assetFixture();
    const resolver = new KnowledgePermissionResolver({ check: () => false });
    const { allowed, rejectedCount } = await resolver.resolve(
      [resultFixture(asset)],
      contextFixture(),
    );
    expect(allowed).toEqual([]);
    expect(rejectedCount).toBe(1);
  });
});

import { describe, expect, it } from "vitest";

import { AssetNotFoundException } from "../../src/errors/asset-not-found-exception.js";
import { DuplicateAssetException } from "../../src/errors/duplicate-asset-exception.js";
import { KnowledgeRepository } from "../../src/repository/knowledge-repository.js";
import { assetFixture } from "../helpers/asset-fixture.js";

describe("Repository Test — KnowledgeRepository", () => {
  it("save() then get() returns the saved Asset", () => {
    const repository = new KnowledgeRepository();
    const asset = assetFixture();
    repository.save(asset);
    expect(repository.get(asset.id)).toBe(asset);
  });

  it("save() throws DuplicateAssetException for a duplicate id", () => {
    const repository = new KnowledgeRepository();
    const asset = assetFixture({ id: "dup-1" });
    repository.save(asset);
    expect(() => repository.save(assetFixture({ id: "dup-1" }))).toThrow(DuplicateAssetException);
  });

  it("require() throws AssetNotFoundException when nothing is saved", () => {
    const repository = new KnowledgeRepository();
    expect(() => repository.require("missing")).toThrow(AssetNotFoundException);
  });

  it("update() replaces an existing Asset", () => {
    const repository = new KnowledgeRepository();
    const asset = assetFixture();
    repository.save(asset);
    const updated = { ...asset, tags: ["updated"] };
    repository.update(updated);
    expect(repository.get(asset.id)?.tags).toEqual(["updated"]);
  });

  it("update() throws AssetNotFoundException when the Asset was never saved", () => {
    const repository = new KnowledgeRepository();
    expect(() => repository.update(assetFixture())).toThrow(AssetNotFoundException);
  });

  it("getByNamespace() resolves an Asset by its namespace URI", () => {
    const repository = new KnowledgeRepository();
    const asset = assetFixture();
    repository.save(asset);
    expect(repository.getByNamespace(asset.namespace)).toBe(asset);
  });

  it("getByNamespace() returns undefined for an unknown namespace", () => {
    const repository = new KnowledgeRepository();
    expect(repository.getByNamespace("knowledge://t1/w1/l1/ghost")).toBeUndefined();
  });

  it("remove() deletes the Asset (and its namespace index) and returns true", () => {
    const repository = new KnowledgeRepository();
    const asset = assetFixture();
    repository.save(asset);
    expect(repository.remove(asset.id)).toBe(true);
    expect(repository.get(asset.id)).toBeUndefined();
    expect(repository.getByNamespace(asset.namespace)).toBeUndefined();
  });

  it("remove() returns false when nothing matches", () => {
    const repository = new KnowledgeRepository();
    expect(repository.remove("missing")).toBe(false);
  });

  it("list()/count() reflect every saved Asset", () => {
    const repository = new KnowledgeRepository();
    repository.save(assetFixture({ id: "a-1" }));
    repository.save(assetFixture({ id: "a-2" }));
    expect(repository.list()).toHaveLength(2);
    expect(repository.count()).toBe(2);
  });
});

import { AssetNotFoundException, InvalidNamespaceException } from "@aos/knowledge-engine";
import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeResolver } from "../../src/resolver/knowledge-runtime-resolver.js";
import { engineFixture } from "../helpers/engine-fixture.js";

function buildResolver(engine: Awaited<ReturnType<typeof engineFixture>>["engine"]) {
  return new KnowledgeRuntimeResolver(
    engine.repository,
    engine.relationshipEngine,
    engine.policyEngine,
    engine.permissionEngine,
    engine.versionEngine,
    engine.templateEngine,
  );
}

describe("Resolver Test — edge cases", () => {
  it("resolveAsset() throws AssetNotFoundException for an unknown id", async () => {
    const { engine } = await engineFixture();
    const resolver = buildResolver(engine);
    expect(() => resolver.resolveAsset("missing")).toThrow(AssetNotFoundException);
  });

  it("resolveNamespace() throws InvalidNamespaceException for a malformed URI", async () => {
    const { engine } = await engineFixture();
    const resolver = buildResolver(engine);
    expect(() => resolver.resolveNamespace("not-a-namespace")).toThrow(InvalidNamespaceException);
  });

  it("resolveRelationships() returns an empty array for an Asset with no Relationships", async () => {
    const { engine, asset } = await engineFixture();
    const resolver = buildResolver(engine);
    expect(resolver.resolveRelationships(asset.id)).toEqual([]);
  });

  it("resolveVersionHistory() returns an empty array before any Snapshot is taken", async () => {
    const { engine, asset } = await engineFixture();
    const resolver = buildResolver(engine);
    expect(resolver.resolveVersionHistory(asset.id)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import { createKnowledgeVersion } from "../../src/domain/knowledge-version.js";
import { VersionConflictException } from "../../src/errors/version-conflict-exception.js";
import { KnowledgeRegistryBucket } from "../../src/registry/knowledge-registry-bucket.js";
import { KnowledgeRegistry } from "../../src/registry/knowledge-registry.js";
import { KnowledgeVersionEngine } from "../../src/version/knowledge-version-engine.js";
import { assetFixture } from "../helpers/asset-fixture.js";

describe("Version Test — KnowledgeVersionEngine", () => {
  it("bumpMajor()/bumpMinor()/bumpPatch() increment the correct component and reset lower ones", () => {
    const engine = new KnowledgeVersionEngine(new KnowledgeRegistry());
    const base = createKnowledgeVersion({ major: 1, minor: 2, patch: 3 });
    expect(engine.bumpMajor(base)).toMatchObject({ major: 2, minor: 0, patch: 0 });
    expect(engine.bumpMinor(base)).toMatchObject({ major: 1, minor: 3, patch: 0 });
    expect(engine.bumpPatch(base)).toMatchObject({ major: 1, minor: 2, patch: 4 });
  });

  it("compare() orders by major, then minor, then patch", () => {
    const engine = new KnowledgeVersionEngine(new KnowledgeRegistry());
    expect(
      engine.compare(createKnowledgeVersion({ major: 1 }), createKnowledgeVersion({ major: 2 })),
    ).toBe(-1);
    expect(
      engine.compare(createKnowledgeVersion({ major: 2 }), createKnowledgeVersion({ major: 1 })),
    ).toBe(1);
    expect(
      engine.compare(createKnowledgeVersion({ minor: 1 }), createKnowledgeVersion({ minor: 2 })),
    ).toBe(-1);
    expect(
      engine.compare(createKnowledgeVersion({ patch: 1 }), createKnowledgeVersion({ patch: 2 })),
    ).toBe(-1);
    expect(engine.compare(createKnowledgeVersion(), createKnowledgeVersion())).toBe(0);
  });

  it("snapshot() records a Snapshot into History and the Registry", () => {
    const registry = new KnowledgeRegistry();
    const engine = new KnowledgeVersionEngine(registry);
    const asset = assetFixture();
    const snap = engine.snapshot(asset);
    expect(engine.history(asset.id)).toEqual([snap]);
    expect(registry.count(KnowledgeRegistryBucket.VERSION)).toBe(1);
  });

  it("history() returns an empty array for an Asset with no Snapshots", () => {
    const engine = new KnowledgeVersionEngine(new KnowledgeRegistry());
    expect(engine.history("missing")).toEqual([]);
  });

  it("rollback() returns the matching Snapshot", () => {
    const engine = new KnowledgeVersionEngine(new KnowledgeRegistry());
    const asset = assetFixture();
    const snap = engine.snapshot(asset);
    expect(engine.rollback(asset.id, snap.version.label)).toBe(snap);
  });

  it("rollback() throws VersionConflictException for an unknown version label", () => {
    const engine = new KnowledgeVersionEngine(new KnowledgeRegistry());
    const asset = assetFixture();
    engine.snapshot(asset);
    expect(() => engine.rollback(asset.id, "9.9.9")).toThrow(VersionConflictException);
  });

  it("diff() reports only the fields that differ between two Snapshots", () => {
    const engine = new KnowledgeVersionEngine(new KnowledgeRegistry());
    const a = assetFixture({ id: "a-1" });
    const b = { ...a, tags: ["changed"] };
    const snapA = engine.snapshot(a);
    const snapB = engine.snapshot(b);
    const diff = engine.diff(snapA, snapB);
    expect(diff["tags"]).toEqual({ before: a.tags, after: b.tags });
  });

  it("diff() returns an empty object for two identical Snapshots", () => {
    const engine = new KnowledgeVersionEngine(new KnowledgeRegistry());
    const asset = assetFixture();
    const snap = engine.snapshot(asset);
    expect(engine.diff(snap, snap)).toEqual({});
  });
});

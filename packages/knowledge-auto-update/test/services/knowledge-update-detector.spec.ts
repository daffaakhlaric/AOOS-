import { describe, expect, it } from "vitest";

import { KnowledgeUpdateDetector } from "../../src/services/knowledge-update-detector.js";

describe("KnowledgeUpdateDetector", () => {
  const detector = new KnowledgeUpdateDetector();

  it("detects no change when snapshots are identical", () => {
    const snap = { version: "1.0.0", checksum: "abc", lastModifiedAt: 100 };
    const result = detector.detect(snap, { ...snap });
    expect(result.changed).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it("detects a version change", () => {
    const result = detector.detect({ version: "1.0.0" }, { version: "1.0.1" });
    expect(result.changed).toBe(true);
    expect(result.reasons).toContain("version_changed");
  });

  it("detects a version added when previous had none", () => {
    const result = detector.detect({}, { version: "1.0.0" });
    expect(result.reasons).toContain("version_added");
  });

  it("detects a checksum change", () => {
    const result = detector.detect({ checksum: "a" }, { checksum: "b" });
    expect(result.reasons).toContain("checksum_changed");
  });

  it("detects a checksum added", () => {
    const result = detector.detect({}, { checksum: "b" });
    expect(result.reasons).toContain("checksum_added");
  });

  it("detects last-modified advancing forward", () => {
    const result = detector.detect({ lastModifiedAt: 100 }, { lastModifiedAt: 200 });
    expect(result.reasons).toContain("last_modified_advanced");
  });

  it("does not flag last-modified moving backward", () => {
    const result = detector.detect({ lastModifiedAt: 200 }, { lastModifiedAt: 100 });
    expect(result.reasons).not.toContain("last_modified_advanced");
  });

  it("detects extra metadata changes", () => {
    const result = detector.detect({ extra: { tag: "a" } }, { extra: { tag: "b" } });
    expect(result.reasons).toContain("extra_metadata_changed");
  });

  it("detects extra metadata key count changes", () => {
    const result = detector.detect({ extra: { a: 1 } }, { extra: { a: 1, b: 2 } });
    expect(result.reasons).toContain("extra_metadata_changed");
  });

  it("treats undefined extra on both sides as unchanged", () => {
    const result = detector.detect({}, {});
    expect(result.reasons).not.toContain("extra_metadata_changed");
  });

  it("treats extra appearing where it was previously absent as changed", () => {
    const result = detector.detect({}, { extra: { a: 1 } });
    expect(result.reasons).toContain("extra_metadata_changed");
  });

  describe.each([
    [{}, {}, false],
    [{ version: "1.0.0" }, { version: "1.0.0" }, false],
    [{ checksum: "a" }, { checksum: "a" }, false],
    [{ lastModifiedAt: 100 }, { lastModifiedAt: 100 }, false],
    [{ version: "1.0.0" }, { version: "1.0.1" }, true],
  ] as const)("detect(%j, %j)", (previous, current, expectedChanged) => {
    it(`changed === ${expectedChanged}`, () => {
      expect(detector.detect(previous, current).changed).toBe(expectedChanged);
    });
  });

  it("accumulates multiple reasons at once", () => {
    const result = detector.detect(
      { version: "1.0.0", checksum: "a" },
      { version: "2.0.0", checksum: "b" },
    );
    expect(result.reasons).toEqual(expect.arrayContaining(["version_changed", "checksum_changed"]));
  });
});

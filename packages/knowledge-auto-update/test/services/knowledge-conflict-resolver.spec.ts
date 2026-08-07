import { describe, expect, it } from "vitest";

import { ConflictUnresolvedException } from "../../src/errors/conflict-unresolved-exception.js";
import { KnowledgeConflictResolver } from "../../src/services/knowledge-conflict-resolver.js";
import { ConflictResolutionStrategyName } from "../../src/types/conflict-resolution-strategy.js";

describe("KnowledgeConflictResolver", () => {
  const resolver = new KnowledgeConflictResolver();

  it("throws when given no candidates", () => {
    expect(() =>
      resolver.resolve("job-1", [], ConflictResolutionStrategyName.LastWriteWins),
    ).toThrow(ConflictUnresolvedException);
  });

  it("returns the single candidate trivially", () => {
    const candidate = { source: "a", payload: {}, updatedAt: 0 };
    const resolution = resolver.resolve(
      "job-1",
      [candidate],
      ConflictResolutionStrategyName.LastWriteWins,
    );
    expect(resolution.winner).toBe(candidate);
    expect(resolution.reason).toBe("single_candidate");
  });

  describe("LastWriteWins", () => {
    it("picks the candidate with the latest updatedAt", () => {
      const a = { source: "a", payload: {}, updatedAt: 100 };
      const b = { source: "b", payload: {}, updatedAt: 200 };
      const resolution = resolver.resolve(
        "job-1",
        [a, b],
        ConflictResolutionStrategyName.LastWriteWins,
      );
      expect(resolution.winner.source).toBe("b");
      expect(resolution.reason).toBe("latest_updated_at");
    });

    it("keeps the first candidate on a tie", () => {
      const a = { source: "a", payload: {}, updatedAt: 100 };
      const b = { source: "b", payload: {}, updatedAt: 100 };
      const resolution = resolver.resolve(
        "job-1",
        [a, b],
        ConflictResolutionStrategyName.LastWriteWins,
      );
      expect(resolution.winner.source).toBe("a");
    });

    it("compares more than two candidates correctly", () => {
      const candidates = [
        { source: "a", payload: {}, updatedAt: 50 },
        { source: "b", payload: {}, updatedAt: 300 },
        { source: "c", payload: {}, updatedAt: 150 },
      ];
      const resolution = resolver.resolve(
        "job-1",
        candidates,
        ConflictResolutionStrategyName.LastWriteWins,
      );
      expect(resolution.winner.source).toBe("b");
    });
  });

  describe("VersionPriority", () => {
    it("picks the candidate with the highest version", () => {
      const a = { source: "a", payload: {}, updatedAt: 0, version: "1.0.0" };
      const b = { source: "b", payload: {}, updatedAt: 0, version: "2.0.0" };
      const resolution = resolver.resolve(
        "job-1",
        [a, b],
        ConflictResolutionStrategyName.VersionPriority,
      );
      expect(resolution.winner.source).toBe("b");
      expect(resolution.reason).toBe("highest_version");
    });

    it("keeps the first candidate when versions are equal", () => {
      const a = { source: "a", payload: {}, updatedAt: 0, version: "1.0.0" };
      const b = { source: "b", payload: {}, updatedAt: 0, version: "1.0.0" };
      const resolution = resolver.resolve(
        "job-1",
        [a, b],
        ConflictResolutionStrategyName.VersionPriority,
      );
      expect(resolution.winner.source).toBe("a");
    });

    it.each([
      ["1.0.0", "2.0.0", "b"],
      ["3.0.0", "2.0.0", "a"],
      ["1.5.0", "1.5.0-beta", "a"],
    ] as const)("versions %s vs %s -> winner %s", (versionA, versionB, expectedWinner) => {
      const a = { source: "a", payload: {}, updatedAt: 0, version: versionA };
      const b = { source: "b", payload: {}, updatedAt: 0, version: versionB };
      const resolution = resolver.resolve(
        "job-1",
        [a, b],
        ConflictResolutionStrategyName.VersionPriority,
      );
      expect(resolution.winner.source).toBe(expectedWinner);
    });

    it("throws ConflictUnresolvedException when any candidate lacks a version", () => {
      const a = { source: "a", payload: {}, updatedAt: 0, version: "1.0.0" };
      const b = { source: "b", payload: {}, updatedAt: 0 };
      expect(() =>
        resolver.resolve("job-1", [a, b], ConflictResolutionStrategyName.VersionPriority),
      ).toThrow(ConflictUnresolvedException);
    });
  });
});

import { describe, expect, it } from "vitest";

import { KnowledgeVersionType } from "../../src/domain/knowledge-version-type.js";
import { KnowledgeVersionStatistics } from "../../src/statistics/knowledge-version-statistics.js";

describe("KnowledgeVersionStatistics", () => {
  it("returns the empty snapshot for an untouched versionType", () => {
    const statistics = new KnowledgeVersionStatistics();
    expect(statistics.get(KnowledgeVersionType.MAJOR)).toEqual({
      createdCount: 0,
      publishedCount: 0,
    });
  });

  it("recordCreated() increments createdCount and stamps lastActivityAt", () => {
    const statistics = new KnowledgeVersionStatistics();
    const snapshot = statistics.recordCreated(KnowledgeVersionType.MAJOR);
    expect(snapshot.createdCount).toBe(1);
    expect(snapshot.lastActivityAt).toBeTruthy();
    expect(statistics.get(KnowledgeVersionType.MAJOR).createdCount).toBe(1);
  });

  it("recordPublished() increments publishedCount independently", () => {
    const statistics = new KnowledgeVersionStatistics();
    statistics.recordCreated(KnowledgeVersionType.MINOR);
    const snapshot = statistics.recordPublished(KnowledgeVersionType.MINOR);
    expect(snapshot.createdCount).toBe(1);
    expect(snapshot.publishedCount).toBe(1);
  });

  it("tracks counters independently per versionType", () => {
    const statistics = new KnowledgeVersionStatistics();
    statistics.recordCreated(KnowledgeVersionType.MAJOR);
    statistics.recordCreated(KnowledgeVersionType.MINOR);
    statistics.recordCreated(KnowledgeVersionType.MINOR);
    expect(statistics.get(KnowledgeVersionType.MAJOR).createdCount).toBe(1);
    expect(statistics.get(KnowledgeVersionType.MINOR).createdCount).toBe(2);
  });
});

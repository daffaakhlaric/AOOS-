import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeIntelligenceSnapshotFactory } from "../../src/factories/knowledge-intelligence-snapshot-factory.js";
import { resetFixtureState, makeClock } from "../helpers/fixtures.js";

describe("KnowledgeIntelligenceSnapshotFactory", () => {
  beforeEach(() => resetFixtureState());

  it("creates a snapshot with a fresh id and timestamp", () => {
    const factory = new KnowledgeIntelligenceSnapshotFactory(makeClock(3000));
    const snapshot = factory.create({
      itemCount: 5,
      averageHealthScore: 80,
      duplicateCount: 1,
      gapCount: 2,
      recommendationCount: 3,
    });
    expect(snapshot.takenAt).toBe(3000);
    expect(snapshot.itemCount).toBe(5);
  });
});

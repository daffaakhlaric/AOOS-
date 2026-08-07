import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { KnowledgeAutoUpdateEventType } from "../../src/events/knowledge-auto-update-event-type.js";
import { ResolveConflictsStage } from "../../src/pipeline/stages/resolve-conflicts-stage.js";
import { resetFixtureState } from "../helpers/fixtures.js";
import { makeContext, makePipelineServices } from "../helpers/pipeline-helpers.js";

describe("ResolveConflictsStage", () => {
  beforeEach(resetFixtureState);

  it("resolves trivially with a single implicit candidate (no conflict events)", () => {
    const publisher = new InMemoryEventPublisher();
    const context = makeContext({ services: makePipelineServices(undefined, publisher) });
    const result = new ResolveConflictsStage().execute(context);
    expect(result.conflictResolution?.reason).toBe("single_candidate");
    expect(publisher.getHistory()).toHaveLength(0);
  });

  it("publishes ConflictDetected and ConflictResolved when multiple candidates are supplied", () => {
    const publisher = new InMemoryEventPublisher();
    const context = makeContext({
      services: makePipelineServices(undefined, publisher),
      conflictCandidates: [
        { source: "a", payload: { x: 1 }, updatedAt: 10 },
        { source: "b", payload: { x: 2 }, updatedAt: 20 },
      ],
    });
    const result = new ResolveConflictsStage().execute(context);
    expect(result.conflictResolution?.winner.source).toBe("b");
    const types = publisher.getHistory().map((e) => e.eventType);
    expect(types).toContain(KnowledgeAutoUpdateEventType.ConflictDetected);
    expect(types).toContain(KnowledgeAutoUpdateEventType.ConflictResolved);
  });

  it("picks the correct winner among 3+ candidates via LastWriteWins", () => {
    const context = makeContext({
      conflictCandidates: [
        { source: "a", payload: { v: 1 }, updatedAt: 10 },
        { source: "b", payload: { v: 2 }, updatedAt: 500 },
        { source: "c", payload: { v: 3 }, updatedAt: 250 },
      ],
    });
    const result = new ResolveConflictsStage().execute(context);
    expect(result.conflictResolution?.winner.source).toBe("b");
  });

  it("records a conflict in statistics when multiple candidates are supplied", () => {
    const context = makeContext({
      conflictCandidates: [
        { source: "a", payload: {}, updatedAt: 0 },
        { source: "b", payload: {}, updatedAt: 1 },
      ],
    });
    new ResolveConflictsStage().execute(context);
    expect(context.statistics.snapshot().conflictCount).toBe(1);
  });
});

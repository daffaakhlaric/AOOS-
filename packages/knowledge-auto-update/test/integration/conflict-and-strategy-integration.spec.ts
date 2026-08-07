import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeUpdatePipeline } from "../../src/pipeline/knowledge-update-pipeline.js";
import { ConflictResolutionStrategyName } from "../../src/types/conflict-resolution-strategy.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { makeJob, makePolicy, resetFixtureState } from "../helpers/fixtures.js";
import { makePipelineServices } from "../helpers/pipeline-helpers.js";

describe("Conflict resolution + strategy dispatch integration", () => {
  beforeEach(resetFixtureState);

  it("resolves a multi-candidate conflict via LastWriteWins and applies the winner's payload", () => {
    const services = makePipelineServices();
    const job = makeJob({ updateType: KnowledgeUpdateType.Manual, payload: { a: "job-payload" } });
    const policy = makePolicy({
      conflictResolutionStrategy: ConflictResolutionStrategyName.LastWriteWins,
    });
    services.registry.putJob(job);
    services.registry.putPolicy(policy);

    const context = new KnowledgeUpdatePipeline().run(
      {
        job,
        policy,
        sessionId: "s-1",
        dependentCount: 0,
        conflictCandidates: [
          { source: "external-a", payload: { a: "old" }, updatedAt: 10 },
          { source: "external-b", payload: { a: "newest" }, updatedAt: 999 },
        ],
      },
      services,
    );

    expect(context.conflictResolution?.winner.source).toBe("external-b");
    expect(context.result?.appliedPayload).toEqual({ a: "newest" });
  });

  it("resolves a multi-candidate conflict via VersionPriority and applies the highest version", () => {
    const services = makePipelineServices();
    const job = makeJob({ updateType: KnowledgeUpdateType.Full, payload: { version: "0.0.0" } });
    const policy = makePolicy({
      conflictResolutionStrategy: ConflictResolutionStrategyName.VersionPriority,
    });
    services.registry.putJob(job);
    services.registry.putPolicy(policy);

    const context = new KnowledgeUpdatePipeline().run(
      {
        job,
        policy,
        sessionId: "s-1",
        dependentCount: 0,
        conflictCandidates: [
          { source: "v1", payload: { version: "1.0.0" }, updatedAt: 0, version: "1.0.0" },
          { source: "v3", payload: { version: "3.0.0" }, updatedAt: 0, version: "3.0.0" },
          { source: "v2", payload: { version: "2.0.0" }, updatedAt: 0, version: "2.0.0" },
        ],
      },
      services,
    );

    expect(context.conflictResolution?.winner.source).toBe("v3");
    expect(context.result?.appliedPayload).toEqual({ version: "3.0.0" });
  });

  it("propagates conflict resolution failure (missing versions) as a pipeline stage failure", () => {
    const services = makePipelineServices();
    const job = makeJob({ updateType: KnowledgeUpdateType.Full, payload: {} });
    const policy = makePolicy({
      conflictResolutionStrategy: ConflictResolutionStrategyName.VersionPriority,
    });
    services.registry.putJob(job);
    services.registry.putPolicy(policy);

    expect(() =>
      new KnowledgeUpdatePipeline().run(
        {
          job,
          policy,
          sessionId: "s-1",
          dependentCount: 0,
          conflictCandidates: [
            { source: "a", payload: {}, updatedAt: 0, version: "1.0.0" },
            { source: "b", payload: {}, updatedAt: 0 }, // missing version
          ],
        },
        services,
      ),
    ).toThrow();
  });

  it("each concrete strategy correctly self-identifies its updateType when resolved by the registry", () => {
    const services = makePipelineServices();
    for (const updateType of Object.values(KnowledgeUpdateType)) {
      const strategy = services.strategyRegistry.resolve(updateType);
      expect(strategy.updateType).toBe(updateType);
    }
  });
});

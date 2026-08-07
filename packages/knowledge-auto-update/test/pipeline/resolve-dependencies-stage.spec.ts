import { beforeEach, describe, expect, it } from "vitest";

import { DependencyNotSatisfiedException } from "../../src/errors/dependency-not-satisfied-exception.js";
import { JobNotFoundException } from "../../src/errors/job-not-found-exception.js";
import { ResolveDependenciesStage } from "../../src/pipeline/stages/resolve-dependencies-stage.js";
import { KnowledgeUpdateJobStatus } from "../../src/types/job-status.js";
import { makeJob, resetFixtureState } from "../helpers/fixtures.js";
import { makeContext } from "../helpers/pipeline-helpers.js";

describe("ResolveDependenciesStage", () => {
  beforeEach(resetFixtureState);

  it("passes through when the job has no dependencies", () => {
    const context = makeContext({ job: makeJob({ dependsOn: [] }) });
    expect(() => new ResolveDependenciesStage().execute(context)).not.toThrow();
  });

  it("passes through when every dependency is Completed", () => {
    const context = makeContext();
    const dep = makeJob({ id: "dep-1", status: KnowledgeUpdateJobStatus.Completed });
    context.registry.putJob(dep);
    const job = makeJob({ dependsOn: ["dep-1"] });
    context.registry.putJob(job);
    const updated = { ...context, job };
    expect(() => new ResolveDependenciesStage().execute(updated)).not.toThrow();
  });

  it("treats a Cancelled dependency as satisfied", () => {
    const context = makeContext();
    context.registry.putJob(makeJob({ id: "dep-1", status: KnowledgeUpdateJobStatus.Cancelled }));
    const job = makeJob({ dependsOn: ["dep-1"] });
    context.registry.putJob(job);
    const updated = { ...context, job };
    expect(() => new ResolveDependenciesStage().execute(updated)).not.toThrow();
  });

  it("throws DependencyNotSatisfiedException when a dependency is still pending", () => {
    const context = makeContext();
    context.registry.putJob(makeJob({ id: "dep-1", status: KnowledgeUpdateJobStatus.Pending }));
    const job = makeJob({ dependsOn: ["dep-1"] });
    context.registry.putJob(job);
    const updated = { ...context, job };
    expect(() => new ResolveDependenciesStage().execute(updated)).toThrow(
      DependencyNotSatisfiedException,
    );
  });

  it("throws JobNotFoundException when a dependency was never registered", () => {
    const job = makeJob({ dependsOn: ["never-registered"] });
    const context = makeContext({ job });
    expect(() => new ResolveDependenciesStage().execute(context)).toThrow(JobNotFoundException);
  });
});

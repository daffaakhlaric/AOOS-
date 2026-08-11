import { createLogger } from "@aos/logger";
import { describe, expect, it } from "vitest";

import { UpdateObjective } from "../../../../src/application/use-cases/UpdateObjective.js";
import { ObjectiveBuilder } from "../../../../src/builders/ObjectiveBuilder.js";
import { ObjectiveEngineEvents } from "../../../../src/domain/events/ObjectiveEngineEvents.js";
import { ObjectiveId } from "../../../../src/domain/value-objects/ObjectiveId.js";
import { InMemoryObjectiveRepository } from "../../../../src/infrastructure/repositories/InMemoryObjectiveRepository.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { unwrap } from "../../../helpers/result.js";

function setup() {
  const repository = new InMemoryObjectiveRepository();
  const publisher = createFakePublisher();
  const events = new ObjectiveEngineEvents(publisher);
  const useCase = new UpdateObjective(
    repository,
    events,
    createLogger({ serviceName: "test" }),
    () => new Date("2026-08-09T00:00:00.000Z"),
  );
  const objective = unwrap(new ObjectiveBuilder().build());
  repository.save(objective);
  return { repository, publisher, useCase, objective };
}

describe("UpdateObjective", () => {
  it("updates targetHotLeads only", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      targetHotLeads: 80,
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.targetHotLeads.toNumber()).toBe(80);
      expect(result.value.budgetAllocation.equals(objective.budgetAllocation)).toBe(true);
    }
  });

  it("updates budgetAllocation only", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      budgetAllocation: 50_000_000,
      correlationId: "corr-2",
    });
    expect(result.ok && result.value.budgetAllocation.toNumber()).toBe(50_000_000);
  });

  it("updates focusUnits", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      focusUnits: ["Avanza"],
      correlationId: "corr-3",
    });
    expect(result.ok && result.value.focusUnits.map((f) => f.toString())).toEqual(["Avanza"]);
  });

  it("updates areaPriorities", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      areaPriorities: ["BINTARO"],
      correlationId: "corr-4",
    });
    expect(result.ok && result.value.areaPriorities.map((a) => a.toBranch())).toEqual(["BINTARO"]);
  });

  it("persists the update to the repository", async () => {
    const { useCase, repository, objective } = setup();
    await useCase.execute({
      objectiveId: objective.id,
      targetHotLeads: 99,
      correlationId: "corr-5",
    });
    const found = repository.findById(objective.id);
    expect(found.some && found.value.targetHotLeads.toNumber()).toBe(99);
  });

  it("emits ObjectiveUpdated", async () => {
    const { useCase, publisher, objective } = setup();
    await useCase.execute({
      objectiveId: objective.id,
      targetHotLeads: 99,
      correlationId: "corr-6",
    });
    expect(publisher.published.some((p) => p.type === "aaos.objective.updated")).toBe(true);
  });

  it("returns ObjectiveNotFoundError for an unknown id", async () => {
    const { useCase } = setup();
    const result = await useCase.execute({
      objectiveId: ObjectiveId.generate(),
      targetHotLeads: 99,
      correlationId: "corr-7",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid targetHotLeads", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      targetHotLeads: -1,
      correlationId: "corr-8",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid budgetAllocation", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      budgetAllocation: -1,
      correlationId: "corr-9",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid focusUnits entry", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      focusUnits: ["Bogus"],
      correlationId: "corr-10",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid areaPriorities entry", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      areaPriorities: ["Bogus"],
      correlationId: "corr-11",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a missing correlationId", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      targetHotLeads: 60,
      correlationId: "",
    });
    expect(result.ok).toBe(false);
  });

  it("applying no updates keeps existing fields unchanged", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({ objectiveId: objective.id, correlationId: "corr-12" });
    expect(result.ok && result.value.targetHotLeads.equals(objective.targetHotLeads)).toBe(true);
  });

  it("rejects a root-level malformed input (not an object) — exercises the '(root)' path fallback", async () => {
    const { useCase } = setup();
    const result = await useCase.execute(5 as unknown as Parameters<typeof useCase.execute>[0]);
    expect(result.ok).toBe(false);
  });

  it("uses the real wall clock when no `now` is injected (default constructor param)", async () => {
    const repository = new InMemoryObjectiveRepository();
    const publisher = createFakePublisher();
    const events = new ObjectiveEngineEvents(publisher);
    const useCase = new UpdateObjective(repository, events, createLogger({ serviceName: "test" }));
    const objective = unwrap(new ObjectiveBuilder().build());
    repository.save(objective);
    const result = await useCase.execute({
      objectiveId: objective.id,
      targetHotLeads: 60,
      correlationId: "corr-13",
    });
    expect(result.ok).toBe(true);
  });
});

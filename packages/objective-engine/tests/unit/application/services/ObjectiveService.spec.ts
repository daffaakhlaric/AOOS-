import { createLogger } from "@aos/logger";
import { describe, expect, it } from "vitest";

import { ObjectiveService } from "../../../../src/application/services/ObjectiveService.js";
import { CreateObjective } from "../../../../src/application/use-cases/CreateObjective.js";
import { GetObjective } from "../../../../src/application/use-cases/GetObjective.js";
import { GetObjectiveStatus } from "../../../../src/application/use-cases/GetObjectiveStatus.js";
import { UpdateObjective } from "../../../../src/application/use-cases/UpdateObjective.js";
import { DEFAULT_OBJECTIVE_ENGINE_CONFIG } from "../../../../src/config/ObjectiveEngineConfig.js";
import { ObjectiveEngineEvents } from "../../../../src/domain/events/ObjectiveEngineEvents.js";
import { ObjectiveId } from "../../../../src/domain/value-objects/ObjectiveId.js";
import { InMemoryObjectiveRepository } from "../../../../src/infrastructure/repositories/InMemoryObjectiveRepository.js";
import { TestClock } from "../../../helpers/clock.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

function config() {
  return { tenantId: "dss-motor", ...DEFAULT_OBJECTIVE_ENGINE_CONFIG };
}

function setup() {
  const repository = new InMemoryObjectiveRepository();
  const events = new ObjectiveEngineEvents(createFakePublisher());
  const logger = createLogger({ serviceName: "test" });
  const tracer = createFakeTracer();
  const clock = new TestClock("2026-08-09T00:00:00.000Z");
  const createObjective = new CreateObjective(
    repository,
    events,
    config(),
    logger,
    tracer,
    clock.now,
  );
  const updateObjective = new UpdateObjective(repository, events, logger, clock.now);
  const getObjective = new GetObjective(repository);
  const getObjectiveStatus = new GetObjectiveStatus(repository, config());
  const service = new ObjectiveService(
    createObjective,
    updateObjective,
    getObjective,
    getObjectiveStatus,
  );
  return { service, repository };
}

describe("ObjectiveService", () => {
  it("create() delegates to CreateObjective", async () => {
    const { service } = setup();
    const result = await service.create({
      tenantId: "dss-motor",
      period: { month: 8, year: 2026 },
      targetHotLeads: 50,
      budgetAllocation: 30_000_000,
      focusUnits: ["Xpander"],
      areaPriorities: ["CINERE"],
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
  });

  it("get()/update()/getStatus() delegate correctly", async () => {
    const { service } = setup();
    const created = await service.create({
      tenantId: "dss-motor",
      period: { month: 8, year: 2026 },
      targetHotLeads: 50,
      budgetAllocation: 30_000_000,
      focusUnits: ["Xpander"],
      areaPriorities: ["CINERE"],
      correlationId: "corr-2",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const fetched = service.get({ objectiveId: created.value.id });
    expect(fetched.ok && fetched.value.id.equals(created.value.id)).toBe(true);

    const updated = await service.update({
      objectiveId: created.value.id,
      targetHotLeads: 100,
      correlationId: "corr-3",
    });
    expect(updated.ok && updated.value.targetHotLeads.toNumber()).toBe(100);

    const status = service.getStatus({ objectiveId: created.value.id });
    expect(status.ok && status.value.objective.id.equals(created.value.id)).toBe(true);
  });

  it("get() returns not-found for an unknown id", () => {
    const { service } = setup();
    const result = service.get({ objectiveId: ObjectiveId.generate() });
    expect(result.ok).toBe(false);
  });
});

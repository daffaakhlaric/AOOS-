import { createLogger } from "@aos/logger";
import { describe, expect, it } from "vitest";

import { ProgressTrackingService } from "../../../../src/application/services/ProgressTrackingService.js";
import { UpdateProgress } from "../../../../src/application/use-cases/UpdateProgress.js";
import { ObjectiveBuilder } from "../../../../src/builders/ObjectiveBuilder.js";
import { ForecastCalculator } from "../../../../src/calculators/ForecastCalculator.js";
import { ProgressCalculator } from "../../../../src/calculators/ProgressCalculator.js";
import { DEFAULT_OBJECTIVE_ENGINE_CONFIG } from "../../../../src/config/ObjectiveEngineConfig.js";
import { ObjectiveEngineEvents } from "../../../../src/domain/events/ObjectiveEngineEvents.js";
import { ObjectiveStatus } from "../../../../src/domain/value-objects/ObjectiveStatus.js";
import { InMemoryObjectiveRepository } from "../../../../src/infrastructure/repositories/InMemoryObjectiveRepository.js";
import { buildAdAccountFixture } from "../../../fixtures/adAccountFixtures.js";
import { TestClock } from "../../../helpers/clock.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { unwrap } from "../../../helpers/result.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

describe("ProgressTrackingService", () => {
  it("update() delegates to UpdateProgress", async () => {
    const repository = new InMemoryObjectiveRepository();
    const events = new ObjectiveEngineEvents(createFakePublisher());
    const clock = new TestClock("2026-08-09T00:00:00.000Z");
    const useCase = new UpdateProgress(
      repository,
      new ProgressCalculator(),
      new ForecastCalculator(),
      events,
      { tenantId: "dss-motor", ...DEFAULT_OBJECTIVE_ENGINE_CONFIG },
      createLogger({ serviceName: "test" }),
      createFakeTracer(),
      clock.now,
    );
    const service = new ProgressTrackingService(useCase);
    const objective = unwrap(new ObjectiveBuilder().withStatus(ObjectiveStatus.ACTIVE).build());
    repository.save(objective);

    const result = await service.update({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      hotLeadsCount: 12,
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
  });
});

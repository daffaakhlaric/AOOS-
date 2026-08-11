import { createLogger } from "@aos/logger";
import { describe, expect, it } from "vitest";

import { CreateObjective } from "../../../../src/application/use-cases/CreateObjective.js";
import { DEFAULT_OBJECTIVE_ENGINE_CONFIG } from "../../../../src/config/ObjectiveEngineConfig.js";
import { ObjectiveEngineEvents } from "../../../../src/domain/events/ObjectiveEngineEvents.js";
import { InMemoryObjectiveRepository } from "../../../../src/infrastructure/repositories/InMemoryObjectiveRepository.js";
import { TestClock } from "../../../helpers/clock.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

function config(overrides?: Partial<typeof DEFAULT_OBJECTIVE_ENGINE_CONFIG>) {
  return { tenantId: "dss-motor", ...DEFAULT_OBJECTIVE_ENGINE_CONFIG, ...overrides };
}

function setup(overrides?: Partial<typeof DEFAULT_OBJECTIVE_ENGINE_CONFIG>) {
  const repository = new InMemoryObjectiveRepository();
  const publisher = createFakePublisher();
  const events = new ObjectiveEngineEvents(publisher);
  const clock = new TestClock("2026-08-09T00:00:00.000Z");
  const useCase = new CreateObjective(
    repository,
    events,
    config(overrides),
    createLogger({ serviceName: "test" }),
    createFakeTracer(),
    clock.now,
  );
  return { repository, publisher, useCase, clock };
}

function validInput(overrides?: Record<string, unknown>) {
  return {
    tenantId: "dss-motor",
    period: { month: 8, year: 2026 },
    targetHotLeads: 50,
    budgetAllocation: 30_000_000,
    focusUnits: ["Xpander", "Brio"],
    areaPriorities: ["CINERE"],
    correlationId: "corr-1",
    ...overrides,
  };
}

describe("CreateObjective", () => {
  it("creates and stores an Objective in-memory", async () => {
    const { useCase, repository } = setup();
    const result = await useCase.execute(validInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(repository.findById(result.value.id).some).toBe(true);
      expect(result.value.tenantId).toBe("dss-motor");
    }
  });

  it("emits ObjectiveCreated", async () => {
    const { useCase, publisher } = setup();
    await useCase.execute(validInput());
    expect(publisher.published.some((p) => p.type === "aaos.objective.created")).toBe(true);
  });

  it("rejects targetHotLeads <= 0", async () => {
    const { useCase } = setup();
    const result = await useCase.execute(validInput({ targetHotLeads: 0 }));
    expect(result.ok).toBe(false);
  });

  it("rejects budgetAllocation <= 0", async () => {
    const { useCase } = setup();
    const result = await useCase.execute(validInput({ budgetAllocation: 0 }));
    expect(result.ok).toBe(false);
  });

  it("rejects a past period", async () => {
    const { useCase } = setup();
    const result = await useCase.execute(validInput({ period: { month: 7, year: 2026 } }));
    expect(result.ok).toBe(false);
  });

  it("accepts the current month as a valid period", async () => {
    const { useCase } = setup();
    const result = await useCase.execute(validInput({ period: { month: 8, year: 2026 } }));
    expect(result.ok).toBe(true);
  });

  it("accepts a future period", async () => {
    const { useCase } = setup();
    const result = await useCase.execute(validInput({ period: { month: 9, year: 2026 } }));
    expect(result.ok).toBe(true);
  });

  it("rejects a second active objective for the same tenant/month (max 1 per month)", async () => {
    const { useCase } = setup();
    const first = await useCase.execute(validInput());
    expect(first.ok).toBe(true);
    const second = await useCase.execute(validInput());
    expect(second.ok).toBe(false);
  });

  it("allows a second objective for a different tenant in the same month", async () => {
    const { useCase } = setup();
    await useCase.execute(validInput());
    const second = await useCase.execute(validInput({ tenantId: "other-tenant" }));
    expect(second.ok).toBe(true);
  });

  it("allows a second objective for a different month, same tenant", async () => {
    const { useCase } = setup();
    await useCase.execute(validInput());
    const second = await useCase.execute(validInput({ period: { month: 9, year: 2026 } }));
    expect(second.ok).toBe(true);
  });

  it("respects a configured maxObjectivesPerMonth > 1", async () => {
    const { useCase } = setup({ maxObjectivesPerMonth: 2 });
    const first = await useCase.execute(validInput());
    const second = await useCase.execute(validInput());
    const third = await useCase.execute(validInput());
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
  });

  it("rejects an empty focusUnits array", async () => {
    const { useCase } = setup();
    const result = await useCase.execute(validInput({ focusUnits: [] }));
    expect(result.ok).toBe(false);
  });

  it("rejects an empty areaPriorities array", async () => {
    const { useCase } = setup();
    const result = await useCase.execute(validInput({ areaPriorities: [] }));
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid focusUnit value", async () => {
    const { useCase } = setup();
    const result = await useCase.execute(validInput({ focusUnits: ["NotAUnit"] }));
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid areaPriority value", async () => {
    const { useCase } = setup();
    const result = await useCase.execute(validInput({ areaPriorities: ["NotABranch"] }));
    expect(result.ok).toBe(false);
  });

  it("rejects a missing correlationId", async () => {
    const { useCase } = setup();
    const result = await useCase.execute(validInput({ correlationId: "" }));
    expect(result.ok).toBe(false);
  });

  it("created Objective starts in DRAFT status", async () => {
    const { useCase } = setup();
    const result = await useCase.execute(validInput());
    expect(result.ok && result.value.status).toBe("DRAFT");
  });

  it("rejects a period that passes Zod's int check but fails ObjectivePeriod's range check", async () => {
    const { useCase } = setup();
    const result = await useCase.execute(validInput({ period: { month: 13, year: 2026 } }));
    expect(result.ok).toBe(false);
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
    const useCase = new CreateObjective(
      repository,
      events,
      config(),
      createLogger({ serviceName: "test" }),
      createFakeTracer(),
      // `now` intentionally omitted to exercise the default `() => new Date()`.
    );
    const farFuture = { month: 12, year: 2200 };
    const result = await useCase.execute(validInput({ period: farFuture }));
    expect(result.ok).toBe(true);
  });

  it("objective created on the last day of the month is still current-month-valid", async () => {
    const repository = new InMemoryObjectiveRepository();
    const publisher = createFakePublisher();
    const events = new ObjectiveEngineEvents(publisher);
    const clock = new TestClock("2026-08-31T00:00:00.000Z");
    const useCase = new CreateObjective(
      repository,
      events,
      config(),
      createLogger({ serviceName: "test" }),
      createFakeTracer(),
      clock.now,
    );
    const result = await useCase.execute(validInput({ period: { month: 8, year: 2026 } }));
    expect(result.ok).toBe(true);
  });
});

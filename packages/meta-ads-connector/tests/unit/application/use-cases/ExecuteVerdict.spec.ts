import { err, ok } from "@aos/common";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it, vi } from "vitest";

import { ExecuteVerdict } from "../../../../src/application/use-cases/ExecuteVerdict.js";
import type { IVerdictExecutor } from "../../../../src/contracts/IVerdictExecutor.js";
import { ApiServerError } from "../../../../src/domain/errors/index.js";
import { MetaAdsConnectorEvents } from "../../../../src/domain/events/MetaAdsConnectorEvents.js";
import { Verdict } from "../../../../src/domain/value-objects/Verdict.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

function fakeExecutor(result: Awaited<ReturnType<IVerdictExecutor["execute"]>>): IVerdictExecutor {
  return { execute: vi.fn().mockResolvedValue(result) };
}

function makeUseCase(executor: IVerdictExecutor) {
  const publisher = createFakePublisher();
  const events = new MetaAdsConnectorEvents(publisher);
  const useCase = new ExecuteVerdict(
    executor,
    events,
    createMockLogger() as never,
    createFakeTracer(),
    () => new Date("2026-03-01T00:00:00.000Z"),
  );
  return { useCase, publisher };
}

describe("ExecuteVerdict (unit, fake IVerdictExecutor)", () => {
  it("logs and returns the failure without emitting an event when the executor fails", async () => {
    const { useCase, publisher } = makeUseCase(fakeExecutor(err(new ApiServerError("boom"))));
    const result = await useCase.execute({
      verdict: Verdict.PAUSE,
      targetId: "ad-1",
      targetType: "ad",
      accessToken: "T",
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(result.ok).toBe(false);
    expect(publisher.published).toHaveLength(0);
  });

  it("does not emit AdPaused when the verdict is PAUSE but the executor's action is not 'PAUSED'", async () => {
    const { useCase, publisher } = makeUseCase(
      fakeExecutor(ok({ action: "NO_ACTION", targetId: "ad-1", targetType: "ad" })),
    );
    await useCase.execute({
      verdict: Verdict.PAUSE,
      targetId: "ad-1",
      targetType: "ad",
      accessToken: "T",
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(publisher.published).toHaveLength(0);
  });

  it("does not emit BudgetScaled when the verdict is SCALE but the executor's action is not 'SCALED'", async () => {
    const { useCase, publisher } = makeUseCase(
      fakeExecutor(ok({ action: "NO_ACTION", targetId: "adset-1", targetType: "adset" })),
    );
    await useCase.execute({
      verdict: Verdict.SCALE,
      targetId: "adset-1",
      targetType: "adset",
      accessToken: "T",
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(publisher.published).toHaveLength(0);
  });

  it("does not emit ObjectiveFixed when the verdict is FIX but the executor's action is not 'FIXED'", async () => {
    const { useCase, publisher } = makeUseCase(
      fakeExecutor(ok({ action: "NO_ACTION", targetId: "campaign-1", targetType: "campaign" })),
    );
    await useCase.execute({
      verdict: Verdict.FIX,
      targetId: "campaign-1",
      targetType: "campaign",
      accessToken: "T",
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(publisher.published).toHaveLength(0);
  });

  it("BudgetScaled event carries previousValue/newValue as numbers even if the executor returns them as strings", async () => {
    const { useCase, publisher } = makeUseCase(
      fakeExecutor(
        ok({
          action: "SCALED",
          targetId: "adset-1",
          targetType: "adset",
          previousValue: "not-a-number",
          newValue: "also-not",
        }),
      ),
    );
    await useCase.execute({
      verdict: Verdict.SCALE,
      targetId: "adset-1",
      targetType: "adset",
      accessToken: "T",
      tenantId: "t1",
      correlationId: "c1",
    });
    const payload = publisher.published[0]?.payload as {
      previousBudget: number;
      newBudget: number;
    };
    expect(payload.previousBudget).toBe(0);
    expect(payload.newBudget).toBe(0);
  });

  it("defaults `now` to the real wall clock when not injected", async () => {
    const publisher = createFakePublisher();
    const events = new MetaAdsConnectorEvents(publisher);
    const useCase = new ExecuteVerdict(
      fakeExecutor(ok({ action: "PAUSED", targetId: "ad-1", targetType: "ad" })),
      events,
      createMockLogger() as never,
      createFakeTracer(),
    );
    const before = Date.now();
    await useCase.execute({
      verdict: Verdict.PAUSE,
      targetId: "ad-1",
      targetType: "ad",
      accessToken: "T",
      tenantId: "t1",
      correlationId: "c1",
    });
    const payload = publisher.published[0]?.payload as { occurredAt: Date };
    expect(payload.occurredAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("ObjectiveFixed event defaults newObjective to OUTCOME_LEADS when the executor doesn't return a string (AAOS-W1D-S3: was OUTCOME_ENGAGEMENT)", async () => {
    const { useCase, publisher } = makeUseCase(
      fakeExecutor(
        ok({ action: "FIXED", targetId: "campaign-1", targetType: "campaign", newValue: 123 }),
      ),
    );
    await useCase.execute({
      verdict: Verdict.FIX,
      targetId: "campaign-1",
      targetType: "campaign",
      accessToken: "T",
      tenantId: "t1",
      correlationId: "c1",
    });
    const payload = publisher.published[0]?.payload as { newObjective: string };
    expect(payload.newObjective).toBe("OUTCOME_LEADS");
  });
});

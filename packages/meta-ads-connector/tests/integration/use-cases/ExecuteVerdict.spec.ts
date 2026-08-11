import { createMockLogger } from "@aos/testing";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { VerdictExecutionService } from "../../../src/application/services/VerdictExecutionService.js";
import { ExecuteVerdict } from "../../../src/application/use-cases/ExecuteVerdict.js";
import { MetaAdsConnectorEvents } from "../../../src/domain/events/MetaAdsConnectorEvents.js";
import { Verdict } from "../../../src/domain/value-objects/Verdict.js";
import { MetaApiClient } from "../../../src/infrastructure/meta-api/MetaApiClient.js";
import { TokenBucketRateLimiter } from "../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { mswServer } from "../../helpers/msw.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap } from "../../helpers/result.js";
import { createFakeTracer } from "../../helpers/tracer.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const BASE = "https://graph.facebook.com/v21.0";

function makeUseCase(retryOptions: { maxAttempts?: number } = {}) {
  const client = new MetaApiClient();
  const rateLimiter = new TokenBucketRateLimiter();
  const retry = new ExponentialBackoffRetry({ sleep: async () => undefined, ...retryOptions });
  const executor = new VerdictExecutionService(client, rateLimiter, retry);
  const publisher = createFakePublisher();
  const events = new MetaAdsConnectorEvents(publisher);
  const logger = createMockLogger();
  const useCase = new ExecuteVerdict(
    executor,
    events,
    logger as never,
    createFakeTracer(),
    () => new Date("2026-02-15T00:00:00.000Z"),
  );
  return { useCase, publisher };
}

describe("ExecuteVerdict (MSW-mocked Meta API)", () => {
  it("PAUSE POSTs to the mocked Meta endpoint, succeeds, and emits AdPaused", async () => {
    mswServer.use(http.post(`${BASE}/ad-1`, () => HttpResponse.json({ success: true })));
    const { useCase, publisher } = makeUseCase();
    const result = unwrap(
      await useCase.execute({
        verdict: Verdict.PAUSE,
        targetId: "ad-1",
        targetType: "ad",
        accessToken: "TOKEN",
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(result.action).toBe("PAUSED");
    expect(publisher.published.some((p) => p.type === "aaos.meta.ad.paused")).toBe(true);
  });

  it("SCALE POSTs to the mocked Meta endpoint, succeeds, and emits BudgetScaled", async () => {
    mswServer.use(http.post(`${BASE}/adset-1`, () => HttpResponse.json({ success: true })));
    const { useCase, publisher } = makeUseCase();
    const result = unwrap(
      await useCase.execute({
        verdict: Verdict.SCALE,
        targetId: "adset-1",
        targetType: "adset",
        accessToken: "TOKEN",
        currentDailyBudgetIDR: 100_000,
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(result.action).toBe("SCALED");
    expect(publisher.published.some((p) => p.type === "aaos.meta.budget.scaled")).toBe(true);
  });

  it("FIX POSTs to the mocked Meta endpoint, succeeds, and emits ObjectiveFixed", async () => {
    mswServer.use(http.post(`${BASE}/campaign-1`, () => HttpResponse.json({ success: true })));
    const { useCase, publisher } = makeUseCase();
    const result = unwrap(
      await useCase.execute({
        verdict: Verdict.FIX,
        targetId: "campaign-1",
        targetType: "campaign",
        accessToken: "TOKEN",
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(result.action).toBe("FIXED");
    expect(publisher.published.some((p) => p.type === "aaos.meta.objective.fixed")).toBe(true);
  });

  it("REFRESH returns HUMAN_ACTION_REQUIRED, makes no API call, and emits no event", async () => {
    const { useCase, publisher } = makeUseCase();
    const result = unwrap(
      await useCase.execute({
        verdict: Verdict.REFRESH,
        targetId: "ad-1",
        targetType: "ad",
        accessToken: "TOKEN",
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(result.action).toBe("HUMAN_ACTION_REQUIRED");
    expect(publisher.published).toHaveLength(0);
  });

  it("KEEP returns NO_ACTION, makes no API call, and emits no event", async () => {
    const { useCase, publisher } = makeUseCase();
    const result = unwrap(
      await useCase.execute({
        verdict: Verdict.KEEP,
        targetId: "ad-1",
        targetType: "ad",
        accessToken: "TOKEN",
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(result.action).toBe("NO_ACTION");
    expect(publisher.published).toHaveLength(0);
  });

  it("REVIEW returns NO_ACTION, makes no API call, and emits no event", async () => {
    const { useCase, publisher } = makeUseCase();
    const result = unwrap(
      await useCase.execute({
        verdict: Verdict.REVIEW,
        targetId: "ad-1",
        targetType: "ad",
        accessToken: "TOKEN",
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(result.action).toBe("NO_ACTION");
    expect(publisher.published).toHaveLength(0);
  });

  it("retries once on a 429 with Retry-After, then succeeds on the following attempt", async () => {
    let attempt = 0;
    mswServer.use(
      http.post(`${BASE}/ad-1`, () => {
        attempt += 1;
        if (attempt === 1) {
          return HttpResponse.json(
            { error: { message: "rate limited" } },
            { status: 429, headers: { "retry-after": "1" } },
          );
        }
        return HttpResponse.json({ success: true });
      }),
    );
    const { useCase, publisher } = makeUseCase();
    const result = await useCase.execute({
      verdict: Verdict.PAUSE,
      targetId: "ad-1",
      targetType: "ad",
      accessToken: "TOKEN",
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(result.ok).toBe(true);
    expect(attempt).toBe(2);
    expect(publisher.published.some((p) => p.type === "aaos.meta.ad.paused")).toBe(true);
  });

  it("does NOT retry a 401 (token expired) — fails after exactly one attempt", async () => {
    let attempt = 0;
    mswServer.use(
      http.post(`${BASE}/ad-1`, () => {
        attempt += 1;
        return HttpResponse.json(
          { error: { message: "token invalid", code: 190 } },
          { status: 401 },
        );
      }),
    );
    const { useCase, publisher } = makeUseCase();
    const result = await useCase.execute({
      verdict: Verdict.PAUSE,
      targetId: "ad-1",
      targetType: "ad",
      accessToken: "TOKEN",
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(result.ok).toBe(false);
    expect(attempt).toBe(1);
    expect(publisher.published).toHaveLength(0);
  });

  it("exhausts all 3 attempts on a persistent 500 and returns the final failure", async () => {
    let attempt = 0;
    mswServer.use(
      http.post(`${BASE}/ad-1`, () => {
        attempt += 1;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    const { useCase } = makeUseCase({ maxAttempts: 3 });
    const result = await useCase.execute({
      verdict: Verdict.PAUSE,
      targetId: "ad-1",
      targetType: "ad",
      accessToken: "TOKEN",
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(result.ok).toBe(false);
    expect(attempt).toBe(3);
  });
});

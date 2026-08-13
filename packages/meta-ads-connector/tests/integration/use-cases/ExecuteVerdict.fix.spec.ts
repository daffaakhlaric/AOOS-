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

function makeUseCase() {
  const client = new MetaApiClient();
  const rateLimiter = new TokenBucketRateLimiter();
  const retry = new ExponentialBackoffRetry({ sleep: async () => undefined });
  const executor = new VerdictExecutionService(client, rateLimiter, retry);
  const publisher = createFakePublisher();
  const events = new MetaAdsConnectorEvents(publisher);
  const logger = createMockLogger();
  const useCase = new ExecuteVerdict(
    executor,
    events,
    logger as never,
    createFakeTracer(),
    () => new Date("2026-03-01T00:00:00.000Z"),
  );
  return { useCase, publisher };
}

/**
 * AAOS-W1D-S3 pinned business correctness: ExecuteVerdict's FIX action must POST
 * `objective: "OUTCOME_LEADS"` — NOT `"OUTCOME_ENGAGEMENT"` (the pre-supplement value). This is a
 * dedicated file (per the task's testing section) exercising the real POST body over MSW, not
 * just the executor's return value.
 */
describe("ExecuteVerdict — FIX action posts OUTCOME_LEADS (AAOS-W1D-S3)", () => {
  it("POSTs body.objective=OUTCOME_LEADS (not OUTCOME_ENGAGEMENT) to /{campaign-id}", async () => {
    let capturedBody: unknown;
    mswServer.use(
      http.post(`${BASE}/campaign-1`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ success: true });
      }),
    );
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
    expect(result.newValue).toBe("OUTCOME_LEADS");
    expect(capturedBody).toMatchObject({ objective: "OUTCOME_LEADS", access_token: "TOKEN" });
    expect(capturedBody).not.toMatchObject({ objective: "OUTCOME_ENGAGEMENT" });

    const fixedEvent = publisher.published.find((p) => p.type === "aaos.meta.objective.fixed");
    expect(fixedEvent).toBeDefined();
    const payload = fixedEvent?.payload as { newObjective: string };
    expect(payload.newObjective).toBe("OUTCOME_LEADS");
  });
});

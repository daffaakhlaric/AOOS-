import { createMockLogger } from "@aos/testing";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { MetaAdsSyncService } from "../../../src/application/services/MetaAdsSyncService.js";
import { PullCampaignData } from "../../../src/application/use-cases/PullCampaignData.js";
import { MetaAdsConnectorEvents } from "../../../src/domain/events/MetaAdsConnectorEvents.js";
import { AdAccountId } from "../../../src/domain/value-objects/AdAccountId.js";
import { MetaApiClient } from "../../../src/infrastructure/meta-api/MetaApiClient.js";
import { TokenBucketRateLimiter } from "../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { AdAccountRegistry } from "../../../src/registry/AdAccountRegistry.js";
import { mswServer } from "../../helpers/msw.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap } from "../../helpers/result.js";
import { createFakeTracer } from "../../helpers/tracer.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const BASE = "https://graph.facebook.com/v21.0";

function makeService() {
  const client = new MetaApiClient();
  const rateLimiter = new TokenBucketRateLimiter();
  const retry = new ExponentialBackoffRetry({ sleep: async () => undefined });
  const registry = new AdAccountRegistry();
  const events = new MetaAdsConnectorEvents(createFakePublisher());
  const pullCampaignData = new PullCampaignData(
    client,
    rateLimiter,
    retry,
    registry,
    events,
    createMockLogger() as never,
    createFakeTracer(),
    () => new Date("2026-02-15T00:00:00.000Z"),
  );
  return { service: new MetaAdsSyncService(pullCampaignData), registry };
}

describe("Multiple ad accounts in a single sync (spec edge case)", () => {
  it("syncs each account independently — a failure on one account does not abort the others", async () => {
    mswServer.use(
      http.get(`${BASE}/act_1/campaigns`, () => HttpResponse.json({ data: [] })),
      http.get(`${BASE}/act_2/campaigns`, () =>
        HttpResponse.json({ error: { message: "invalid token", code: 190 } }, { status: 401 }),
      ),
      http.get(`${BASE}/act_3/campaigns`, () => HttpResponse.json({ data: [] })),
    );

    const { service } = makeService();
    const results = await service.syncAccounts([
      {
        adAccountId: unwrap(AdAccountId.create("act_1")),
        datePreset: "last_30d",
        accessToken: "T",
        tenantId: "t1",
        correlationId: "c1",
      },
      {
        adAccountId: unwrap(AdAccountId.create("act_2")),
        datePreset: "last_30d",
        accessToken: "T",
        tenantId: "t1",
        correlationId: "c2",
      },
      {
        adAccountId: unwrap(AdAccountId.create("act_3")),
        datePreset: "last_30d",
        accessToken: "T",
        tenantId: "t1",
        correlationId: "c3",
      },
    ]);

    expect(results[0]?.ok).toBe(true);
    expect(results[1]?.ok).toBe(false);
    expect(results[2]?.ok).toBe(true);
  });

  it("both successful accounts land in the shared registry, keyed independently", async () => {
    mswServer.use(
      http.get(`${BASE}/act_1/campaigns`, () => HttpResponse.json({ data: [] })),
      http.get(`${BASE}/act_2/campaigns`, () => HttpResponse.json({ data: [] })),
    );
    const { service, registry } = makeService();
    await service.syncAccounts([
      {
        adAccountId: unwrap(AdAccountId.create("act_1")),
        datePreset: "last_30d",
        accessToken: "T",
        tenantId: "t1",
        correlationId: "c1",
      },
      {
        adAccountId: unwrap(AdAccountId.create("act_2")),
        datePreset: "last_30d",
        accessToken: "T",
        tenantId: "t1",
        correlationId: "c2",
      },
    ]);
    expect(registry.findById(unwrap(AdAccountId.create("act_1"))).some).toBe(true);
    expect(registry.findById(unwrap(AdAccountId.create("act_2"))).some).toBe(true);
  });
});

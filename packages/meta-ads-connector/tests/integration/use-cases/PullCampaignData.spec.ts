import { createMockLogger } from "@aos/testing";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { PullCampaignData } from "../../../src/application/use-cases/PullCampaignData.js";
import { RateLimitError } from "../../../src/domain/errors/index.js";
import { MetaAdsConnectorEvents } from "../../../src/domain/events/MetaAdsConnectorEvents.js";
import { AdAccountId } from "../../../src/domain/value-objects/AdAccountId.js";
import { CampaignObjective } from "../../../src/domain/value-objects/CampaignObjective.js";
import { MetaApiClient } from "../../../src/infrastructure/meta-api/MetaApiClient.js";
import { TokenBucketRateLimiter } from "../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { AdAccountRegistry } from "../../../src/registry/AdAccountRegistry.js";
import { TestClock } from "../../helpers/clock.js";
import { mswServer } from "../../helpers/msw.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeTracer } from "../../helpers/tracer.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const BASE = "https://graph.facebook.com/v21.0";

function makeUseCase() {
  const client = new MetaApiClient();
  const rateLimiter = new TokenBucketRateLimiter();
  const retry = new ExponentialBackoffRetry({ sleep: async () => undefined });
  const registry = new AdAccountRegistry();
  const publisher = createFakePublisher();
  const events = new MetaAdsConnectorEvents(publisher);
  const logger = createMockLogger();
  const useCase = new PullCampaignData(
    client,
    rateLimiter,
    retry,
    registry,
    events,
    logger as never,
    createFakeTracer(),
    () => new Date("2026-02-15T00:00:00.000Z"),
  );
  return { useCase, registry, publisher };
}

function baseInput(overrides: Partial<Parameters<PullCampaignData["execute"]>[0]> = {}) {
  return {
    adAccountId: unwrap(AdAccountId.create("act_752604553578354")),
    datePreset: "last_30d" as const,
    accessToken: "TOKEN",
    tenantId: "tenant-1",
    correlationId: "corr-1",
    ...overrides,
  };
}

function makeUseCaseWithClock(clock: TestClock, minPullIntervalMs?: number) {
  const client = new MetaApiClient();
  const rateLimiter = new TokenBucketRateLimiter({ now: clock.now });
  const retry = new ExponentialBackoffRetry({ sleep: async () => undefined });
  const registry = new AdAccountRegistry();
  const publisher = createFakePublisher();
  const events = new MetaAdsConnectorEvents(publisher);
  const logger = createMockLogger();
  const useCase = new PullCampaignData(
    client,
    rateLimiter,
    retry,
    registry,
    events,
    logger as never,
    createFakeTracer(),
    clock.nowDate,
    minPullIntervalMs,
  );
  return { useCase, registry, publisher };
}

function insightRow(spend: string) {
  return {
    spend,
    impressions: "1000",
    reach: "500",
    clicks: "50",
    actions: [
      { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "10" },
      { action_type: "onsite_conversion.total_messaging_connection", value: "12" },
      { action_type: "onsite_conversion.lead", value: "1" },
    ],
    messaging_conversation_started: "12",
  };
}

describe("PullCampaignData (MSW-mocked Meta API)", () => {
  it("returns a fully typed AdAccount with the full campaign -> adset -> ad hierarchy on success", async () => {
    mswServer.use(
      http.get(`${BASE}/act_752604553578354/campaigns`, () =>
        HttpResponse.json({
          data: [
            {
              id: "c1",
              name: "CTWA - Cinere - Test Drive",
              objective: "OUTCOME_ENGAGEMENT",
              status: "ACTIVE",
              created_time: "2026-01-01T00:00:00+0000",
              insights: { data: [insightRow("1000000")] },
            },
          ],
        }),
      ),
      http.get(`${BASE}/c1/adsets`, () =>
        HttpResponse.json({
          data: [
            {
              id: "as1",
              name: "AdSet - Cinere",
              status: "ACTIVE",
              daily_budget: "10000000",
              insights: { data: [insightRow("500000")] },
            },
          ],
        }),
      ),
      http.get(`${BASE}/as1/ads`, () =>
        HttpResponse.json({
          data: [
            {
              id: "ad1",
              name: "Ad - Cinere 1",
              status: "ACTIVE",
              created_time: "2026-01-01T00:00:00+0000",
              insights: { data: [insightRow("250000")] },
            },
          ],
        }),
      ),
    );

    const { useCase, registry, publisher } = makeUseCase();
    const account = unwrap(await useCase.execute(baseInput()));

    expect(account.campaigns).toHaveLength(1);
    expect(account.campaigns[0]?.adSets).toHaveLength(1);
    expect(account.campaigns[0]?.adSets[0]?.ads).toHaveLength(1);
    expect(account.campaigns[0]?.stableId.toString()).toBe("#A001");
    expect(account.campaigns[0]?.adSets[0]?.stableId.toString()).toBe("#B001");
    expect(account.campaigns[0]?.adSets[0]?.ads[0]?.stableId.toString()).toBe("#C001");
    expect(account.campaigns[0]?.adSets[0]?.ads[0]?.verdict).toBeDefined();

    // Registry indexed the account and its ad.
    expect(registry.findById(account.id).some).toBe(true);
    expect(registry.resolveAdByMetaId("ad1").some).toBe(true);

    // SyncCompleted was published.
    expect(publisher.published.some((p) => p.type === "aaos.meta.sync.completed")).toBe(true);
  });

  it("paginates across more than 100 campaigns (cursor-based)", async () => {
    let callCount = 0;
    mswServer.use(
      http.get(`${BASE}/act_752604553578354/campaigns`, ({ request }) => {
        callCount += 1;
        const url = new URL(request.url);
        const after = url.searchParams.get("after");
        if (after === null) {
          return HttpResponse.json({
            data: [
              {
                id: "c1",
                name: "Campaign 1",
                objective: "OUTCOME_ENGAGEMENT",
                status: "ACTIVE",
                insights: { data: [insightRow("100")] },
              },
            ],
            paging: {
              cursors: { after: "page-2" },
              next: `${BASE}/act_752604553578354/campaigns?after=page-2`,
            },
          });
        }
        return HttpResponse.json({
          data: [
            {
              id: "c2",
              name: "Campaign 2",
              objective: "OUTCOME_ENGAGEMENT",
              status: "ACTIVE",
              insights: { data: [insightRow("200")] },
            },
          ],
        });
      }),
      http.get(`${BASE}/c1/adsets`, () => HttpResponse.json({ data: [] })),
      http.get(`${BASE}/c2/adsets`, () => HttpResponse.json({ data: [] })),
    );

    const { useCase } = makeUseCase();
    const account = unwrap(await useCase.execute(baseInput()));
    expect(account.campaigns).toHaveLength(2);
    expect(callCount).toBe(2);
  });

  it("returns an empty-hierarchy AdAccount for an account with 0 campaigns", async () => {
    mswServer.use(
      http.get(`${BASE}/act_752604553578354/campaigns`, () => HttpResponse.json({ data: [] })),
    );
    const { useCase } = makeUseCase();
    const account = unwrap(await useCase.execute(baseInput()));
    expect(account.campaigns).toEqual([]);
  });

  it("returns a campaign with 0 adsets and cascades to 0 ads (edge case)", async () => {
    mswServer.use(
      http.get(`${BASE}/act_752604553578354/campaigns`, () =>
        HttpResponse.json({
          data: [
            {
              id: "c1",
              name: "Empty Campaign",
              objective: "OUTCOME_ENGAGEMENT",
              status: "ACTIVE",
              insights: { data: [insightRow("0")] },
            },
          ],
        }),
      ),
      http.get(`${BASE}/c1/adsets`, () => HttpResponse.json({ data: [] })),
    );
    const { useCase } = makeUseCase();
    const account = unwrap(await useCase.execute(baseInput()));
    expect(account.campaigns[0]?.adSets).toEqual([]);
  });

  it("returns Result.err(MetaApiError) and publishes SyncFailed on a Meta API error response", async () => {
    mswServer.use(
      http.get(`${BASE}/act_752604553578354/campaigns`, () =>
        HttpResponse.json({ error: { message: "invalid token", code: 190 } }, { status: 401 }),
      ),
    );
    const { useCase, publisher } = makeUseCase();
    const result = await useCase.execute(baseInput());
    expect(result.ok).toBe(false);
    expect(publisher.published.some((p) => p.type === "aaos.meta.sync.failed")).toBe(true);
  });

  it("rejects an invalid datePreset without making any HTTP call", async () => {
    const { useCase } = makeUseCase();
    const result = await useCase.execute(baseInput({ datePreset: "last_99d" as never }));
    expect(unwrapErr(result).message).toMatch(/datePreset/);
  });

  it("computes an ad's rphD3 safely (not NaN/Infinity) for an ad with 0 spend", async () => {
    mswServer.use(
      http.get(`${BASE}/act_752604553578354/campaigns`, () =>
        HttpResponse.json({
          data: [
            {
              id: "c1",
              name: "Campaign",
              objective: "OUTCOME_ENGAGEMENT",
              status: "ACTIVE",
              insights: { data: [insightRow("0")] },
            },
          ],
        }),
      ),
      http.get(`${BASE}/c1/adsets`, () =>
        HttpResponse.json({
          data: [
            { id: "as1", name: "AdSet", status: "ACTIVE", insights: { data: [{ spend: "0" }] } },
          ],
        }),
      ),
      http.get(`${BASE}/as1/ads`, () =>
        HttpResponse.json({
          data: [
            {
              id: "ad1",
              name: "Ad",
              status: "ACTIVE",
              created_time: "2026-01-01T00:00:00+0000",
              insights: { data: [{ spend: "0" }] },
            },
          ],
        }),
      ),
    );
    const { useCase } = makeUseCase();
    const account = unwrap(await useCase.execute(baseInput()));
    const rphD3 = account.campaigns[0]?.adSets[0]?.ads[0]?.metrics.rphD3.value;
    expect(rphD3).toBeNull();
  });

  it("maps a campaign with an unrecognized objective to UNKNOWN rather than failing the whole sync (real bug fix: this used to abort every campaign in the ad account over one unrecognized objective — see CampaignObjective.ts's docstring)", async () => {
    mswServer.use(
      http.get(`${BASE}/act_752604553578354/campaigns`, () =>
        HttpResponse.json({
          data: [
            {
              id: "c1",
              name: "Campaign",
              objective: "BOGUS_OBJECTIVE",
              status: "ACTIVE",
              insights: { data: [insightRow("0")] },
            },
          ],
        }),
      ),
      http.get(`${BASE}/c1/adsets`, () => HttpResponse.json({ data: [] })),
    );
    const { useCase } = makeUseCase();
    const account = unwrap(await useCase.execute(baseInput()));
    expect(account.campaigns[0]?.objective).toBe(CampaignObjective.UNKNOWN);
  });

  it("propagates a getAdSets transport failure while hydrating a campaign", async () => {
    mswServer.use(
      http.get(`${BASE}/act_752604553578354/campaigns`, () =>
        HttpResponse.json({
          data: [
            {
              id: "c1",
              name: "Campaign",
              objective: "OUTCOME_ENGAGEMENT",
              status: "ACTIVE",
              insights: { data: [insightRow("0")] },
            },
          ],
        }),
      ),
      http.get(`${BASE}/c1/adsets`, () => new HttpResponse(null, { status: 500 })),
    );
    const { useCase } = makeUseCase();
    const result = await useCase.execute(baseInput());
    expect(result.ok).toBe(false);
  });

  it("propagates an adset mapping failure (unrecognized status) as Result.err", async () => {
    mswServer.use(
      http.get(`${BASE}/act_752604553578354/campaigns`, () =>
        HttpResponse.json({
          data: [
            {
              id: "c1",
              name: "Campaign",
              objective: "OUTCOME_ENGAGEMENT",
              status: "ACTIVE",
              insights: { data: [insightRow("0")] },
            },
          ],
        }),
      ),
      http.get(`${BASE}/c1/adsets`, () =>
        HttpResponse.json({ data: [{ id: "as1", name: "AdSet", status: "BOGUS_STATUS" }] }),
      ),
    );
    const { useCase } = makeUseCase();
    const result = await useCase.execute(baseInput());
    expect(unwrapErr(result).message).toMatch(/status/);
  });

  it("propagates a getAds transport failure while hydrating an adset", async () => {
    mswServer.use(
      http.get(`${BASE}/act_752604553578354/campaigns`, () =>
        HttpResponse.json({
          data: [
            {
              id: "c1",
              name: "Campaign",
              objective: "OUTCOME_ENGAGEMENT",
              status: "ACTIVE",
              insights: { data: [insightRow("0")] },
            },
          ],
        }),
      ),
      http.get(`${BASE}/c1/adsets`, () =>
        HttpResponse.json({
          data: [
            { id: "as1", name: "AdSet", status: "ACTIVE", insights: { data: [insightRow("0")] } },
          ],
        }),
      ),
      http.get(`${BASE}/as1/ads`, () => new HttpResponse(null, { status: 500 })),
    );
    const { useCase } = makeUseCase();
    const result = await useCase.execute(baseInput());
    expect(result.ok).toBe(false);
  });

  it("propagates an ad mapping failure (unrecognized status) as Result.err", async () => {
    mswServer.use(
      http.get(`${BASE}/act_752604553578354/campaigns`, () =>
        HttpResponse.json({
          data: [
            {
              id: "c1",
              name: "Campaign",
              objective: "OUTCOME_ENGAGEMENT",
              status: "ACTIVE",
              insights: { data: [insightRow("0")] },
            },
          ],
        }),
      ),
      http.get(`${BASE}/c1/adsets`, () =>
        HttpResponse.json({
          data: [
            { id: "as1", name: "AdSet", status: "ACTIVE", insights: { data: [insightRow("0")] } },
          ],
        }),
      ),
      http.get(`${BASE}/as1/ads`, () =>
        HttpResponse.json({
          data: [
            {
              id: "ad1",
              name: "Ad",
              status: "BOGUS_STATUS",
              created_time: "2026-01-01T00:00:00+0000",
            },
          ],
        }),
      ),
    );
    const { useCase } = makeUseCase();
    const result = await useCase.execute(baseInput());
    expect(unwrapErr(result).message).toMatch(/status/);
  });

  it("propagates an AdAccount construction failure (e.g. an explicitly empty businessManagerId)", async () => {
    mswServer.use(
      http.get(`${BASE}/act_752604553578354/campaigns`, () => HttpResponse.json({ data: [] })),
    );
    const { useCase } = makeUseCase();
    const result = await useCase.execute(baseInput({ businessManagerId: "" }));
    expect(unwrapErr(result).message).toMatch(/businessManagerId/);
  });

  it("defaults `now` to the real wall clock when not injected", async () => {
    mswServer.use(
      http.get(`${BASE}/act_752604553578354/campaigns`, () => HttpResponse.json({ data: [] })),
    );
    const client = new MetaApiClient();
    const rateLimiter = new TokenBucketRateLimiter();
    const retry = new ExponentialBackoffRetry({ sleep: async () => undefined });
    const registry = new AdAccountRegistry();
    const publisher = createFakePublisher();
    const events = new MetaAdsConnectorEvents(publisher);
    const logger = createMockLogger();
    const useCase = new PullCampaignData(
      client,
      rateLimiter,
      retry,
      registry,
      events,
      logger as never,
      createFakeTracer(),
    );
    const before = Date.now();
    const account = unwrap(await useCase.execute(baseInput()));
    expect(account.syncedAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});

/**
 * N+1-fanout fix (real, currently-broken-in-production "User request limit reached" incident) —
 * the whole point of this fix is a single field-expansion `campaigns` call replacing the old
 * campaigns + per-campaign adsets + per-adset ads fanout. `mswServer.listen({onUnhandledRequest:
 * "error"})` (set at this file's top) makes that provable directly: if `PullCampaignData` ever
 * fell back to the old per-campaign/per-adset endpoints when it didn't need to, the test would
 * fail loudly on the unhandled request rather than silently passing.
 */
describe("PullCampaignData — N+1-fanout fix (field expansion + honest overflow fallback)", () => {
  it("resolves the full campaign -> adset -> ad tree from ONE HTTP call when the expansion response is complete (no fallback fanout at all)", async () => {
    let campaignsCallCount = 0;
    mswServer.use(
      http.get(`${BASE}/act_752604553578354/campaigns`, ({ request }) => {
        campaignsCallCount += 1;
        const url = new URL(request.url);
        expect(url.searchParams.get("fields")).toContain("adsets.limit(50){");
        return HttpResponse.json({
          data: [
            {
              id: "c1",
              name: "CTWA - Cinere - Test Drive",
              objective: "OUTCOME_ENGAGEMENT",
              status: "ACTIVE",
              created_time: "2026-01-01T00:00:00+0000",
              insights: { data: [insightRow("1000000")] },
              adsets: {
                data: [
                  {
                    id: "as1",
                    name: "AdSet - Cinere",
                    status: "ACTIVE",
                    daily_budget: "10000000",
                    insights: { data: [insightRow("500000")] },
                    ads: {
                      data: [
                        {
                          id: "ad1",
                          name: "Ad - Cinere 1",
                          status: "ACTIVE",
                          created_time: "2026-01-01T00:00:00+0000",
                          insights: { data: [insightRow("250000")] },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        });
      }),
      // Deliberately NO handlers for `/c1/adsets` or `/as1/ads` — if PullCampaignData fell back to
      // them unnecessarily, `onUnhandledRequest: "error"` fails this test.
    );

    const { useCase } = makeUseCase();
    const account = unwrap(await useCase.execute(baseInput()));

    expect(campaignsCallCount).toBe(1);
    expect(account.campaigns).toHaveLength(1);
    expect(account.campaigns[0]?.adSets).toHaveLength(1);
    expect(account.campaigns[0]?.adSets[0]?.ads).toHaveLength(1);
    expect(account.campaigns[0]?.adSets[0]?.ads[0]?.metaId).toBe("ad1");
    expect(account.campaigns[0]?.stableId.toString()).toBe("#A001");
  });

  it("falls back to the dedicated getAdSets call for a campaign whose nested adsets edge overflowed (paging.next present) — no data lost", async () => {
    mswServer.use(
      http.get(`${BASE}/act_752604553578354/campaigns`, () =>
        HttpResponse.json({
          data: [
            {
              id: "c1",
              name: "Campaign",
              objective: "OUTCOME_ENGAGEMENT",
              status: "ACTIVE",
              insights: { data: [insightRow("0")] },
              adsets: {
                data: [{ id: "as1", name: "AdSet (partial page)", status: "ACTIVE" }],
                paging: { cursors: { after: "page-2" }, next: `${BASE}/c1/adsets?after=page-2` },
              },
            },
          ],
        }),
      ),
      // Fallback: the pre-existing dedicated, fully-paginated getAdSets edge call — returns the
      // REAL, complete 2-adset list the overflowed nested page didn't fit.
      http.get(`${BASE}/c1/adsets`, () =>
        HttpResponse.json({
          data: [
            { id: "as1", name: "AdSet 1 (full)", status: "ACTIVE" },
            { id: "as2", name: "AdSet 2 (full)", status: "ACTIVE" },
          ],
        }),
      ),
      http.get(`${BASE}/as1/ads`, () => HttpResponse.json({ data: [] })),
      http.get(`${BASE}/as2/ads`, () => HttpResponse.json({ data: [] })),
    );

    const { useCase } = makeUseCase();
    const account = unwrap(await useCase.execute(baseInput()));

    // The overflow fallback replaced the partial 1-item nested page with the real, complete 2-item
    // list — no data lost to the expansion's own page size.
    expect(account.campaigns[0]?.adSets).toHaveLength(2);
    expect(account.campaigns[0]?.adSets.map((a) => a.name)).toEqual([
      "AdSet 1 (full)",
      "AdSet 2 (full)",
    ]);
  });

  it("falls back to the dedicated getAds call for an adset whose nested ads edge overflowed — no data lost", async () => {
    mswServer.use(
      http.get(`${BASE}/act_752604553578354/campaigns`, () =>
        HttpResponse.json({
          data: [
            {
              id: "c1",
              name: "Campaign",
              objective: "OUTCOME_ENGAGEMENT",
              status: "ACTIVE",
              insights: { data: [insightRow("0")] },
              adsets: {
                data: [
                  {
                    id: "as1",
                    name: "AdSet",
                    status: "ACTIVE",
                    insights: { data: [insightRow("0")] },
                    ads: {
                      data: [
                        {
                          id: "ad1",
                          name: "Ad 1 (partial page)",
                          status: "ACTIVE",
                          created_time: "2026-01-01T00:00:00+0000",
                        },
                      ],
                      paging: {
                        cursors: { after: "page-2" },
                        next: `${BASE}/as1/ads?after=page-2`,
                      },
                    },
                  },
                ],
              },
            },
          ],
        }),
      ),
      // Fallback: the pre-existing dedicated, fully-paginated getAds edge call.
      http.get(`${BASE}/as1/ads`, () =>
        HttpResponse.json({
          data: [
            {
              id: "ad1",
              name: "Ad 1 (full)",
              status: "ACTIVE",
              created_time: "2026-01-01T00:00:00+0000",
            },
            {
              id: "ad2",
              name: "Ad 2 (full)",
              status: "ACTIVE",
              created_time: "2026-01-01T00:00:00+0000",
            },
          ],
        }),
      ),
    );

    const { useCase } = makeUseCase();
    const account = unwrap(await useCase.execute(baseInput()));

    expect(account.campaigns[0]?.adSets[0]?.ads).toHaveLength(2);
    expect(account.campaigns[0]?.adSets[0]?.ads.map((a) => a.name)).toEqual([
      "Ad 1 (full)",
      "Ad 2 (full)",
    ]);
  });
});

/**
 * Real, currently-broken-in-production compounding-pulls fix — the per-ad-account minimum-pull-
 * interval guard (`PullCampaignData.checkPullInterval`). This is the single real choke point
 * every call site in `apps/aaos-api` goes through for a live Meta pull (the 15-minute cron sweep,
 * the realtime post-campaign-action hook, and the manual "Tarik Data Baru"/dashboard-mount pull),
 * so guarding it here is the real fix for those independently-triggered pulls compounding into
 * near-simultaneous real Meta traffic for one tenant.
 */
describe("PullCampaignData — per-ad-account minimum-pull-interval guard", () => {
  it("blocks a second pull for the SAME ad account within the interval, with NO HTTP call at all", async () => {
    const clock = new TestClock("2026-02-15T00:00:00.000Z");
    mswServer.use(
      http.get(`${BASE}/act_752604553578354/campaigns`, () => HttpResponse.json({ data: [] })),
    );
    const { useCase } = makeUseCaseWithClock(clock, 60_000);

    const first = await useCase.execute(baseInput());
    expect(first.ok).toBe(true);

    // No new mock handler registered for a second `campaigns` call — if the guard failed to block
    // it, `onUnhandledRequest: "error"` would fail this test loudly.
    const second = await useCase.execute(baseInput());
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toBeInstanceOf(RateLimitError);
      expect((second.error as RateLimitError).retryAfterMs).toBeGreaterThan(0);
      expect((second.error as RateLimitError).retryAfterMs).toBeLessThanOrEqual(60_000);
    }
  });

  it("allows a second pull once the minimum interval has genuinely elapsed", async () => {
    const clock = new TestClock("2026-02-15T00:00:00.000Z");
    mswServer.use(
      http.get(`${BASE}/act_752604553578354/campaigns`, () => HttpResponse.json({ data: [] })),
    );
    const { useCase } = makeUseCaseWithClock(clock, 60_000);

    expect((await useCase.execute(baseInput())).ok).toBe(true);
    clock.advanceMs(60_000);
    expect((await useCase.execute(baseInput())).ok).toBe(true);
  });

  it("does NOT block a pull for a DIFFERENT ad account (keyed per ad account, not globally)", async () => {
    const clock = new TestClock("2026-02-15T00:00:00.000Z");
    mswServer.use(
      http.get(`${BASE}/act_752604553578354/campaigns`, () => HttpResponse.json({ data: [] })),
      http.get(`${BASE}/act_999999999999999/campaigns`, () => HttpResponse.json({ data: [] })),
    );
    const { useCase } = makeUseCaseWithClock(clock, 60_000);

    expect((await useCase.execute(baseInput())).ok).toBe(true);
    expect(
      (
        await useCase.execute(
          baseInput({ adAccountId: unwrap(AdAccountId.create("act_999999999999999")) }),
        )
      ).ok,
    ).toBe(true);
  });

  it("defaults to a 60s minimum interval when not configured", async () => {
    const clock = new TestClock("2026-02-15T00:00:00.000Z");
    mswServer.use(
      http.get(`${BASE}/act_752604553578354/campaigns`, () => HttpResponse.json({ data: [] })),
    );
    const { useCase } = makeUseCaseWithClock(clock);

    expect((await useCase.execute(baseInput())).ok).toBe(true);
    clock.advanceMs(59_000);
    expect((await useCase.execute(baseInput())).ok).toBe(false);
    clock.advanceMs(1_001);
    expect((await useCase.execute(baseInput())).ok).toBe(true);
  });
});

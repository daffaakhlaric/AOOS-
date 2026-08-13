import { err, ok } from "@aos/common";
import { createMockLogger } from "@aos/testing";
import { describe, expect, it, vi } from "vitest";

import {
  CreateCampaign,
  DEFAULT_DAILY_BUDGET_IDR,
} from "../../../../src/application/use-cases/CreateCampaign.js";
import type { IMetaAdsClient } from "../../../../src/contracts/IMetaAdsClient.js";
import { ApiServerError } from "../../../../src/domain/errors/index.js";
import { MetaAdsConnectorEvents } from "../../../../src/domain/events/MetaAdsConnectorEvents.js";
import { AdAccountId } from "../../../../src/domain/value-objects/AdAccountId.js";
import { Branch } from "../../../../src/domain/value-objects/Branch.js";
import { Funnel } from "../../../../src/domain/value-objects/Funnel.js";
import { TokenBucketRateLimiter } from "../../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { ExponentialBackoffRetry } from "../../../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { unwrap } from "../../../helpers/result.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

function fakeClient(overrides: Partial<IMetaAdsClient> = {}): IMetaAdsClient {
  return {
    getCampaigns: vi.fn(),
    getAdSets: vi.fn(),
    getAds: vi.fn(),
    pauseAd: vi.fn(),
    scaleAdSetBudget: vi.fn(),
    fixCampaignObjective: vi.fn(),
    createCampaign: vi.fn().mockResolvedValue(ok({ id: "new-campaign-1" })),
    createAdSet: vi.fn().mockResolvedValue(ok({ id: "new-adset-1" })),
    ...overrides,
  } as unknown as IMetaAdsClient;
}

function makeUseCase(client: IMetaAdsClient) {
  const publisher = createFakePublisher();
  const events = new MetaAdsConnectorEvents(publisher);
  const useCase = new CreateCampaign(
    client,
    new TokenBucketRateLimiter(),
    new ExponentialBackoffRetry({ sleep: async () => undefined }),
    events,
    createMockLogger() as never,
    createFakeTracer(),
    () => new Date("2026-04-01T00:00:00.000Z"),
  );
  return { useCase, publisher };
}

const adAccountId = unwrap(AdAccountId.create("act_752604553578354"));

describe("CreateCampaign (AAOS-W1D-S3)", () => {
  it("creates the campaign with objective=OUTCOME_LEADS, special_ad_categories=[], status=PAUSED", async () => {
    const client = fakeClient();
    const { useCase } = makeUseCase(client);
    await useCase.execute({
      adAccountId,
      name: "Meta-CTWA-Leads-Mobix-Cinere",
      branch: Branch.CINERE,
      funnel: Funnel.CTWA,
      accessToken: "TOKEN",
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(client.createCampaign).toHaveBeenCalledWith(
      "act_752604553578354",
      {
        name: "Meta-CTWA-Leads-Mobix-Cinere",
        objective: "OUTCOME_LEADS",
        specialAdCategories: [],
        status: "PAUSED",
      },
      "TOKEN",
    );
  });

  it("creates the adset with destination_type=WHATSAPP, optimization_goal=LEAD_GENERATION, billing_event=IMPRESSIONS, status=PAUSED", async () => {
    const client = fakeClient();
    const { useCase } = makeUseCase(client);
    await useCase.execute({
      adAccountId,
      name: "Meta-CTWA-Leads-Mobix-Cinere",
      branch: Branch.CINERE,
      funnel: Funnel.CTWA,
      accessToken: "TOKEN",
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(client.createAdSet).toHaveBeenCalledWith(
      "act_752604553578354",
      {
        campaignId: "new-campaign-1",
        name: "Meta-CTWA-Leads-Mobix-Cinere-adset",
        destinationType: "WHATSAPP",
        optimizationGoal: "LEAD_GENERATION",
        billingEvent: "IMPRESSIONS",
        dailyBudgetCents: DEFAULT_DAILY_BUDGET_IDR * 100,
        status: "PAUSED",
      },
      "TOKEN",
    );
  });

  it("uses the caller-supplied dailyBudgetIDR (converted to cents) instead of the default when provided", async () => {
    const client = fakeClient();
    const { useCase } = makeUseCase(client);
    await useCase.execute({
      adAccountId,
      name: "Custom Budget Campaign",
      branch: Branch.BINTARO,
      funnel: Funnel.CTWA,
      accessToken: "TOKEN",
      tenantId: "t1",
      correlationId: "c1",
      dailyBudgetIDR: 250_000,
    });
    expect(client.createAdSet).toHaveBeenCalledWith(
      "act_752604553578354",
      expect.objectContaining({ dailyBudgetCents: 25_000_000 }),
      "TOKEN",
    );
  });

  it("emits NewCampaignCreated with the new campaignId/adSetId after both creations succeed", async () => {
    const client = fakeClient();
    const { useCase, publisher } = makeUseCase(client);
    const result = unwrap(
      await useCase.execute({
        adAccountId,
        name: "Meta-CTWA-Leads-Mobix-Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
        accessToken: "TOKEN",
        tenantId: "t1",
        correlationId: "c1",
      }),
    );
    expect(result).toEqual({ campaignId: "new-campaign-1", adSetId: "new-adset-1" });
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]?.type).toBe("aaos.meta.campaign.created");
    const payload = publisher.published[0]?.payload as {
      campaignId: string;
      adSetId: string;
      branch: string;
      funnel: string;
    };
    expect(payload.campaignId).toBe("new-campaign-1");
    expect(payload.adSetId).toBe("new-adset-1");
    expect(payload.branch).toBe(Branch.CINERE);
    expect(payload.funnel).toBe(Funnel.CTWA);
  });

  it("returns the error and does NOT call createAdSet when campaign creation fails", async () => {
    const client = fakeClient({
      createCampaign: vi
        .fn()
        .mockResolvedValue(err(new ApiServerError("boom", { httpStatus: 500 }))),
    });
    const { useCase, publisher } = makeUseCase(client);
    const result = await useCase.execute({
      adAccountId,
      name: "Fails",
      branch: Branch.UMUM,
      funnel: Funnel.CTWA,
      accessToken: "TOKEN",
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(result.ok).toBe(false);
    expect(client.createAdSet).not.toHaveBeenCalled();
    expect(publisher.published).toHaveLength(0);
  });

  it("defaults `now` to the real wall clock when not injected", async () => {
    const client = fakeClient();
    const publisher = createFakePublisher();
    const events = new MetaAdsConnectorEvents(publisher);
    const useCase = new CreateCampaign(
      client,
      new TokenBucketRateLimiter(),
      new ExponentialBackoffRetry({ sleep: async () => undefined }),
      events,
      createMockLogger() as never,
      createFakeTracer(),
    );
    const before = Date.now();
    await useCase.execute({
      adAccountId,
      name: "Default Clock",
      branch: Branch.CINERE,
      funnel: Funnel.CTWA,
      accessToken: "TOKEN",
      tenantId: "t1",
      correlationId: "c1",
    });
    const payload = publisher.published[0]?.payload as { occurredAt: Date };
    expect(payload.occurredAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("DEFAULT_DAILY_BUDGET_IDR is a positive whole-IDR amount", () => {
    expect(DEFAULT_DAILY_BUDGET_IDR).toBeGreaterThan(0);
    expect(Number.isInteger(DEFAULT_DAILY_BUDGET_IDR)).toBe(true);
  });

  it("dailyBudgetIDR of 0 is treated as caller-supplied (not defaulted) since it's a valid, if unusual, override", async () => {
    const client = fakeClient();
    const { useCase } = makeUseCase(client);
    await useCase.execute({
      adAccountId,
      name: "Zero Budget",
      branch: Branch.UMUM,
      funnel: Funnel.CTWA,
      accessToken: "TOKEN",
      tenantId: "t1",
      correlationId: "c1",
      dailyBudgetIDR: 0,
    });
    // `0 ?? DEFAULT` is 0 in JS (only null/undefined trigger `??`'s fallback) — pins that
    // behavior explicitly rather than leaving it as an easily-broken implicit assumption.
    expect(client.createAdSet).toHaveBeenCalledWith(
      "act_752604553578354",
      expect.objectContaining({ dailyBudgetCents: 0 }),
      "TOKEN",
    );
  });

  it("returns the error and does NOT emit an event when adset creation fails after campaign creation succeeded", async () => {
    const client = fakeClient({
      createAdSet: vi.fn().mockResolvedValue(err(new ApiServerError("boom", { httpStatus: 500 }))),
    });
    const { useCase, publisher } = makeUseCase(client);
    const result = await useCase.execute({
      adAccountId,
      name: "Adset Fails",
      branch: Branch.UMUM,
      funnel: Funnel.CTWA,
      accessToken: "TOKEN",
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(result.ok).toBe(false);
    expect(client.createCampaign).toHaveBeenCalled();
    expect(publisher.published).toHaveLength(0);
  });
});

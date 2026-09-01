import { createMockLogger } from "@aos/testing";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  CreateCampaign,
  DEFAULT_DAILY_BUDGET_IDR,
} from "../../../src/application/use-cases/CreateCampaign.js";
import { MetaAdsConnectorEvents } from "../../../src/domain/events/MetaAdsConnectorEvents.js";
import { AdAccountId } from "../../../src/domain/value-objects/AdAccountId.js";
import { Branch } from "../../../src/domain/value-objects/Branch.js";
import { Funnel } from "../../../src/domain/value-objects/Funnel.js";
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
const adAccountId = unwrap(AdAccountId.create("act_752604553578354"));

function makeUseCase() {
  const client = new MetaApiClient();
  const rateLimiter = new TokenBucketRateLimiter();
  const retry = new ExponentialBackoffRetry({ sleep: async () => undefined });
  const publisher = createFakePublisher();
  const events = new MetaAdsConnectorEvents(publisher);
  const logger = createMockLogger();
  const useCase = new CreateCampaign(
    client,
    rateLimiter,
    retry,
    events,
    logger as never,
    createFakeTracer(),
    () => new Date("2026-04-01T00:00:00.000Z"),
  );
  return { useCase, publisher };
}

/**
 * AAOS-W1D-S3 pinned business correctness, exercised over the real MSW-mocked Meta Graph API
 * (not just the fake-client unit tests): CreateCampaign's exact POST bodies for both the
 * campaign and the ad set, and that a NewCampaignCreated event is emitted only after both
 * succeed.
 */
describe("CreateCampaign (MSW-mocked Meta API)", () => {
  it("POSTs the exact campaign body (objective=OUTCOME_LEADS, status=PAUSED) then the exact adset body (destination_type=WHATSAPP, status=PAUSED), and emits NewCampaignCreated", async () => {
    let campaignBody: unknown;
    let adSetBody: unknown;
    mswServer.use(
      http.post(`${BASE}/act_752604553578354/campaigns`, async ({ request }) => {
        campaignBody = await request.json();
        return HttpResponse.json({ id: "120000000000099" });
      }),
      http.post(`${BASE}/act_752604553578354/adsets`, async ({ request }) => {
        adSetBody = await request.json();
        return HttpResponse.json({ id: "120000000000100" });
      }),
    );
    const { useCase, publisher } = makeUseCase();

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

    expect(result).toEqual({ campaignId: "120000000000099", adSetId: "120000000000100" });

    expect(campaignBody).toEqual({
      name: "Meta-CTWA-Leads-Mobix-Cinere",
      objective: "OUTCOME_LEADS",
      special_ad_categories: [],
      status: "PAUSED",
      access_token: "TOKEN",
    });

    expect(adSetBody).toEqual({
      campaign_id: "120000000000099",
      name: "Meta-CTWA-Leads-Mobix-Cinere-adset",
      destination_type: "WHATSAPP",
      optimization_goal: "LEAD_GENERATION",
      billing_event: "IMPRESSIONS",
      daily_budget: DEFAULT_DAILY_BUDGET_IDR * 100,
      status: "PAUSED",
      access_token: "TOKEN",
    });

    expect(publisher.published.some((p) => p.type === "aaos.meta.campaign.created")).toBe(true);
    const event = publisher.published.find((p) => p.type === "aaos.meta.campaign.created");
    expect(event?.payload).toMatchObject({
      campaignId: "120000000000099",
      adSetId: "120000000000100",
      adAccountId: "act_752604553578354",
    });
  });

  it("AAOS EPIC S Phase S1 zero-regression (MSW-mocked real Meta API): omitting specialAdCategories/targeting produces byte-for-byte the SAME real request bodies as before this change — no `targeting` key at all in the adset body", async () => {
    let campaignBody: unknown;
    let adSetBody: unknown;
    mswServer.use(
      http.post(`${BASE}/act_752604553578354/campaigns`, async ({ request }) => {
        campaignBody = await request.json();
        return HttpResponse.json({ id: "120000000000099" });
      }),
      http.post(`${BASE}/act_752604553578354/adsets`, async ({ request }) => {
        adSetBody = await request.json();
        return HttpResponse.json({ id: "120000000000100" });
      }),
    );
    const { useCase } = makeUseCase();

    await useCase.execute({
      adAccountId,
      name: "Meta-CTWA-Leads-Mobix-Cinere",
      branch: Branch.CINERE,
      funnel: Funnel.CTWA,
      accessToken: "TOKEN",
      tenantId: "t1",
      correlationId: "c1",
    });

    expect(campaignBody).toEqual({
      name: "Meta-CTWA-Leads-Mobix-Cinere",
      objective: "OUTCOME_LEADS",
      special_ad_categories: [],
      status: "PAUSED",
      access_token: "TOKEN",
    });
    expect(adSetBody).toEqual({
      campaign_id: "120000000000099",
      name: "Meta-CTWA-Leads-Mobix-Cinere-adset",
      destination_type: "WHATSAPP",
      optimization_goal: "LEAD_GENERATION",
      billing_event: "IMPRESSIONS",
      daily_budget: DEFAULT_DAILY_BUDGET_IDR * 100,
      status: "PAUSED",
      access_token: "TOKEN",
    });
    expect(adSetBody).not.toHaveProperty("targeting");
  });

  it("AAOS EPIC S Phase S1 (MSW-mocked real Meta API): a real HOUSING campaign's adset body carries geo_locations but omits age_min/age_max/genders, per Meta's real verified hard-error policy", async () => {
    let adSetBody: unknown;
    mswServer.use(
      http.post(`${BASE}/act_752604553578354/campaigns`, () =>
        HttpResponse.json({ id: "120000000000099" }),
      ),
      http.post(`${BASE}/act_752604553578354/adsets`, async ({ request }) => {
        adSetBody = await request.json();
        return HttpResponse.json({ id: "120000000000100" });
      }),
    );
    const { useCase } = makeUseCase();

    await useCase.execute({
      adAccountId,
      name: "PROPERTY-Cinere-HOUSING",
      branch: Branch.CINERE,
      funnel: Funnel.CTWA,
      accessToken: "TOKEN",
      tenantId: "t1",
      correlationId: "c1",
      specialAdCategories: ["HOUSING"],
      targeting: {
        geoLocations: { cities: [{ key: "2447439", radius: 15, distanceUnit: "mile" }] },
        ageMin: 25,
        ageMax: 45,
        genders: [1, 2],
      },
    });

    expect(adSetBody).toEqual({
      campaign_id: "120000000000099",
      name: "PROPERTY-Cinere-HOUSING-adset",
      destination_type: "WHATSAPP",
      optimization_goal: "LEAD_GENERATION",
      billing_event: "IMPRESSIONS",
      daily_budget: DEFAULT_DAILY_BUDGET_IDR * 100,
      status: "PAUSED",
      targeting: {
        geo_locations: { cities: [{ key: "2447439", radius: 15, distance_unit: "mile" }] },
      },
      access_token: "TOKEN",
    });
  });

  it("does not emit an event and propagates the error when Meta rejects the campaign creation", async () => {
    mswServer.use(
      http.post(`${BASE}/act_752604553578354/campaigns`, () =>
        HttpResponse.json({ error: { message: "invalid", code: 100 } }, { status: 400 }),
      ),
    );
    const { useCase, publisher } = makeUseCase();
    const result = await useCase.execute({
      adAccountId,
      name: "Will Fail",
      branch: Branch.UMUM,
      funnel: Funnel.CTWA,
      accessToken: "TOKEN",
      tenantId: "t1",
      correlationId: "c1",
    });
    expect(result.ok).toBe(false);
    expect(publisher.published).toHaveLength(0);
  });
});

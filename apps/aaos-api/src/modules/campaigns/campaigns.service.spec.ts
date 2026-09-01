import { ok } from "@aos/common";
import { NotFoundError, ValidationError } from "@aos/errors";
import { Branch, Funnel, MetaAdsConnectorFactory } from "@aos/meta-ads-connector";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { toConnectorConfig } from "../../config/to-connector-config.js";
import { createFakePublisher } from "../../test-support/fake-publisher.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import {
  mswServer,
  registerCreateCampaignErrorHandler,
  registerCreateCampaignMswHandlers,
  registerSearchAdLocationsMswHandler,
} from "../../test-support/meta-api-msw.js";
import type { ListingsService } from "../listings/listings.service.js";
import type {
  LocationResolverService,
  ResolvedLocation,
} from "../location-resolver/location-resolver.service.js";

import { CampaignsService } from "./campaigns.service.js";

/** Minimal `ModeGuardService` test double — always resolves LIVE (calls `executeFn`) unless `dev: true`. */
function buildFakeModeGuard(dev = false) {
  return {
    resolveMode: async () => (dev ? "DEV" : "LIVE"),
    executeOrSimulate: async <T>(
      _tenantId: string,
      executeFn: () => Promise<T>,
      simulateFn: () => Promise<T>,
    ): Promise<T> => (dev ? simulateFn() : executeFn()),
  };
}

/** Minimal `ActivityLogger` test double (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase B) — mirrors `meta-ads.service.spec.ts`'s own fake. */
function buildFakeActivityLogger() {
  return {
    start: vi.fn(async () => "activity-1"),
    complete: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
    logToolCall: vi.fn(async () => undefined),
    logReasoning: vi.fn(async () => undefined),
  };
}

/** Real, minimal listing fixture — enough of `ListingResponseDto`'s shape for `createPropertyCampaign` to build a `LocationResolverInput` and a campaign name from. */
const DEFAULT_LISTING = {
  id: "listing-1",
  tenantId: "dss-motor",
  title: "Rumah Minimalis Bintaro",
  propertyType: "RUMAH",
  price: 1_500_000_000,
  city: "Tangerang Selatan",
};

/** Fake `ListingsService` — mirrors `creative-packages.service.spec.ts`'s own `getById` fake precedent: a real `NotFoundError` for anything but the one configured tenant+id. */
function buildFakeListings(
  listing: typeof DEFAULT_LISTING | undefined = DEFAULT_LISTING,
): ListingsService {
  return {
    getById: vi.fn(async (tenantId: string, id: string) => {
      if (listing === undefined || listing.id !== id || listing.tenantId !== tenantId) {
        throw new NotFoundError(`No listing found for id "${id}"`);
      }
      return { ...listing };
    }),
  } as unknown as ListingsService;
}

/** Fake `LocationResolverService` — returns a fixed, real-shaped `ResolvedLocation` (no real LLM call — `LocationResolverService` itself is out of scope for these tests, already covered by its own spec). */
function buildFakeLocationResolver(
  resolved: ResolvedLocation = {
    cities: ["Tangerang Selatan"],
    radiusKm: 25,
    ageMin: 27,
    ageMax: 55,
    source: "FALLBACK",
    reasoning: "test fixture",
  },
): LocationResolverService {
  return { resolve: vi.fn(async () => resolved) } as unknown as LocationResolverService;
}

function buildService(
  dev = false,
  activityLogger: ReturnType<typeof buildFakeActivityLogger> = buildFakeActivityLogger(),
  options: {
    readonly listings?: ListingsService;
    readonly locationResolver?: LocationResolverService;
  } = {},
): CampaignsService {
  const config = buildTestConfig();
  const connectorConfig = toConnectorConfig(config);
  if (!connectorConfig.ok) {
    throw new Error("test setup failed");
  }
  const connector = MetaAdsConnectorFactory.create({
    config: connectorConfig.value,
    publisher: createFakePublisher(),
  });
  const registry = {
    resolve: async () =>
      ok({
        ...connector,
        accessToken: config.META_ACCESS_TOKEN,
        adAccountIds: config.META_AD_ACCOUNT_IDS,
      }),
  };
  return new CampaignsService(
    config,
    registry as never,
    buildFakeModeGuard(dev) as never,
    activityLogger as never,
    options.listings ?? buildFakeListings(),
    options.locationResolver ?? buildFakeLocationResolver(),
  );
}

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

describe("CampaignsService.createCampaign (AAOS-W1D-S3)", () => {
  it("creates a campaign + adset and returns the new campaignId/adSetId", async () => {
    registerCreateCampaignMswHandlers({
      newCampaignId: "120000000000099",
      newAdSetId: "120000000000100",
    });
    const service = buildService();
    const dto = await service.createCampaign(
      {
        adAccountId: "act_752604553578354",
        name: "Meta-CTWA-Leads-Mobix-Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
      },
      "corr-1",
    );
    expect(dto.campaignId).toBe("120000000000099");
    expect(dto.adSetId).toBe("120000000000100");
    expect(dto.simulated).toBe(false);
  });

  it("does NOT call the real Meta API and returns simulated:true with no ids when the tenant is in DEV mode (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase A)", async () => {
    // No MSW handler registered at all — any real HTTP call would fail the test
    // (`onUnhandledRequest: "error"`), proving `executeFn` (the real Meta call) never runs.
    const service = buildService(true);
    const dto = await service.createCampaign(
      {
        adAccountId: "act_752604553578354",
        name: "Meta-CTWA-Leads-Mobix-Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
      },
      "corr-dev-1",
    );
    expect(dto).toEqual({ simulated: true });
  });

  it("passes through an explicit dailyBudgetIDR override", async () => {
    registerCreateCampaignMswHandlers();
    const service = buildService();
    const dto = await service.createCampaign(
      {
        adAccountId: "act_752604553578354",
        name: "Custom Budget",
        branch: Branch.BINTARO,
        funnel: Funnel.CTWA,
        dailyBudgetIDR: 250_000,
      },
      "corr-2",
    );
    expect(dto.campaignId).toBeDefined();
  });

  it("throws the raw AdAccountId ValidationError for a malformed adAccountId", async () => {
    const service = buildService();
    await expect(
      service.createCampaign(
        {
          adAccountId: "not-an-account",
          name: "Bad Account",
          branch: Branch.CINERE,
          funnel: Funnel.CTWA,
        },
        "corr-3",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws the raw connector error when Meta rejects the campaign creation", async () => {
    registerCreateCampaignErrorHandler(400, 100);
    const service = buildService();
    const { MetaApiError } = await import("@aos/meta-ads-connector");
    await expect(
      service.createCampaign(
        {
          adAccountId: "act_752604553578354",
          name: "Will Fail",
          branch: Branch.UMUM,
          funnel: Funnel.CTWA,
        },
        "corr-4",
      ),
    ).rejects.toBeInstanceOf(MetaApiError);
  });

  describe("ActivityLogger wiring (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase B)", () => {
    it("starts a RUNNING activity with mode LIVE and completes it SUCCESS for a real creation", async () => {
      registerCreateCampaignMswHandlers({
        newCampaignId: "120000000000099",
        newAdSetId: "120000000000100",
      });
      const activityLogger = buildFakeActivityLogger();
      const service = buildService(false, activityLogger);
      const dto = await service.createCampaign(
        {
          adAccountId: "act_752604553578354",
          name: "Meta-CTWA-Leads-Mobix-Cinere",
          branch: Branch.CINERE,
          funnel: Funnel.CTWA,
        },
        "corr-activity-live",
      );

      expect(activityLogger.start).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: "SAMANTHA",
          actionType: "CREATE_CAMPAIGN",
          mode: "LIVE",
          loopId: "corr-activity-live",
        }),
      );
      expect(activityLogger.complete).toHaveBeenCalledWith(
        "activity-1",
        expect.objectContaining({ status: "SUCCESS", output: dto }),
      );
      expect(activityLogger.fail).not.toHaveBeenCalled();
    });

    it("starts a RUNNING activity with mode DEV and completes it SIMULATED for a DEV-mode call", async () => {
      const activityLogger = buildFakeActivityLogger();
      const service = buildService(true, activityLogger);
      const dto = await service.createCampaign(
        {
          adAccountId: "act_752604553578354",
          name: "Meta-CTWA-Leads-Mobix-Cinere",
          branch: Branch.CINERE,
          funnel: Funnel.CTWA,
        },
        "corr-activity-dev",
      );

      expect(activityLogger.start).toHaveBeenCalledWith(expect.objectContaining({ mode: "DEV" }));
      expect(activityLogger.complete).toHaveBeenCalledWith(
        "activity-1",
        expect.objectContaining({ status: "SIMULATED", devPreview: dto }),
      );
      expect(activityLogger.fail).not.toHaveBeenCalled();
    });

    it("fails the activity with the real thrown error when Meta rejects the campaign creation", async () => {
      registerCreateCampaignErrorHandler(400, 100);
      const activityLogger = buildFakeActivityLogger();
      const service = buildService(false, activityLogger);
      const { MetaApiError } = await import("@aos/meta-ads-connector");
      await expect(
        service.createCampaign(
          {
            adAccountId: "act_752604553578354",
            name: "Will Fail",
            branch: Branch.UMUM,
            funnel: Funnel.CTWA,
          },
          "corr-activity-error",
        ),
      ).rejects.toBeInstanceOf(MetaApiError);

      expect(activityLogger.fail).toHaveBeenCalledWith("activity-1", expect.any(MetaApiError));
      expect(activityLogger.complete).not.toHaveBeenCalled();
    });
  });
});

describe("CampaignsService.createPropertyCampaign (AAOS EPIC S, Phase S3/S4)", () => {
  it("MANDATORY: DEV mode never calls the real Meta API (no searchAdLocations, no createCampaign, no createAdSet) and returns an honest simulated:true preview", async () => {
    // No MSW handler registered at all — `mswServer.listen({ onUnhandledRequest: "error" })`
    // means ANY real HTTP call (search OR campaign/adset creation) fails this test outright,
    // proving the entire real-Meta-touching pipeline never ran in DEV mode.
    const service = buildService(true);
    const dto = await service.createPropertyCampaign(
      "dss-motor",
      { listingId: "listing-1" },
      "corr-property-dev-1",
    );
    expect(dto.simulated).toBe(true);
    expect(dto.campaignId).toBeUndefined();
    expect(dto.adSetId).toBeUndefined();
    expect(dto.resolvedCities).toEqual(["Tangerang Selatan"]);
    expect(dto.matchedCities).toBeUndefined();
    expect(dto.unresolvedCities).toBeUndefined();
  });

  it("LIVE mode calls real Meta with specialAdCategories=['HOUSING'] and real geo-search-resolved targeting", async () => {
    registerSearchAdLocationsMswHandler({
      "Tangerang Selatan": [{ key: "2360586", name: "Tangerang Selatan, Banten" }],
    });
    let capturedCampaignBody: unknown;
    let capturedAdSetBody: unknown;
    mswServer.use(
      http.post("https://graph.facebook.com/v21.0/:adAccountId/campaigns", async ({ request }) => {
        capturedCampaignBody = await request.json();
        return HttpResponse.json({ id: "120000000000099" });
      }),
      http.post("https://graph.facebook.com/v21.0/:adAccountId/adsets", async ({ request }) => {
        capturedAdSetBody = await request.json();
        return HttpResponse.json({ id: "120000000000100" });
      }),
    );

    const service = buildService();
    const dto = await service.createPropertyCampaign(
      "dss-motor",
      { listingId: "listing-1" },
      "corr-property-live-1",
    );

    expect(dto.simulated).toBe(false);
    expect(dto.campaignId).toBe("120000000000099");
    expect(dto.adSetId).toBe("120000000000100");
    expect(dto.matchedCities).toEqual([
      { query: "Tangerang Selatan", key: "2360586", name: "Tangerang Selatan, Banten" },
    ]);
    expect(dto.unresolvedCities).toEqual([]);

    expect(capturedCampaignBody).toMatchObject({ special_ad_categories: ["HOUSING"] });
    // Real Meta wire shape (`MetaApiClient.createAdSet`): `special_ad_categories` is NEVER sent as
    // its own field on the AdSet endpoint (Meta inherits it from the parent campaign) — it only
    // steers `serializeTargeting`'s internal age/gender-omission decision. Only `targeting` is a
    // real top-level AdSet body field.
    expect(capturedAdSetBody).toMatchObject({
      targeting: {
        geo_locations: { cities: [{ key: "2360586", radius: 25, distance_unit: "kilometer" }] },
      },
    });
    expect(capturedAdSetBody).not.toHaveProperty("special_ad_categories");
    // HOUSING invariant: no age/gender targeting is ever sent for a PROPERTY campaign.
    const targeting = (capturedAdSetBody as { targeting: Record<string, unknown> }).targeting;
    expect(targeting).not.toHaveProperty("age_min");
    expect(targeting).not.toHaveProperty("age_max");
    expect(targeting).not.toHaveProperty("genders");
  });

  it("a listing whose only resolved city has zero real Meta matches is a real, thrown failure (not a broken empty-targeting campaign)", async () => {
    registerSearchAdLocationsMswHandler({}); // every query resolves to Meta's real `{data: []}`
    const service = buildService();
    await expect(
      service.createPropertyCampaign(
        "dss-motor",
        { listingId: "listing-1" },
        "corr-property-nomatch",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("skips (never fabricates) a city with zero matches while still creating the campaign from the cities that DID match", async () => {
    registerSearchAdLocationsMswHandler({
      Bandung: [{ key: "1111111", name: "Bandung, Jawa Barat" }],
      // "Cimahi" has no entry — resolves to a real, empty `{data: []}`.
    });
    registerCreateCampaignMswHandlers();
    const service = buildService(false, buildFakeActivityLogger(), {
      locationResolver: buildFakeLocationResolver({
        cities: ["Bandung", "Cimahi"],
        radiusKm: 30,
        ageMin: 25,
        ageMax: 50,
        source: "FALLBACK",
        reasoning: "test fixture",
      }),
    });
    const dto = await service.createPropertyCampaign(
      "dss-motor",
      { listingId: "listing-1" },
      "corr-property-partial",
    );
    expect(dto.simulated).toBe(false);
    expect(dto.matchedCities).toEqual([
      { query: "Bandung", key: "1111111", name: "Bandung, Jawa Barat" },
    ]);
    expect(dto.unresolvedCities).toEqual(["Cimahi"]);
  });

  it("throws a real NotFoundError (tenant-isolation) for a listing belonging to another tenant", async () => {
    const service = buildService(false, buildFakeActivityLogger(), {
      listings: buildFakeListings({ ...DEFAULT_LISTING, tenantId: "other-tenant" }),
    });
    await expect(
      service.createPropertyCampaign(
        "dss-motor",
        { listingId: "listing-1" },
        "corr-property-cross-tenant",
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws a real NotFoundError for a missing listingId", async () => {
    const service = buildService();
    await expect(
      service.createPropertyCampaign(
        "dss-motor",
        { listingId: "no-such-listing" },
        "corr-property-missing",
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  describe("ActivityLogger wiring", () => {
    it("starts a RUNNING activity with actionType CREATE_PROPERTY_CAMPAIGN, mode LIVE, and completes it SUCCESS", async () => {
      registerSearchAdLocationsMswHandler({
        "Tangerang Selatan": [{ key: "2360586", name: "Tangerang Selatan, Banten" }],
      });
      registerCreateCampaignMswHandlers();
      const activityLogger = buildFakeActivityLogger();
      const service = buildService(false, activityLogger);
      const dto = await service.createPropertyCampaign(
        "dss-motor",
        { listingId: "listing-1" },
        "corr-property-activity-live",
      );

      expect(activityLogger.start).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "dss-motor",
          agent: "SAMANTHA",
          actionType: "CREATE_PROPERTY_CAMPAIGN",
          mode: "LIVE",
          loopId: "corr-property-activity-live",
        }),
      );
      expect(activityLogger.complete).toHaveBeenCalledWith(
        "activity-1",
        expect.objectContaining({ status: "SUCCESS", output: dto }),
      );
      expect(activityLogger.fail).not.toHaveBeenCalled();
    });

    it("starts a RUNNING activity with mode DEV and completes it SIMULATED for a DEV-mode call", async () => {
      const activityLogger = buildFakeActivityLogger();
      const service = buildService(true, activityLogger);
      const dto = await service.createPropertyCampaign(
        "dss-motor",
        { listingId: "listing-1" },
        "corr-property-activity-dev",
      );

      expect(activityLogger.start).toHaveBeenCalledWith(expect.objectContaining({ mode: "DEV" }));
      expect(activityLogger.complete).toHaveBeenCalledWith(
        "activity-1",
        expect.objectContaining({ status: "SIMULATED", devPreview: dto }),
      );
      expect(activityLogger.fail).not.toHaveBeenCalled();
    });

    it("fails the activity with the real thrown ValidationError when every city fails to resolve", async () => {
      registerSearchAdLocationsMswHandler({});
      const activityLogger = buildFakeActivityLogger();
      const service = buildService(false, activityLogger);
      await expect(
        service.createPropertyCampaign(
          "dss-motor",
          { listingId: "listing-1" },
          "corr-property-activity-error",
        ),
      ).rejects.toBeInstanceOf(ValidationError);

      expect(activityLogger.fail).toHaveBeenCalledWith("activity-1", expect.any(ValidationError));
      expect(activityLogger.complete).not.toHaveBeenCalled();
    });
  });
});

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
  registerCreateAdMswHandlers,
  registerCreateCampaignErrorHandler,
  registerCreateCampaignMswHandlers,
  registerHappyPathMetaApiHandlers,
  registerMetaApiPostErrorHandler,
  registerSearchAdLocationsMswHandler,
} from "../../test-support/meta-api-msw.js";
import type { CreativePackagesService } from "../creative-packages/creative-packages.service.js";
import type { StoredCreativePackage } from "../creative-packages/domain/creative-package.js";
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

/**
 * AAOS-SAMANTHA-LLM-AD-COPY — fake, tenant-scoped `CreativePackagesService.getForCampaignPublish`
 * lookup. `undefined` (the default) means no `creativePackageId` should be passed in a given test's
 * `createPropertyCampaign` call at all (the pre-existing manual-endpoint behavior, completely
 * unaffected) — this fake exists only for the new multi-ad-publish describe block below.
 */
function buildFakeCreativePackages(
  pkg: StoredCreativePackage | undefined = undefined,
): CreativePackagesService {
  return {
    getForCampaignPublish: vi.fn(async (_tenantId: string, id: string) => {
      if (pkg === undefined || pkg.id !== id) {
        throw new NotFoundError(`No creative package found for id "${id}"`);
      }
      return pkg;
    }),
  } as unknown as CreativePackagesService;
}

/** Minimal `MetaSyncService` test double (EYVRA-META-OAUTH-WHATSAPP-SETUP Sprint 4) — `syncCampaign` is a no-op spy, irrelevant to this file's own pre-existing `createCampaign`/`createPropertyCampaign` assertions. */
function buildFakeMetaSync() {
  return {
    syncCampaign: vi.fn(async () => undefined),
  };
}

function buildService(
  dev = false,
  activityLogger: ReturnType<typeof buildFakeActivityLogger> = buildFakeActivityLogger(),
  options: {
    readonly listings?: ListingsService;
    readonly locationResolver?: LocationResolverService;
    readonly creativePackages?: CreativePackagesService;
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
    options.creativePackages ?? buildFakeCreativePackages(),
    buildFakeMetaSync() as never,
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

/**
 * AAOS-SAMANTHA-LLM-AD-COPY — real multi-ad-publish tests for `CampaignsService.
 * createPropertyCampaign`'s new `creativePackageId` 4th parameter (only `SchedulerService.
 * runCampaignPublishCheck` ever passes it — the manual endpoint never does, so those pre-existing
 * tests above are completely unaffected, verified directly since none of them pass a 4th argument).
 */
describe("CampaignsService.createPropertyCampaign — multi-ad publish (AAOS-SAMANTHA-LLM-AD-COPY)", () => {
  const LISTING_WITH_WA = { ...DEFAULT_LISTING, waNumber: "081234567890" };

  const IMAGE_PACKAGE: StoredCreativePackage = {
    id: "pkg-1",
    tenantId: "dss-motor",
    briefId: "brief-1",
    vertical: "PROPERTY",
    listingId: "listing-1",
    title: "Rumah Minimalis Bintaro",
    angle: "DP_RINGAN",
    reason: "test fixture",
    requestedFormat: "IMAGES_ONLY",
    decidedFormat: "IMAGES_ONLY",
    primaryMessage: "test",
    urgency: "MEDIUM",
    origin: "MANUAL",
    status: "PENDING",
    aiRecommended: false,
    fatigueStatus: "NORMAL",
    source: "auto_loop",
    priority: "MEDIUM",
    sourcePhotoUrls: [],
    imageUrls: ["https://example.com/listing-1/image-1.jpg"],
    copyVariants: [
      {
        id: "cv-a",
        variantLabel: "A",
        primaryText: "DP ringan mulai sekarang!",
        headline: "Rumah Bintaro DP Ringan",
        callToAction: "Tanya Sekarang",
        description: "3KT, carport 2 mobil",
      },
      {
        id: "cv-b",
        variantLabel: "B",
        primaryText: "Lokasi strategis, siap huni.",
        headline: "Rumah Bintaro Siap Huni",
        callToAction: "Pelajari Selanjutnya",
        description: "Dekat akses tol",
      },
      {
        id: "cv-c",
        variantLabel: "C",
        primaryText: "Sudah dipercaya banyak keluarga.",
        headline: "Rumah Bintaro Terverifikasi",
        callToAction: "Tanya Sekarang",
        description: "Unit siap survey",
      },
    ],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };

  function registerFullLivePipeline(): void {
    registerSearchAdLocationsMswHandler({
      "Tangerang Selatan": [{ key: "2360586", name: "Tangerang Selatan, Banten" }],
    });
    registerCreateCampaignMswHandlers();
    registerCreateAdMswHandlers();
  }

  it("DEV mode creates zero real Meta ads (no uploadImage/uploadVideo/createAd call) even with a matched creative package", async () => {
    // No MSW handler registered at all — any real HTTP call (including the new upload/createAd
    // calls this dispatch adds) fails this test outright.
    const service = buildService(true, buildFakeActivityLogger(), {
      listings: buildFakeListings(LISTING_WITH_WA),
      creativePackages: buildFakeCreativePackages(IMAGE_PACKAGE),
    });
    const dto = await service.createPropertyCampaign(
      "dss-motor",
      { listingId: "listing-1" },
      "corr-multiad-dev",
      "pkg-1",
    );
    expect(dto.simulated).toBe(true);
    expect(dto.adIds).toBeUndefined();
  });

  it("LIVE mode publishes up to 3 real Meta Ads (one per copyVariant) in the same real AdSet", async () => {
    registerFullLivePipeline();
    const capturedAdBodies: unknown[] = [];
    mswServer.use(
      http.post("https://graph.facebook.com/v21.0/:adAccountId/ads", async ({ request }) => {
        capturedAdBodies.push(await request.json());
        return HttpResponse.json({ id: `120000000000${String(900 + capturedAdBodies.length)}` });
      }),
    );
    const service = buildService(false, buildFakeActivityLogger(), {
      listings: buildFakeListings(LISTING_WITH_WA),
      creativePackages: buildFakeCreativePackages(IMAGE_PACKAGE),
    });
    const dto = await service.createPropertyCampaign(
      "dss-motor",
      { listingId: "listing-1" },
      "corr-multiad-live",
      "pkg-1",
    );

    expect(dto.simulated).toBe(false);
    expect(dto.adIds).toHaveLength(3);
    expect(capturedAdBodies).toHaveLength(3);
    // All 3 ads share the SAME real AdSet (real Meta-native A/B testing — not 3x spend).
    for (const body of capturedAdBodies) {
      expect(body).toMatchObject({ adset_id: dto.adSetId });
    }
    // Only the copy text differs per ad — same shared uploaded image hash/link every time.
    const messages = capturedAdBodies.map(
      (body) =>
        (body as { creative: { object_story_spec: { link_data: { message: string } } } }).creative
          .object_story_spec.link_data.message,
    );
    expect(messages).toEqual([
      "DP ringan mulai sekarang!",
      "Lokasi strategis, siap huni.",
      "Sudah dipercaya banyak keluarga.",
    ]);
    const descriptions = capturedAdBodies.map(
      (body) =>
        (body as { creative: { object_story_spec: { link_data: { description: string } } } })
          .creative.object_story_spec.link_data.description,
    );
    expect(descriptions).toEqual(["3KT, carport 2 mobil", "Dekat akses tol", "Unit siap survey"]);
  });

  it("the manual endpoint (no creativePackageId) never attempts real ad creation", async () => {
    registerFullLivePipeline();
    let adCreateCalled = false;
    mswServer.use(
      http.post("https://graph.facebook.com/v21.0/:adAccountId/ads", () => {
        adCreateCalled = true;
        return HttpResponse.json({ id: "120000000000999" });
      }),
    );
    const service = buildService(false, buildFakeActivityLogger(), {
      listings: buildFakeListings(LISTING_WITH_WA),
      creativePackages: buildFakeCreativePackages(IMAGE_PACKAGE),
    });
    const dto = await service.createPropertyCampaign(
      "dss-motor",
      { listingId: "listing-1" },
      "corr-multiad-manual",
      // no creativePackageId — matches the real manual `POST /api/v1/campaigns/property` call site
    );
    expect(dto.simulated).toBe(false);
    expect(dto.adIds).toBeUndefined();
    expect(adCreateCalled).toBe(false);
  });

  it("one failing createAd call does not block the other variants or fail the whole campaign-creation call", async () => {
    registerFullLivePipeline();
    // Fails deterministically for variant "B" specifically (matched by the ad `name`, which stays
    // the same across `ExponentialBackoffRetry`'s retries of that same request) — a count-based
    // failure would get "fixed" by a later successful retry of the SAME logical request, silently
    // hiding the real per-ad failure this test exists to verify.
    let adCounter = 0;
    mswServer.use(
      http.post("https://graph.facebook.com/v21.0/:adAccountId/ads", async ({ request }) => {
        const body = (await request.json()) as { name: string };
        if (body.name.includes("· B")) {
          return HttpResponse.json(
            { error: { message: "Meta API error", type: "OAuthException", code: 1 } },
            { status: 400 },
          );
        }
        adCounter += 1;
        return HttpResponse.json({ id: `120000000000${String(900 + adCounter)}` });
      }),
    );
    const service = buildService(false, buildFakeActivityLogger(), {
      listings: buildFakeListings(LISTING_WITH_WA),
      creativePackages: buildFakeCreativePackages(IMAGE_PACKAGE),
    });
    const dto = await service.createPropertyCampaign(
      "dss-motor",
      { listingId: "listing-1" },
      "corr-multiad-partial-fail",
      "pkg-1",
    );
    expect(dto.simulated).toBe(false);
    // The campaign itself still succeeded (campaignId/adSetId present) despite one bad ad.
    expect(dto.campaignId).toBeDefined();
    expect(dto.adSetId).toBeDefined();
    // 2 of 3 ads created — the middle one's failure did not block the 3rd.
    expect(dto.adIds).toHaveLength(2);
  });

  it("a package with no real waNumber and an IMAGE-only asset creates zero ads (never a fabricated wa.me link)", async () => {
    registerFullLivePipeline();
    const service = buildService(false, buildFakeActivityLogger(), {
      listings: buildFakeListings(DEFAULT_LISTING), // no waNumber
      creativePackages: buildFakeCreativePackages(IMAGE_PACKAGE),
    });
    const dto = await service.createPropertyCampaign(
      "dss-motor",
      { listingId: "listing-1" },
      "corr-multiad-no-wa",
      "pkg-1",
    );
    expect(dto.simulated).toBe(false);
    expect(dto.campaignId).toBeDefined();
    expect(dto.adIds).toBeUndefined();
  });

  it("a package with no copyVariants creates zero ads (never a fabricated ad)", async () => {
    registerFullLivePipeline();
    const service = buildService(false, buildFakeActivityLogger(), {
      listings: buildFakeListings(LISTING_WITH_WA),
      creativePackages: buildFakeCreativePackages({ ...IMAGE_PACKAGE, copyVariants: [] }),
    });
    const dto = await service.createPropertyCampaign(
      "dss-motor",
      { listingId: "listing-1" },
      "corr-multiad-no-copy",
      "pkg-1",
    );
    expect(dto.simulated).toBe(false);
    expect(dto.campaignId).toBeDefined();
    expect(dto.adIds).toBeUndefined();
  });
});

describe("CampaignsService.restructureCampaign (Samantha Andromeda-Aware Campaign System, Sprint 1)", () => {
  it("MANDATORY DEV-SAFE: DEV mode makes ZERO real Meta calls and returns an honest simulated:true with no paused-ad-set ids", async () => {
    // Deliberately registers NO Meta API mock handlers at all — MSW's `onUnhandledRequest: "error"`
    // (see this file's `beforeAll`) means ANY real HTTP call this test doesn't expect would fail
    // the test outright. A DEV-mode `restructureCampaign` call that reaches the network at all is
    // therefore a real, hard test failure, not just an unasserted side effect.
    const service = buildService(true);
    const dto = await service.restructureCampaign(
      "dss-motor",
      {
        campaignId: "campaign-1",
        proposedKeepAdSetId: "adset-keep",
        proposedPauseAdSetIds: ["adset-a", "adset-b"],
      },
      "corr-restructure-dev",
    );
    expect(dto.simulated).toBe(true);
    expect(dto.pausedAdSetIds).toBeUndefined();
    expect(dto.failedAdSetIds).toBeUndefined();
    expect(dto.note).toBeDefined();
  });

  it("LIVE mode calls the real Meta ad-set pause mutation for every proposed ad set and reports simulated:false", async () => {
    registerHappyPathMetaApiHandlers();
    const service = buildService(false);
    const dto = await service.restructureCampaign(
      "dss-motor",
      {
        campaignId: "campaign-1",
        proposedKeepAdSetId: "adset-keep",
        proposedPauseAdSetIds: ["adset-a", "adset-b"],
      },
      "corr-restructure-live",
    );
    expect(dto.simulated).toBe(false);
    expect(dto.pausedAdSetIds).toEqual(["adset-a", "adset-b"]);
    expect(dto.failedAdSetIds).toEqual([]);
  });

  it("LIVE mode: a real Meta pause failure is reported honestly via failedAdSetIds, never thrown, never silently dropped", async () => {
    registerMetaApiPostErrorHandler(500);
    const service = buildService(false);
    const dto = await service.restructureCampaign(
      "dss-motor",
      {
        campaignId: "campaign-1",
        proposedKeepAdSetId: "adset-keep",
        proposedPauseAdSetIds: ["adset-a"],
      },
      "corr-restructure-live-fail",
    );
    expect(dto.simulated).toBe(false);
    expect(dto.pausedAdSetIds).toEqual([]);
    expect(dto.failedAdSetIds).toEqual(["adset-a"]);
  });

  describe("ActivityLogger wiring", () => {
    it("starts a RUNNING activity with actionType RESTRUCTURE_CAMPAIGN, mode DEV, and completes it SIMULATED", async () => {
      const activityLogger = buildFakeActivityLogger();
      const service = buildService(true, activityLogger);
      await service.restructureCampaign(
        "dss-motor",
        {
          campaignId: "campaign-1",
          proposedKeepAdSetId: "adset-keep",
          proposedPauseAdSetIds: ["adset-a"],
        },
        "corr-restructure-activity-dev",
      );
      expect(activityLogger.start).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: "RESTRUCTURE_CAMPAIGN", mode: "DEV" }),
      );
      expect(activityLogger.complete).toHaveBeenCalledWith(
        "activity-1",
        expect.objectContaining({ status: "SIMULATED" }),
      );
    });

    it("starts a RUNNING activity with mode LIVE and completes it SUCCESS for a real restructure", async () => {
      registerHappyPathMetaApiHandlers();
      const activityLogger = buildFakeActivityLogger();
      const service = buildService(false, activityLogger);
      await service.restructureCampaign(
        "dss-motor",
        {
          campaignId: "campaign-1",
          proposedKeepAdSetId: "adset-keep",
          proposedPauseAdSetIds: ["adset-a"],
        },
        "corr-restructure-activity-live",
      );
      expect(activityLogger.start).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: "RESTRUCTURE_CAMPAIGN", mode: "LIVE" }),
      );
      expect(activityLogger.complete).toHaveBeenCalledWith(
        "activity-1",
        expect.objectContaining({ status: "SUCCESS" }),
      );
    });
  });
});

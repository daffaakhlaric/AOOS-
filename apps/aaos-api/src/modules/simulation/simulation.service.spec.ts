import "reflect-metadata";

import { NotFoundError } from "@aos/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildTestConfig } from "../../test-support/fixtures.js";
import type { LearningService } from "../learning/learning.service.js";
import type { ListingResponseDto } from "../listings/dto/listing.dto.js";
import type { ListingsService } from "../listings/listings.service.js";
import type { LlmService } from "../llm/llm.service.js";
import type { StoredMetaInterest } from "../meta-interests/domain/meta-interest.js";
import type { MetaInterestRepository } from "../meta-interests/infrastructure/meta-interest.repository.js";
import type {
  TenantRepository,
  TenantRow,
} from "../superadmin/infrastructure/tenant.repository.js";

import type { StoredSimulation } from "./domain/simulation-record.js";
import type { StartSimulationBodyDto } from "./dto/start-simulation.dto.js";
import type * as aaosSimulatorClient from "./infrastructure/aaos-simulator-client.js";
import { AaosSimulatorError, callAaosSimulator } from "./infrastructure/aaos-simulator-client.js";
import type { SimulationRepository } from "./infrastructure/simulation.repository.js";
import { SimulationService } from "./simulation.service.js";

vi.mock("./infrastructure/aaos-simulator-client.js", async () => {
  const actual = await vi.importActual<typeof aaosSimulatorClient>(
    "./infrastructure/aaos-simulator-client.js",
  );
  return { ...actual, callAaosSimulator: vi.fn() };
});

const mockedCallAaosSimulator = vi.mocked(callAaosSimulator);

function buildStored(overrides: Partial<StoredSimulation> = {}): StoredSimulation {
  return {
    id: "sim-1",
    tenantId: "dss-motor",
    objectiveSnapshot: {},
    campaignDataSource: "cache",
    personaIds: ["ready_buyer"],
    status: "RUNNING",
    currentStep: "SETUP",
    createdAt: "2026-08-13T00:00:00.000Z",
    updatedAt: "2026-08-13T00:00:00.000Z",
    ...overrides,
  };
}

function buildFakeRepository(stored: StoredSimulation): SimulationRepository {
  const logs: unknown[] = [];
  return {
    create: vi.fn(async () => stored),
    findById: vi.fn(async (id: string) => (id === stored.id ? stored : undefined)),
    list: vi.fn(async () => [stored]),
    updateStep: vi.fn(async () => undefined),
    complete: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
    recordDecision: vi.fn(async () => undefined),
    appendLog: vi.fn(async (_id: string, entry: unknown) => {
      logs.push(entry);
    }),
    listLogs: vi.fn(async () => logs),
  } as unknown as SimulationRepository;
}

/**
 * AAOS-SIMULASI-TARGETING: the SAMANTHA stage now also reads the real `meta_interests` catalogue.
 * The default fake returns an EMPTY catalogue — that is the honest state of a deployment where
 * `POST /api/v1/meta-interests/sync` has never been run, and it keeps every pre-existing test
 * exercising exactly the pipeline it did before (targeting degrades to geo/age defaults only).
 */
function buildFakeInterestRepository(
  stored: readonly StoredMetaInterest[] = [],
): MetaInterestRepository {
  return {
    listByTenant: vi.fn(async () => stored),
    findById: vi.fn(async () => undefined),
    save: vi.fn(async () => "inserted" as const),
  } as unknown as MetaInterestRepository;
}

/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 5 — the fake for `SimulationService.resolveVertical`'s
 * dependency. Defaults to a real `AUTOMOTIVE` `dss-motor`-shaped row so every pre-existing test
 * (written before vertical-aware branching existed) keeps its exact prior behavior.
 */
function buildFakeTenantRepository(
  vertical: "AUTOMOTIVE" | "PROPERTY" = "AUTOMOTIVE",
): TenantRepository {
  const row: TenantRow = {
    id: "tenant-uuid-1",
    tenant_id: "dss-motor",
    name: "DSS Motor (Mobix)",
    vertical,
    status: "ACTIVE",
    trial_ends_at: null,
    meta_access_token: null,
    meta_ad_account_id: null,
    meta_api_version: null,
    created_at: "2026-08-13T00:00:00.000Z",
    updated_at: "2026-08-13T00:00:00.000Z",
  };
  return {
    findByTenantId: vi.fn(async () => row),
  } as unknown as TenantRepository;
}

/**
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 6 — the fake for `SimulationService`'s new
 * `ListingsService` dependency (Step 3's PROPERTY Kai-prompt preview). Defaults to a real
 * `NotFoundError` throw, matching `ListingsService.getById`'s real behavior for any id this fake
 * wasn't told about — every pre-existing AUTOMOTIVE-vertical test never reaches this fake at all
 * (`resolveKaiPromptDetail` short-circuits to the automotive path before touching `listings`), so
 * the default never needs to succeed.
 */
function buildFakeListingsService(listing?: ListingResponseDto): ListingsService {
  return {
    getById: vi.fn(async (_tenantId: string, id: string) => {
      if (listing !== undefined && listing.id === id) {
        return listing;
      }
      throw new NotFoundError(`No listing found for id "${id}"`);
    }),
  } as unknown as ListingsService;
}

function buildFakeListing(overrides: Partial<ListingResponseDto> = {}): ListingResponseDto {
  return {
    id: "listing-1",
    title: "Rumah Bintaro 88m²",
    propertyType: "RUMAH",
    listingStatus: "AKTIF",
    price: 1_800_000_000,
    branchId: "BINTARO",
    waNumber: "+628123456789",
    highlights: ["Dekat sekolah dan tol"],
    photos: [
      {
        id: "photo-1",
        url: "https://assets.example/listing-1-photo-1.jpg",
        order: 0,
        isMain: true,
      },
    ],
    mainPhotoUrl: "https://assets.example/listing-1-photo-1.jpg",
    inKnowledgeBase: false,
    createdAt: "2026-08-13T00:00:00.000Z",
    updatedAt: "2026-08-13T00:00:00.000Z",
    ...overrides,
  };
}

const REAL_STORED_INTEREST: StoredMetaInterest = {
  // Verbatim from a real live Meta `GET /search?type=adinterest&q=used car` response, 2026-08-18.
  id: "6003257869482",
  tenantId: "dss-motor",
  name: "Used car (vehicle)",
  audienceSizeLower: 61362891,
  audienceSizeUpper: 72162760,
  path: ["Interests", "Additional interests", "Used car (vehicle)"],
  topic: "Business and industry",
  searchTerm: "used car",
  fetchedAt: "2026-08-18T00:00:00.000Z",
};

function buildFakeLlmService(overrides: Partial<LlmService> = {}): LlmService {
  return {
    selectTargeting: vi.fn(async () => ({
      available: true,
      interestIds: ["6003257869482"],
      reasoning: "Interest mobil bekas paling relevan untuk unit ini.",
      rejectedIds: [],
    })),
    analyze: vi.fn(async () => ({
      available: true,
      temuan: [
        { icon: "🔴", judul: "a", detail: "a" },
        { icon: "🔴", judul: "b", detail: "b" },
      ],
      rekomendasi: [{ aksi: "FIX", target: "t", alasan: "a", estimasi: "e" }],
      ringkasan: "Ringkasan nyata.",
    })),
    creativeBrief: vi.fn(async () => ({
      available: true,
      unit: "Xpander",
      angle: "DP_RINGAN",
      branch: "CINERE",
      primaryMessage: "DP mulai 29 juta",
      tone: "casual",
      formats: ["VIDEO_15S"],
      avoid: [],
      urgency: "HIGH",
    })),
    ...overrides,
  } as unknown as LlmService;
}

/**
 * AAOS Self-Learning AI, Phase B — the fake for `SimulationService`'s new `LearningService`
 * dependency. `onSimulationComplete` is a no-op fake here (never asserted on by
 * `SimulationService`'s own pre-existing tests — this file's job is the pipeline itself, not
 * `LearningService`'s real gap-detection behavior, which is covered by
 * `learning/learning.service.spec.ts`) — every pre-existing test keeps its exact prior behavior.
 */
function buildFakeLearningService(): LearningService {
  return {
    onSimulationComplete: vi.fn(async () => undefined),
  } as unknown as LearningService;
}

const BODY: StartSimulationBodyDto = {
  objective: { targetHotLeads: 10 },
  campaignDataSource: "cache",
  campaigns: [],
  kaiAd: { name: "Xpander", branch: "CINERE" as never },
  kaiBranch: "CINERE" as never,
  personaIds: ["ready_buyer"],
};

describe("SimulationService", () => {
  beforeEach(() => {
    mockedCallAaosSimulator.mockReset();
  });

  it("start persists a RUNNING record and returns its id immediately", async () => {
    const stored = buildStored();
    const repository = buildFakeRepository(stored);
    const service = new SimulationService(
      buildTestConfig(),
      undefined,
      repository,
      buildFakeLlmService(),
      buildFakeInterestRepository(),
      buildFakeTenantRepository(),
      buildFakeListingsService(),
      buildFakeLearningService(),
    );

    const result = await service.start(BODY, "dss-motor");
    expect(result).toEqual({ id: "sim-1", status: "RUNNING" });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ personaIds: ["ready_buyer"], campaignDataSource: "cache" }),
    );
  });

  it("runs the full pipeline end-to-end and persists a real computed score (Clara configured)", async () => {
    const stored = buildStored();
    const repository = buildFakeRepository(stored);
    mockedCallAaosSimulator.mockResolvedValue({
      finalScore: 80,
      finalTemperature: "HOT",
      handoffTriggered: true,
      totalTurns: 6,
      overallScore: 90,
      grade: "A",
      verdict: "APPROVED",
      feedbackItems: [],
    });
    const service = new SimulationService(
      buildTestConfig({ AAOS_SIMULATOR_BASE_URL: "http://localhost:4100" }),
      undefined,
      repository,
      buildFakeLlmService(),
      buildFakeInterestRepository(),
      buildFakeTenantRepository(),
      buildFakeListingsService(),
      buildFakeLearningService(),
    );

    await service.start(BODY, "dss-motor");
    // The pipeline is detached (`void this.runPipeline(...)`) — wait for its microtasks to settle.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(repository.complete).toHaveBeenCalledTimes(1);
    const [, result] = (repository.complete as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      {
        scoring: { verdict: string };
        kai: {
          promptDetail?: { imagePrompts: readonly string[]; sourcePhotoUrls: readonly string[] };
        };
      },
    ];
    expect(result.scoring.verdict).toBe("GO");
    // AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 3, section C — the real Kai prompt-detail panel's
    // data rides along on `kai.promptDetail`, computed with zero real Kie AI calls.
    expect(result.kai.promptDetail).toBeDefined();
    expect(result.kai.promptDetail?.imagePrompts).toHaveLength(3);
    // No asset-library configured in this test (`undefined` passed to the constructor above) — an
    // honest empty source-photo list, never a fabricated thumbnail.
    expect(result.kai.promptDetail?.sourcePhotoUrls).toEqual([]);
  });

  it("records Clara as unavailable (never fabricated) when AAOS_SIMULATOR_BASE_URL is unset", async () => {
    const stored = buildStored();
    const repository = buildFakeRepository(stored);
    const service = new SimulationService(
      buildTestConfig({ AAOS_SIMULATOR_BASE_URL: "" }),
      undefined,
      repository,
      buildFakeLlmService(),
      buildFakeInterestRepository(),
      buildFakeTenantRepository(),
      buildFakeListingsService(),
      buildFakeLearningService(),
    );

    await service.start(BODY, "dss-motor");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockedCallAaosSimulator).not.toHaveBeenCalled();
    const [, result] = (repository.complete as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { clara: { available: boolean }; scoring: { verdict: string } },
    ];
    expect(result.clara.available).toBe(false);
    expect(result.scoring.verdict).toBe("INCOMPLETE");
  });

  it("records a real per-persona failure (not a fabricated success) when aaos-simulator errors", async () => {
    const stored = buildStored();
    const repository = buildFakeRepository(stored);
    mockedCallAaosSimulator.mockRejectedValue(new AaosSimulatorError("upstream down"));
    const service = new SimulationService(
      buildTestConfig({ AAOS_SIMULATOR_BASE_URL: "http://localhost:4100" }),
      undefined,
      repository,
      buildFakeLlmService(),
      buildFakeInterestRepository(),
      buildFakeTenantRepository(),
      buildFakeListingsService(),
      buildFakeLearningService(),
    );

    await service.start(BODY, "dss-motor");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const [, result] = (repository.complete as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { clara: { runs: ReadonlyArray<{ ok: boolean; error?: string }> } },
    ];
    expect(result.clara.runs[0]?.ok).toBe(false);
    expect(result.clara.runs[0]?.error).toContain("upstream down");
  });

  it("fails the record when a stage throws unexpectedly", async () => {
    const stored = buildStored();
    const repository = buildFakeRepository(stored);
    const service = new SimulationService(
      buildTestConfig(),
      undefined,
      repository,
      buildFakeLlmService({
        analyze: vi.fn(async () => {
          throw new Error("boom");
        }),
      }),
      buildFakeInterestRepository(),
      buildFakeTenantRepository(),
      buildFakeListingsService(),
      buildFakeLearningService(),
    );

    await service.start(BODY, "dss-motor");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(repository.fail).toHaveBeenCalledWith("sim-1", "boom");
  });

  it("getStatus throws NotFoundError for an unknown id", async () => {
    const repository = buildFakeRepository(buildStored());
    const service = new SimulationService(
      buildTestConfig(),
      undefined,
      repository,
      buildFakeLlmService(),
      buildFakeInterestRepository(),
      buildFakeTenantRepository(),
      buildFakeListingsService(),
      buildFakeLearningService(),
    );
    await expect(service.getStatus("missing")).rejects.toThrow(NotFoundError);
  });

  it("approve/reject record the decision only — never anything else", async () => {
    const stored = buildStored({ status: "DONE" });
    const repository = buildFakeRepository(stored);
    const service = new SimulationService(
      buildTestConfig(),
      undefined,
      repository,
      buildFakeLlmService(),
      buildFakeInterestRepository(),
      buildFakeTenantRepository(),
      buildFakeListingsService(),
      buildFakeLearningService(),
    );

    await service.approve("sim-1", { decidedBy: "manager-1", notes: "looks good" });
    expect(repository.recordDecision).toHaveBeenCalledWith(
      "sim-1",
      "APPROVED",
      "manager-1",
      "looks good",
      expect.any(String),
    );

    await service.reject("sim-1", {});
    expect(repository.recordDecision).toHaveBeenCalledWith(
      "sim-1",
      "REJECTED",
      undefined,
      undefined,
      expect.any(String),
    );
  });

  describe("audience targeting preview (AAOS-SIMULASI-TARGETING)", () => {
    async function runPipeline(
      interestRepository: MetaInterestRepository,
      llm: LlmService = buildFakeLlmService(),
    ) {
      const repository = buildFakeRepository(buildStored());
      const service = new SimulationService(
        buildTestConfig(),
        undefined,
        repository,
        llm,
        interestRepository,
        buildFakeTenantRepository(),
        buildFakeListingsService(),
        buildFakeLearningService(),
      );
      await service.start(BODY, "dss-motor");
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      const [, result] = (repository.complete as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        { samantha: { audienceTargeting?: Record<string, unknown> } },
      ];
      return { repository, targeting: result.samantha.audienceTargeting };
    }

    it("attaches the branch's geo/age default with its unreviewed caveat, even with no stored interests", async () => {
      const { targeting } = await runPipeline(buildFakeInterestRepository([]));
      expect(targeting).toMatchObject({
        branch: "CINERE",
        ageMin: 25,
        ageMax: 50,
        candidateCount: 0,
        interests: [],
        interestsUnavailableReason: "NO_CANDIDATES",
      });
      // Cinere is really in the Depok area — and the caveat is always carried.
      expect(targeting?.geo).toContain("Depok");
      expect(String(targeting?.geoNote)).toContain("Perkiraan awal");
    });

    it("carries the REAL selected Meta interest (Meta's own id and audience bounds), not just an id", async () => {
      const { targeting } = await runPipeline(buildFakeInterestRepository([REAL_STORED_INTEREST]));
      expect(targeting?.candidateCount).toBe(1);
      expect(targeting?.interests).toEqual([
        {
          id: "6003257869482",
          name: "Used car (vehicle)",
          audienceSizeLower: 61362891,
          audienceSizeUpper: 72162760,
          topic: "Business and industry",
        },
      ]);
      expect(targeting?.reasoning).toContain("mobil bekas");
    });

    it("never shows an interest Samantha invented — only ids that survived the server-side candidate check", async () => {
      const llm = buildFakeLlmService({
        // The real `LlmService.selectTargeting` already drops invented ids; this asserts the
        // simulation layer additionally only renders interests it can resolve from the real
        // candidate rows, so a leaked id can never become a displayed "interest".
        selectTargeting: vi.fn(async () => ({
          available: true,
          interestIds: ["6003257869482", "9999999999999"],
          reasoning: "alasan",
          rejectedIds: [],
        })),
      } as unknown as Partial<LlmService>);
      const { targeting } = await runPipeline(
        buildFakeInterestRepository([REAL_STORED_INTEREST]),
        llm,
      );
      expect(targeting?.interests).toHaveLength(1);
      expect((targeting?.interests as ReadonlyArray<{ id: string }>)[0]?.id).toBe("6003257869482");
    });

    it("degrades honestly (no fabricated interests) when Samantha's selection is unavailable", async () => {
      const llm = buildFakeLlmService({
        selectTargeting: vi.fn(async () => ({
          available: false,
          reason: "NO_API_KEY",
          message: "…",
        })),
      } as unknown as Partial<LlmService>);
      const { targeting } = await runPipeline(
        buildFakeInterestRepository([REAL_STORED_INTEREST]),
        llm,
      );
      expect(targeting?.interests).toEqual([]);
      expect(targeting?.interestsUnavailableReason).toBe("NO_API_KEY");
    });

    it("never fails the whole simulation when the interest repository throws", async () => {
      const throwing = {
        listByTenant: vi.fn(async () => {
          throw new Error("meta_interests table missing");
        }),
      } as unknown as MetaInterestRepository;
      const { repository, targeting } = await runPipeline(throwing);
      expect(repository.fail).not.toHaveBeenCalled();
      expect(targeting?.interestsUnavailableReason).toBe("TARGETING_ERROR");
    });

    it("writes the real candidate/selected/rejected ids into the previously-unused log payload column", async () => {
      const repository = buildFakeRepository(buildStored());
      const service = new SimulationService(
        buildTestConfig(),
        undefined,
        repository,
        buildFakeLlmService(),
        buildFakeInterestRepository([REAL_STORED_INTEREST]),
        buildFakeTenantRepository(),
        buildFakeListingsService(),
        buildFakeLearningService(),
      );
      await service.start(BODY, "dss-motor");
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      const logs = await repository.listLogs("sim-1");
      const withPayload = logs.filter(
        (entry): entry is (typeof logs)[number] & { payload: Record<string, unknown> } =>
          entry.payload !== undefined,
      );
      expect(withPayload).toHaveLength(1);
      expect(withPayload[0]?.payload).toEqual({
        candidateIds: ["6003257869482"],
        selectedIds: ["6003257869482"],
        rejectedIds: [],
      });
      // Only the targeting step writes a payload — every other line stays message-only.
      expect(logs.length).toBeGreaterThan(1);
    });
  });

  it("history maps stored simulations to history entries", async () => {
    const repository = buildFakeRepository(buildStored());
    const service = new SimulationService(
      buildTestConfig(),
      undefined,
      repository,
      buildFakeLlmService(),
      buildFakeInterestRepository(),
      buildFakeTenantRepository(),
      buildFakeListingsService(),
      buildFakeLearningService(),
    );
    const history = await service.history();
    expect(history).toHaveLength(1);
    expect(history[0]?.id).toBe("sim-1");
  });

  describe("PROPERTY-vertical Kai-prompt preview (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 6)", () => {
    const PROPERTY_BODY: StartSimulationBodyDto = {
      ...BODY,
      listingId: "listing-1",
      kaiPropertyAngle: "READY_HUNI" as never,
    };

    async function runPropertyPipeline(
      body: StartSimulationBodyDto,
      listingsService: ListingsService = buildFakeListingsService(buildFakeListing()),
    ) {
      const repository = buildFakeRepository(buildStored());
      const service = new SimulationService(
        buildTestConfig(),
        undefined,
        repository,
        buildFakeLlmService(),
        buildFakeInterestRepository(),
        buildFakeTenantRepository("PROPERTY"),
        listingsService,
        buildFakeLearningService(),
      );
      await service.start(body, "dss-motor");
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      const [, result] = (repository.complete as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        {
          kai: {
            promptDetail?: {
              imagePrompts: readonly string[];
              copyVariants: ReadonlyArray<{ variantLabel: string }>;
              sourcePhotoUrls: readonly string[];
            };
          };
        },
      ];
      return { repository, kai: result.kai };
    }

    it("builds a real Kai promptDetail from the real selected listing (never the automotive path)", async () => {
      const { kai } = await runPropertyPipeline(PROPERTY_BODY);
      expect(kai.promptDetail).toBeDefined();
      expect(kai.promptDetail?.imagePrompts.length).toBeGreaterThan(0);
      kai.promptDetail?.imagePrompts.forEach((prompt) => {
        expect(prompt).toContain("Rumah Bintaro 88m²");
      });
      expect(kai.promptDetail?.copyVariants).toHaveLength(3);
      expect(kai.promptDetail?.sourcePhotoUrls).toEqual([
        "https://assets.example/listing-1-photo-1.jpg",
      ]);
    });

    it("degrades to promptDetail undefined (never fails the run) when Step 1 selected no listing", async () => {
      const { repository, kai } = await runPropertyPipeline({
        ...BODY,
        kaiPropertyAngle: "READY_HUNI" as never,
      });
      expect(kai.promptDetail).toBeUndefined();
      expect(repository.fail).not.toHaveBeenCalled();
    });

    it("degrades to promptDetail undefined (never fails the run) when the listing id is unknown to this tenant", async () => {
      const { repository, kai } = await runPropertyPipeline(
        PROPERTY_BODY,
        buildFakeListingsService(), // no listing configured -> real NotFoundError
      );
      expect(kai.promptDetail).toBeUndefined();
      expect(repository.fail).not.toHaveBeenCalled();
    });

    it("an AUTOMOTIVE tenant never touches ListingsService, even with a stray listingId in the body", async () => {
      const repository = buildFakeRepository(buildStored());
      const throwingListings = {
        getById: vi.fn(async () => {
          throw new Error("ListingsService must not be called for AUTOMOTIVE");
        }),
      } as unknown as ListingsService;
      const service = new SimulationService(
        buildTestConfig(),
        undefined,
        repository,
        buildFakeLlmService(),
        buildFakeInterestRepository(),
        buildFakeTenantRepository("AUTOMOTIVE"),
        throwingListings,
        buildFakeLearningService(),
      );
      await service.start(PROPERTY_BODY, "dss-motor");
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(throwingListings.getById).not.toHaveBeenCalled();
      expect(repository.complete).toHaveBeenCalledTimes(1);
    });
  });

  describe("threads vertical/listingId into callAaosSimulator (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 8)", () => {
    it("passes the resolved vertical + body.listingId to callAaosSimulator for a PROPERTY tenant", async () => {
      mockedCallAaosSimulator.mockResolvedValue({
        finalScore: 80,
        finalTemperature: "HOT",
        handoffTriggered: true,
        totalTurns: 6,
        overallScore: 90,
        grade: "A",
        verdict: "APPROVED",
        feedbackItems: [],
      });
      const repository = buildFakeRepository(buildStored());
      const service = new SimulationService(
        buildTestConfig({ AAOS_SIMULATOR_BASE_URL: "http://localhost:4100" }),
        undefined,
        repository,
        buildFakeLlmService(),
        buildFakeInterestRepository(),
        buildFakeTenantRepository("PROPERTY"),
        buildFakeListingsService(buildFakeListing()),
        buildFakeLearningService(),
      );

      await service.start({ ...BODY, listingId: "listing-1" }, "dss-motor");
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockedCallAaosSimulator).toHaveBeenCalledWith(
        "http://localhost:4100",
        "ready_buyer",
        "PROPERTY",
        "listing-1",
      );
    });

    it("passes vertical AUTOMOTIVE and an undefined listingId for a plain AUTOMOTIVE tenant", async () => {
      mockedCallAaosSimulator.mockResolvedValue({
        finalScore: 80,
        finalTemperature: "HOT",
        handoffTriggered: true,
        totalTurns: 6,
        overallScore: 90,
        grade: "A",
        verdict: "APPROVED",
        feedbackItems: [],
      });
      const repository = buildFakeRepository(buildStored());
      const service = new SimulationService(
        buildTestConfig({ AAOS_SIMULATOR_BASE_URL: "http://localhost:4100" }),
        undefined,
        repository,
        buildFakeLlmService(),
        buildFakeInterestRepository(),
        buildFakeTenantRepository("AUTOMOTIVE"),
        buildFakeListingsService(),
        buildFakeLearningService(),
      );

      await service.start(BODY, "dss-motor");
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockedCallAaosSimulator).toHaveBeenCalledWith(
        "http://localhost:4100",
        "ready_buyer",
        "AUTOMOTIVE",
        undefined,
      );
    });
  });
});

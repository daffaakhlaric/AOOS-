import { NotFoundError } from "@aos/errors";
import { describe, expect, it, vi } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";
import type { StoredCreativePackage } from "../creative-packages/domain/creative-package.js";
import type { CreativePackageRepository } from "../creative-packages/infrastructure/creative-package.repository.js";
import type { ListingKnowledgeService } from "../listing-knowledge/listing-knowledge.service.js";
import type { ListingResponseDto } from "../listings/dto/listing.dto.js";
import type { ListingsService } from "../listings/listings.service.js";
import type { LlmService } from "../llm/llm.service.js";

import { CreativeStressTestService } from "./creative-stress-test.service.js";
import type {
  StressTestEvaluatedResult,
  StressTestPartialResult,
  StressTestRunProgress,
} from "./domain/stress-test-run.js";
import type { CreateStressTestRunBodyDto } from "./dto/create-stress-test-run.dto.js";
import { StressTestRunRepository } from "./infrastructure/stress-test-run.repository.js";

const BODY: CreateStressTestRunBodyDto = {
  name: "Run 1",
  sourceType: "LISTING",
  listingId: "listing-1",
  creativeIds: [],
  mode: "STANDARD",
  primaryGoal: "CREATIVE_QUALITY",
  personaIds: ["PRICE_SENSITIVE", "SKEPTICAL_BUYER", "HIGH_INTENT", "INVESTOR", "FAMILY_BUYER"],
  objectionSources: ["LISTING_KNOWLEDGE_BASE", "FIRST_MESSAGE_INTELLIGENCE"],
};

function fakeListing(overrides: Partial<ListingResponseDto> = {}): ListingResponseDto {
  return {
    id: "listing-1",
    title: "Rumah Bintaro 2 Lantai",
    propertyType: "RUMAH",
    listingStatus: "AKTIF",
    price: 1_500_000_000,
    description: "Rumah nyaman dekat stasiun, sertifikat SHM.",
    highlights: [],
    photos: [],
    documents: [],
    inKnowledgeBase: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const SUCCESSFUL_PERSONA_RESPONSE = {
  available: true as const,
  simulated: true as const,
  attracts: ["Lokasi dekat stasiun"],
  confusions: [],
  objections: [{ objection: "Harga dirasa tinggi", severity: "MEDIUM" as const }],
  intentDrivers: ["Diskon DP"],
  narrativeReaction: "Lumayan menarik tapi masih mikir-mikir soal harga.",
};

const SUCCESSFUL_COPY_RESPONSE = {
  available: true as const,
  hookClarity: {
    status: "STRONG" as const,
    reasoning: "Judul langsung menyebut lokasi strategis.",
  },
  offerStrength: {
    status: "ADEQUATE" as const,
    reasoning: "Ada harga tapi tidak ada promo eksplisit.",
  },
  ctaSpecificity: { status: "WEAK" as const, reasoning: "Tidak ada ajakan bertindak yang jelas." },
  internalConsistency: { status: "STRONG" as const, reasoning: "Judul dan deskripsi konsisten." },
  summary: "Copy cukup kuat di hook, lemah di CTA.",
};

const SUCCESSFUL_RESOLUTION_RESPONSE = {
  available: true as const,
  simulated: true as const,
  assessments: [
    {
      id: "o1",
      resolutionStatus: "PARTIAL" as const,
      goalImpact: "HIGH" as const,
      shortRecommendation: "Tambahkan perbandingan harga per meter dari data listing.",
      evidence: "Harga: Rp 1.500.000.000",
    },
  ],
};

interface BuildServiceOptions {
  readonly llm?: Partial<LlmService>;
  readonly creativePackages?: Partial<CreativePackageRepository>;
  readonly listings?: Partial<ListingsService>;
  readonly listingKnowledge?: Partial<ListingKnowledgeService>;
  readonly repository?: StressTestRunRepository;
}

function buildService(options: BuildServiceOptions = {}): CreativeStressTestService {
  const repository = options.repository ?? new StressTestRunRepository(createFakeSupabaseClient());
  const llm = {
    simulateStressTestPersona: vi.fn(async () => SUCCESSFUL_PERSONA_RESPONSE),
    evaluateStressTestCopy: vi.fn(async () => SUCCESSFUL_COPY_RESPONSE),
    validateStressTestClaims: vi.fn(async () => ({ available: true as const, findings: [] })),
    evaluateStressTestObjectionResolution: vi.fn(async () => SUCCESSFUL_RESOLUTION_RESPONSE),
    ...options.llm,
  } as unknown as LlmService;
  const creativePackages = {
    findById: vi.fn(async () => undefined as StoredCreativePackage | undefined),
    ...options.creativePackages,
  } as unknown as CreativePackageRepository;
  const listings = {
    getById: vi.fn(async () => fakeListing()),
    ...options.listings,
  } as unknown as ListingsService;
  const listingKnowledge = {
    retrieve: vi.fn(async () => ({ hits: [], mode: "KEYWORD_ONLY" })),
    ...options.listingKnowledge,
  } as unknown as ListingKnowledgeService;
  return new CreativeStressTestService(
    repository,
    llm,
    creativePackages,
    listings,
    listingKnowledge,
    () => new Date("2026-09-28T00:00:00.000Z"),
  );
}

describe("CreativeStressTestService", () => {
  it("createRun persists a real DRAFT run scoped to the given tenant", async () => {
    const service = buildService();
    const run = await service.createRun(BODY, "dss-motor");
    expect(run.status).toBe("DRAFT");
    expect(run.tenantId).toBe("dss-motor");
    expect(run.result).toBeNull();
  });

  it("getRun enforces tenant isolation — a run from another tenant throws NotFoundError", async () => {
    const service = buildService();
    const run = await service.createRun(BODY, "dss-motor");
    await expect(service.getRun(run.id, "other-tenant")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("listRuns only returns the given tenant's runs", async () => {
    const service = buildService();
    await service.createRun(BODY, "dss-motor");
    await service.createRun(BODY, "other-tenant");
    const runs = await service.listRuns("dss-motor");
    expect(runs).toHaveLength(1);
  });

  it("cancel transitions a run to CANCELLED", async () => {
    const service = buildService();
    const created = await service.createRun(BODY, "dss-motor");
    const cancelled = await service.cancel(created.id, "dss-motor");
    expect(cancelled.status).toBe("CANCELLED");
  });

  describe("execute — real evaluator registry (Second Boundary)", () => {
    it("transitions DRAFT -> COMPLETED with a real, honestly-labeled evaluated result when evaluators succeed", async () => {
      const service = buildService();
      const created = await service.createRun(BODY, "dss-motor");
      const executed = await service.execute(created.id, "dss-motor");

      expect(executed.status).toBe("COMPLETED");
      expect(executed.completedAt).toBe("2026-09-28T00:00:00.000Z");
      const result = executed.result as StressTestEvaluatedResult;
      expect(result.kind).toBe("COMPLETED");
      expect(result.personaCritiques.every((p) => p.ok)).toBe(true);
      expect(result.personaCritiques.every((p) => p.critique?.simulated === true)).toBe(true);
      expect(result.overallScore).not.toBeNull();
      expect(result.scoreBucket).not.toBeNull();
      expect(result.dimensionScores.map((d) => d.dimension).sort()).toEqual(
        ["CTA", "HOOK", "OBJECTION_HANDLING", "OFFER"].sort(),
      );
    });

    it("caps persona simulation calls by mode — STANDARD calls the LLM for at most 3 of the 5 selected personas", async () => {
      const simulateStressTestPersona = vi.fn(async () => SUCCESSFUL_PERSONA_RESPONSE);
      const service = buildService({ llm: { simulateStressTestPersona } });
      const created = await service.createRun({ ...BODY, mode: "STANDARD" }, "dss-motor");
      await service.execute(created.id, "dss-motor");
      expect(simulateStressTestPersona).toHaveBeenCalledTimes(3);
    });

    it("caps persona simulation calls by mode — FAST calls the LLM for at most 1 persona", async () => {
      const simulateStressTestPersona = vi.fn(async () => SUCCESSFUL_PERSONA_RESPONSE);
      const service = buildService({ llm: { simulateStressTestPersona } });
      const created = await service.createRun({ ...BODY, mode: "FAST" }, "dss-motor");
      await service.execute(created.id, "dss-motor");
      expect(simulateStressTestPersona).toHaveBeenCalledTimes(1);
    });

    it("caps persona simulation calls by mode — DEEP calls the LLM for all 5 personas", async () => {
      const simulateStressTestPersona = vi.fn(async () => SUCCESSFUL_PERSONA_RESPONSE);
      const service = buildService({ llm: { simulateStressTestPersona } });
      const created = await service.createRun({ ...BODY, mode: "DEEP" }, "dss-motor");
      await service.execute(created.id, "dss-motor");
      expect(simulateStressTestPersona).toHaveBeenCalledTimes(5);
    });

    it("partial failure: one persona failing does not fail the whole run — COMPLETED with a reduced confidence and an honest gap note", async () => {
      let callCount = 0;
      const simulateStressTestPersona = vi.fn(async () => {
        callCount += 1;
        if (callCount === 1) {
          return { available: false as const, reason: "PROVIDER_ERROR" as const, message: "boom" };
        }
        return SUCCESSFUL_PERSONA_RESPONSE;
      });
      const service = buildService({ llm: { simulateStressTestPersona } });
      const created = await service.createRun({ ...BODY, mode: "STANDARD" }, "dss-motor");
      const executed = await service.execute(created.id, "dss-motor");

      expect(executed.status).toBe("COMPLETED");
      const result = executed.result as StressTestEvaluatedResult;
      expect(result.personaCritiques.some((p) => !p.ok)).toBe(true);
      expect(result.confidence).toBeLessThan(100);
    });

    it("full failure: every evaluator failing lands the run on FAILED with a real failedReason, never a hollow COMPLETED result", async () => {
      const service = buildService({
        llm: {
          simulateStressTestPersona: vi.fn(async () => ({
            available: false as const,
            reason: "PROVIDER_ERROR" as const,
            message: "boom",
          })),
          evaluateStressTestCopy: vi.fn(async () => ({
            available: false as const,
            reason: "PROVIDER_ERROR" as const,
            message: "boom",
          })),
        },
      });
      const created = await service.createRun(BODY, "dss-motor");
      const executed = await service.execute(created.id, "dss-motor");

      expect(executed.status).toBe("FAILED");
      expect(executed.failedReason).toBeDefined();
      // Honest partial result: no score/bucket, and nothing real to show (fact check NOT_APPLICABLE).
      const partial = executed.result as StressTestPartialResult;
      expect(partial.kind).toBe("PARTIAL");
      expect(partial.partial).toBe(true);
      expect(partial.hasRealOutput).toBe(false);
      expect(partial).not.toHaveProperty("overallScore");
      expect(partial).not.toHaveProperty("scoreBucket");
      expect(partial.objectionResolution?.status).toBe("SKIPPED");
    });

    it("Fact Validator honestly reports NOT_APPLICABLE (never a silent pass-all) when the listing has no real Listing Knowledge documents", async () => {
      const validateStressTestClaims = vi.fn();
      const service = buildService({ llm: { validateStressTestClaims } });
      const created = await service.createRun(BODY, "dss-motor");
      const executed = await service.execute(created.id, "dss-motor");

      const result = executed.result as StressTestEvaluatedResult;
      expect(result.factCheck.status).toBe("NOT_APPLICABLE");
      expect(result.factCheck.note).toMatch(/Listing Knowledge/);
      expect(validateStressTestClaims).not.toHaveBeenCalled();
    });

    it("Fact Validator runs a real LLM call and grounds findings in real Listing Knowledge hits when they exist", async () => {
      const validateStressTestClaims = vi.fn(async () => ({
        available: true as const,
        findings: [
          {
            claim: "Dekat stasiun",
            status: "SUPPORTED" as const,
            reasoning: "Dokumen brosur menyebut jarak 300m ke stasiun.",
            citationDocumentId: "doc-1",
            citationFileName: "brosur.pdf",
          },
        ],
      }));
      const listingKnowledge = {
        retrieve: vi.fn(async () => ({
          hits: [
            {
              id: "hit-1",
              document_id: "doc-1",
              file_name: "brosur.pdf",
              text_content: "Jarak 300m ke stasiun KRL.",
              source: {},
              facts: [],
              score: 0.9,
            },
          ],
          mode: "HYBRID",
        })),
      };
      const service = buildService({ llm: { validateStressTestClaims }, listingKnowledge });
      const created = await service.createRun(BODY, "dss-motor");
      const executed = await service.execute(created.id, "dss-motor");

      const result = executed.result as StressTestEvaluatedResult;
      expect(result.factCheck.status).toBe("CHECKED");
      expect(result.factCheck.findings).toHaveLength(1);
      expect(validateStressTestClaims).toHaveBeenCalledTimes(1);
    });

    it("uses the real listing's title/description/price as an honest copy proxy for a LISTING-sourced run (never fabricated ad copy)", async () => {
      const simulateStressTestPersona = vi.fn(async () => SUCCESSFUL_PERSONA_RESPONSE);
      const listings = { getById: vi.fn(async () => fakeListing({ title: "Villa Puncak Asri" })) };
      const service = buildService({ llm: { simulateStressTestPersona }, listings });
      const created = await service.createRun({ ...BODY, mode: "FAST" }, "dss-motor");
      await service.execute(created.id, "dss-motor");

      const callArgs = simulateStressTestPersona.mock.calls[0]?.[1] as {
        creative: { headline?: string; isProxyFromListing: boolean };
      };
      expect(callArgs.creative.headline).toBe("Villa Puncak Asri");
      expect(callArgs.creative.isProxyFromListing).toBe(true);
    });

    it("resolves real creative-package copy for a CAMPAIGN-sourced run (isProxyFromListing: false)", async () => {
      const simulateStressTestPersona = vi.fn(async () => SUCCESSFUL_PERSONA_RESPONSE);
      const pkg = {
        id: "pkg-1",
        copyVariants: [
          {
            id: "v-1",
            variantLabel: "A",
            primaryText: "DP ringan 15 juta",
            headline: "Xpander DP Ringan",
            callToAction: "Chat sekarang",
          },
        ],
        angle: "DP_RINGAN",
        decidedFormat: "IMAGES_ONLY",
        requestedFormat: "IMAGES_ONLY",
        imageUrls: [],
      } as unknown as StoredCreativePackage;
      const creativePackages = { findById: vi.fn(async () => pkg) };
      const service = buildService({
        llm: { simulateStressTestPersona },
        creativePackages,
      });
      const created = await service.createRun(
        {
          ...BODY,
          mode: "FAST",
          sourceType: "CAMPAIGN",
          listingId: undefined,
          campaignId: "campaign-1",
          creativeIds: ["pkg-1"],
        },
        "dss-motor",
      );
      await service.execute(created.id, "dss-motor");

      const callArgs = simulateStressTestPersona.mock.calls[0]?.[1] as {
        creative: { headline?: string; isProxyFromListing: boolean };
      };
      expect(callArgs.creative.headline).toBe("Xpander DP Ringan");
      expect(callArgs.creative.isProxyFromListing).toBe(false);
    });

    it("execute is a no-op when called on an already-executed run", async () => {
      const service = buildService();
      const created = await service.createRun(BODY, "dss-motor");
      const first = await service.execute(created.id, "dss-motor");
      const again = await service.execute(created.id, "dss-motor");
      expect(again.status).toBe(first.status);
    });
  });
});

describe("CreativeStressTestService — Objection Resolution, progress, partial results", () => {
  const FAILED_LLM = {
    available: false as const,
    reason: "PROVIDER_ERROR" as const,
    message: "boom",
  };

  it("runs Objection Resolution after persona critiques with real listing facts + grouped objections, and persists it (counted as an evaluator)", async () => {
    const order: string[] = [];
    const simulateStressTestPersona = vi.fn(async () => {
      order.push("persona");
      return SUCCESSFUL_PERSONA_RESPONSE;
    });
    const evaluateStressTestObjectionResolution = vi.fn(async () => {
      order.push("resolution");
      return SUCCESSFUL_RESOLUTION_RESPONSE;
    });
    const service = buildService({
      llm: { simulateStressTestPersona, evaluateStressTestObjectionResolution },
    });
    const created = await service.createRun(BODY, "dss-motor");
    const executed = await service.execute(created.id, "dss-motor");

    expect(order.at(-1)).toBe("resolution");
    expect(evaluateStressTestObjectionResolution).toHaveBeenCalledTimes(1);
    const req = evaluateStressTestObjectionResolution.mock.calls[0]?.[1] as {
      listingFacts: Record<string, unknown>;
      objections: { id: string; objection: string; personaLabels: string[] }[];
    };
    expect(req.listingFacts.price).toBe(1_500_000_000);
    expect(req.listingFacts.title).toBe("Rumah Bintaro 2 Lantai");
    // 3 personas raised the same objection -> ONE grouped objection.
    expect(req.objections).toHaveLength(1);
    expect(req.objections[0]?.id).toBe("o1");
    expect(req.objections[0]?.personaLabels).toHaveLength(3);

    expect(executed.status).toBe("COMPLETED");
    const result = executed.result as StressTestEvaluatedResult;
    expect(result.objectionResolution?.status).toBe("ASSESSED");
    expect(result.objectionResolution?.simulated).toBe(true);
    expect(result.objectionResolution?.items[0]).toMatchObject({
      key: "harga dirasa tinggi",
      resolutionStatus: "PARTIAL",
      goalImpact: "HIGH",
      evidence: "Harga: Rp 1.500.000.000",
    });
    expect(result.evaluatorsAttempted).toBe(5); // 3 personas + copy + objection resolution
    expect(result.evaluatorsSucceeded).toBe(5);
  });

  it("downgrades a RESOLVED assessment whose evidence quote is not in the creative text to UNRESOLVED", async () => {
    const evaluateStressTestObjectionResolution = vi.fn(async () => ({
      ...SUCCESSFUL_RESOLUTION_RESPONSE,
      assessments: [
        {
          id: "o1",
          resolutionStatus: "RESOLVED" as const,
          goalImpact: "VERY_HIGH" as const,
          shortRecommendation: "Sudah dijawab.",
          evidence: "Cicilan hanya 5 juta per bulan",
        },
      ],
    }));
    const service = buildService({ llm: { evaluateStressTestObjectionResolution } });
    const created = await service.createRun(BODY, "dss-motor");
    const result = (await service.execute(created.id, "dss-motor"))
      .result as StressTestEvaluatedResult;
    const item = result.objectionResolution?.items[0];
    expect(item?.resolutionStatus).toBe("UNRESOLVED");
    expect(item?.evidence).toBeNull();
    expect(item?.adjustment).toBe("EVIDENCE_NOT_FOUND");
  });

  it("REQUIRES_KNOWLEDGE: the recommendation names the missing fact with 'Butuh data:'", async () => {
    const evaluateStressTestObjectionResolution = vi.fn(async () => ({
      ...SUCCESSFUL_RESOLUTION_RESPONSE,
      assessments: [
        {
          id: "o1",
          resolutionStatus: "REQUIRES_KNOWLEDGE" as const,
          goalImpact: "MEDIUM" as const,
          shortRecommendation: "harga per meter pembanding di area Bintaro",
          evidence: null,
        },
      ],
    }));
    const service = buildService({ llm: { evaluateStressTestObjectionResolution } });
    const created = await service.createRun(BODY, "dss-motor");
    const result = (await service.execute(created.id, "dss-motor"))
      .result as StressTestEvaluatedResult;
    expect(result.objectionResolution?.items[0]?.resolutionStatus).toBe("REQUIRES_KNOWLEDGE");
    expect(result.objectionResolution?.items[0]?.shortRecommendation).toBe(
      "Butuh data: harga per meter pembanding di area Bintaro",
    );
  });

  it("Objection Resolution failure -> honest gap + reduced confidence, the run still COMPLETES", async () => {
    const service = buildService({
      llm: { evaluateStressTestObjectionResolution: vi.fn(async () => FAILED_LLM) },
    });
    const created = await service.createRun(BODY, "dss-motor");
    const executed = await service.execute(created.id, "dss-motor");
    expect(executed.status).toBe("COMPLETED");
    const result = executed.result as StressTestEvaluatedResult;
    expect(result.objectionResolution?.status).toBe("FAILED");
    expect(result.objectionResolution?.items).toEqual([]);
    expect(result.gaps.some((g) => g.includes("Objection Resolution Evaluator gagal"))).toBe(true);
    expect(result.evaluatorsAttempted).toBe(5);
    expect(result.evaluatorsSucceeded).toBe(4);
    expect(result.progress?.steps.find((s) => s.key === "OBJECTION_RESOLUTION")?.state).toBe(
      "FAILED",
    );
  });

  it("skips Objection Resolution (no LLM call, not counted) when no persona simulation succeeded", async () => {
    const evaluateStressTestObjectionResolution = vi.fn();
    const service = buildService({
      llm: {
        simulateStressTestPersona: vi.fn(async () => FAILED_LLM),
        evaluateStressTestObjectionResolution,
      },
    });
    const created = await service.createRun(BODY, "dss-motor");
    const executed = await service.execute(created.id, "dss-motor");
    expect(executed.status).toBe("COMPLETED"); // copy evaluator still produced real scores
    const result = executed.result as StressTestEvaluatedResult;
    expect(evaluateStressTestObjectionResolution).not.toHaveBeenCalled();
    expect(result.objectionResolution?.status).toBe("SKIPPED");
    expect(result.evaluatorsAttempted).toBe(4);
  });

  it("persists per-evaluator progress while running (visible to a polling GET) and the final step states on the result", async () => {
    const repository = new StressTestRunRepository(createFakeSupabaseClient());
    const markRunning = vi.spyOn(repository, "markRunning");
    const updateProgress = vi.spyOn(repository, "updateProgress");
    let runId = "";
    let midRun: { status: string; kind: string | undefined } | undefined;
    const evaluateStressTestCopy = vi.fn(async () => {
      const seen = await repository.findById("dss-motor", runId);
      midRun = { status: seen?.status ?? "", kind: seen?.result?.kind };
      return SUCCESSFUL_COPY_RESPONSE;
    });
    const service = buildService({ repository, llm: { evaluateStressTestCopy } });
    const created = await service.createRun(BODY, "dss-motor");
    runId = created.id;
    const executed = await service.execute(created.id, "dss-motor");

    expect(midRun).toEqual({ status: "RUNNING", kind: "IN_PROGRESS" });
    expect(markRunning).toHaveBeenCalledTimes(1);
    const initial = markRunning.mock.calls[0]?.[1] as StressTestRunProgress;
    expect(initial.steps.map((s) => `${s.key}:${s.state}`)).toEqual([
      "PERSONA_SIMULATION:RUNNING",
      "COPY_EVALUATION:RUNNING",
      "FACT_VALIDATION:RUNNING",
      "OBJECTION_RESOLUTION:PENDING",
    ]);
    // 3 persona settles + copy + fact + resolution RUNNING + resolution DONE = 7 state changes, one write each.
    expect(updateProgress).toHaveBeenCalledTimes(7);
    const personaCounts = updateProgress.mock.calls
      .map((c) => (c[1] as StressTestRunProgress).steps[0]?.done)
      .filter((d): d is number => d !== undefined);
    expect(Math.max(...personaCounts)).toBe(3);

    const result = executed.result as StressTestEvaluatedResult;
    expect(result.progress?.steps.map((s) => `${s.key}:${s.state}`)).toEqual([
      "PERSONA_SIMULATION:DONE",
      "COPY_EVALUATION:DONE",
      "FACT_VALIDATION:SKIPPED", // NOT_APPLICABLE — no Listing Knowledge
      "OBJECTION_RESOLUTION:DONE",
    ]);
    // A late progress write can never overwrite the terminal row.
    await repository.updateProgress(created.id, initial);
    const after = await service.getRun(created.id, "dss-motor");
    expect(after.result?.kind).toBe("COMPLETED");
  });

  it("FAILED run keeps real partial outputs (fact-check findings) flagged partial, with no score", async () => {
    const validateStressTestClaims = vi.fn(async () => ({
      available: true as const,
      findings: [{ claim: "Dekat stasiun", status: "SUPPORTED" as const, reasoning: "Brosur." }],
    }));
    const listingKnowledge = {
      retrieve: vi.fn(async () => ({
        hits: [
          {
            id: "h",
            document_id: "doc-1",
            file_name: "brosur.pdf",
            text_content: "300m ke stasiun",
            source: {},
            facts: [],
            score: 1,
          },
        ],
        mode: "HYBRID",
      })),
    };
    const service = buildService({
      llm: {
        simulateStressTestPersona: vi.fn(async () => FAILED_LLM),
        evaluateStressTestCopy: vi.fn(async () => FAILED_LLM),
        validateStressTestClaims,
      },
      listingKnowledge,
    });
    const created = await service.createRun(BODY, "dss-motor");
    const executed = await service.execute(created.id, "dss-motor");

    expect(executed.status).toBe("FAILED");
    expect(executed.failedReason).toMatch(/Semua evaluator gagal/);
    const partial = executed.result as StressTestPartialResult;
    expect(partial.kind).toBe("PARTIAL");
    expect(partial.hasRealOutput).toBe(true);
    expect(partial.factCheck?.status).toBe("CHECKED");
    expect(partial.factCheck?.findings).toHaveLength(1);
    expect(partial.evaluatorsSucceeded).toBe(0);
    expect(partial).not.toHaveProperty("overallScore");
    expect(partial.progress.steps.map((s) => s.state)).toEqual([
      "FAILED",
      "FAILED",
      "DONE",
      "SKIPPED",
    ]);
  });

  it("an unexpected error mid-run lands on FAILED with the real reason and the outputs that had settled", async () => {
    const service = buildService({
      llm: {
        evaluateStressTestCopy: vi.fn(async () => {
          throw new Error("kaboom");
        }),
      },
    });
    const created = await service.createRun(BODY, "dss-motor");
    const executed = await service.execute(created.id, "dss-motor");

    expect(executed.status).toBe("FAILED");
    expect(executed.failedReason).toContain("kaboom");
    const partial = executed.result as StressTestPartialResult;
    expect(partial.partial).toBe(true);
    expect(partial.hasRealOutput).toBe(true);
    expect(partial.personaCritiques.filter((p) => p.ok)).toHaveLength(3);
    expect(partial.copyEvaluation).toBeUndefined();
    expect(partial.objectionResolution?.status).toBe("ASSESSED");
    expect(partial.progress.steps.find((s) => s.key === "COPY_EVALUATION")?.state).toBe("FAILED");
  });
});

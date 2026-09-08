import type { AssetLibrary } from "@aos/asset-library";
import type { BranchManager } from "@aos/branch-manager";
import { err, ok } from "@aos/common";
import type { CreativePackage, KaiAgentRuntime } from "@aos/creative-agent";
import { GenerationError, PropertyAdAngle } from "@aos/creative-agent";
import { NotFoundError, UnavailableError, ValidationError } from "@aos/errors";
import { describe, expect, it, vi } from "vitest";

import {
  createFakeSupabaseClient,
  type FakeSupabaseClient,
} from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import type { ActivityLogger } from "../activity-log/activity-logger.service.js";
import { AgentRunsService } from "../agent-runs/agent-runs.service.js";
import { AgentRunRepository } from "../agent-runs/infrastructure/agent-run.repository.js";
import type { AiJudgeService } from "../ai-judge/ai-judge.service.js";
import type { AuditLogService } from "../audit-log/audit-log.service.js";
import type { ListingsService } from "../listings/listings.service.js";
import type { ModeGuardService } from "../mode-guard/mode-guard.service.js";

import { CreativePackagesService } from "./creative-packages.service.js";
import type { CreatePackageBodyDto } from "./dto/create-package.dto.js";
import type { PropertyCreatePackageBodyDto } from "./dto/create-property-package.dto.js";
import { CreativeLogRepository } from "./infrastructure/creative-log.repository.js";
import { CreativePackageRepository } from "./infrastructure/creative-package.repository.js";

const BODY: CreatePackageBodyDto = {
  unit: "xpander-gls-2022-001",
  unitModel: "Xpander GLS 2022",
  branch: "CINERE",
  angle: "DP_RINGAN",
  targetPersona: "PRIMARY_FAMILY",
  primaryMessage: "DP mulai 29 juta, cicilan 5 jutaan",
  format: "VIDEO_AND_IMAGES",
  urgency: "HIGH",
  origin: "MANUAL",
  generate: false,
};

/** A minimal real-shaped `CreativePackage` stand-in — only the getters the service reads. */
function buildKaiPackage(overrides: Partial<Record<string, unknown>> = {}): CreativePackage {
  return {
    videoUrl: "https://storage.googleapis.com/aoos/ai-creatives/x/video.mp4",
    videoSpec: { model: "veo3_fast" },
    imageUrls: ["https://storage.googleapis.com/aoos/ai-creatives/x/img-1.jpg"],
    imageSpecs: [{ model: "nano-banana-pro" }],
    copyVariants: [
      {
        id: "v-a",
        variantLabel: "A",
        primaryText: "DP 29 juta bawa pulang Xpander",
        headline: "DP Ringan",
        callToAction: "Hubungi Sekarang",
      },
      {
        id: "v-b",
        variantLabel: "B",
        primaryText: "Keluarga makin nyaman dengan Xpander",
        headline: "Nyaman Sekeluarga",
        callToAction: "Pelajari Lebih Lanjut",
      },
    ],
    confidenceScore: { toNumber: () => 0.83 },
    totalGenerationMs: 563_000,
    ...overrides,
  } as unknown as CreativePackage;
}

interface FakeListing {
  readonly id: string;
  readonly tenantId: string;
  readonly title: string;
  readonly propertyType?: string;
  readonly branchId?: string;
  readonly waNumber?: string;
  readonly highlights?: readonly string[];
  readonly photos?: readonly string[];
}

interface Harness {
  readonly service: CreativePackagesService;
  readonly client: FakeSupabaseClient;
  readonly processCreativeBrief: ReturnType<typeof vi.fn>;
  readonly getAssetsByUnit: ReturnType<typeof vi.fn>;
  readonly getListingById: ReturnType<typeof vi.fn>;
  readonly orchestrate: ReturnType<typeof vi.fn>;
  readonly assetStorageUpload: ReturnType<typeof vi.fn>;
  readonly getAvailableSales: ReturnType<typeof vi.fn>;
  readonly activityLogger: ReturnType<typeof buildFakeActivityLogger>;
  readonly agentRunsService: AgentRunsService;
  readonly aiJudgeService: AiJudgeService;
  readonly auditLog: ReturnType<typeof buildFakeAuditLog>;
}

/** AAOS LOOP UPGRADE, Sprint 8b — minimal `AuditLogService` test double for the new `CREATIVE_GENERATED` writer (`runGenerationPropertyWithQaRetry`). */
function buildFakeAuditLog() {
  return { record: vi.fn(async () => undefined) };
}

/** A fake `AiJudgeService` — `judgeRun`'s own real behavior is exercised on its own in `modules/ai-judge/ai-judge.service.spec.ts`; here we only need to verify `CreativePackagesService`'s real WIRING. */
function buildFakeAiJudgeService(
  judgeRun: (tenantId: string, agentRunId: string) => Promise<void> = async () => undefined,
): AiJudgeService {
  return { judgeRun: vi.fn(judgeRun) } as unknown as AiJudgeService;
}

/** Minimal `ModeGuardService` test double — mirrors `campaigns.service.spec.ts`'s own fake. Always resolves LIVE. */
function buildFakeModeGuard() {
  return {
    resolveMode: async () => "LIVE",
    executeOrSimulate: async <T>(
      _tenantId: string,
      executeFn: () => Promise<T>,
      _simulateFn: () => Promise<T>,
    ): Promise<T> => executeFn(),
  };
}

/** Minimal `ActivityLogger` test double — mirrors `campaigns.service.spec.ts`'s own fake, plus the new `escalate()` (Kai manual-shoot escalation). */
function buildFakeActivityLogger() {
  return {
    start: vi.fn(async () => "activity-1"),
    complete: vi.fn(async () => undefined),
    escalate: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
    logToolCall: vi.fn(async () => undefined),
    logReasoning: vi.fn(async () => undefined),
  };
}

function buildHarness(
  options: {
    readonly kaiConfigured?: boolean;
    readonly assetLibraryConfigured?: boolean;
    readonly photoUrls?: readonly string[];
    readonly photoQueryFails?: boolean;
    readonly kaiResult?: unknown;
    readonly kaiThrows?: Error;
    readonly kaiNeverSettles?: boolean;
    /** K1/K2 — the single real `listings` row `ListingsService.getById` resolves in this harness. */
    readonly listing?: FakeListing;
    readonly orchestrateResult?: unknown;
    readonly orchestrateNeverSettles?: boolean;
    readonly uploadFails?: boolean;
    /** Kai manual-shoot escalation — the real sales humans `BranchManager.getAvailableSales` resolves for the listing's `branchId`. */
    readonly salesHumans?: ReadonlyArray<{ readonly name: string; readonly branchId: string }>;
    /** Simulates `GetAvailableSales`/branch resolution failing outright — the escalation must still degrade honestly (empty array), never crash `generateProperty`. */
    readonly salesResolutionThrows?: boolean;
    /** AAOS-AI-JUDGE-SELF-IMPROVING (Phase J1) — forces the real `agent_runs` insert to fail once, exercising the best-effort discipline end to end. */
    readonly agentRunInsertFails?: boolean;
    /** AAOS-AI-JUDGE-SELF-IMPROVING (Phase J2) — a real (fake, `vi.fn`-backed) `AiJudgeService`; override to assert wiring or simulate a `judgeRun` rejection. */
    readonly aiJudgeService?: AiJudgeService;
  } = {},
): Harness {
  const client = createFakeSupabaseClient();
  if (options.agentRunInsertFails === true) {
    client.forceErrorOnce("agent_runs", "simulated DB outage");
  }
  const processCreativeBrief = vi.fn(async () => {
    if (options.kaiNeverSettles === true) {
      return new Promise(() => undefined);
    }
    if (options.kaiThrows !== undefined) {
      throw options.kaiThrows;
    }
    return options.kaiResult ?? ok(buildKaiPackage());
  });
  const getAssetsByUnit = vi.fn(async () =>
    options.photoQueryFails === true
      ? err(new Error("supabase down"))
      : ok({
          assets: (options.photoUrls ?? []).map((url) => ({
            publicUrl: { toString: () => url },
          })),
        }),
  );

  const getListingById = vi.fn(async (tenantId: string, id: string) => {
    const listing = options.listing;
    if (listing === undefined || listing.id !== id || listing.tenantId !== tenantId) {
      throw new NotFoundError(`No listing found for id "${id}"`);
    }
    return {
      id: listing.id,
      title: listing.title,
      propertyType: listing.propertyType ?? "RUMAH",
      listingStatus: "AKTIF",
      price: 500_000_000,
      ...(listing.branchId !== undefined ? { branchId: listing.branchId } : {}),
      ...(listing.waNumber !== undefined ? { waNumber: listing.waNumber } : {}),
      highlights: listing.highlights ?? [],
      photos: (listing.photos ?? []).map((url, index) => ({
        id: `photo-${String(index)}`,
        url,
        order: index,
        isMain: index === 0,
      })),
      documents: [],
      inKnowledgeBase: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
  });
  const listingsService = { getById: getListingById } as unknown as ListingsService;

  const orchestrate = vi.fn(async () => {
    if (options.orchestrateNeverSettles === true) {
      return new Promise(() => undefined);
    }
    return (
      options.orchestrateResult ??
      ok({
        imageBuffers: [Buffer.from("fake-image-bytes")],
        imageSpecs: [],
        videoDelivered: false,
      })
    );
  });
  const assetStorageUpload = vi.fn(async ({ path }: { path: string }) =>
    options.uploadFails === true
      ? err(new Error("gcs upload failed"))
      : ok({ path, publicUrl: `https://storage.googleapis.com/${path}` }),
  );

  const kai =
    options.kaiConfigured === false
      ? undefined
      : ({
          processCreativeBrief: { execute: processCreativeBrief },
          orchestratorService: { orchestrate },
        } as unknown as KaiAgentRuntime);
  const assetLibrary =
    options.assetLibraryConfigured === false
      ? undefined
      : ({
          getAssetsByUnit: { execute: getAssetsByUnit },
          assetStorage: { upload: assetStorageUpload },
        } as unknown as AssetLibrary);

  const getAvailableSales = vi.fn(() => {
    if (options.salesResolutionThrows === true) {
      throw new Error("sales team registry unavailable");
    }
    return { ok: true, value: options.salesHumans ?? [] };
  });
  const branchManager = {
    getAvailableSales: { execute: getAvailableSales },
  } as unknown as BranchManager;
  const activityLogger = buildFakeActivityLogger();
  const agentRunsService = new AgentRunsService(new AgentRunRepository(client));
  const aiJudgeService = options.aiJudgeService ?? buildFakeAiJudgeService();
  const auditLog = buildFakeAuditLog();

  const service = new CreativePackagesService(
    buildTestConfig(),
    kai,
    assetLibrary,
    branchManager,
    new CreativePackageRepository(client),
    new CreativeLogRepository(client),
    listingsService,
    buildFakeModeGuard() as unknown as ModeGuardService,
    activityLogger as unknown as ActivityLogger,
    agentRunsService,
    aiJudgeService,
    auditLog as unknown as AuditLogService,
  );
  return {
    service,
    client,
    processCreativeBrief,
    getAssetsByUnit,
    getListingById,
    orchestrate,
    assetStorageUpload,
    getAvailableSales,
    activityLogger,
    agentRunsService,
    aiJudgeService,
    auditLog,
  };
}

/** The pipeline is detached; let its microtasks settle before asserting persisted state. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("CreativePackagesService.create", () => {
  it("persists a DRAFT and calls NOTHING — no Kie AI spend without an explicit generate", async () => {
    const harness = buildHarness();
    const created = await harness.service.create(BODY);
    expect(created.status).toBe("DRAFT");
    expect(created.origin).toBe("MANUAL");
    expect(created.requestedFormat).toBe("VIDEO_AND_IMAGES");
    expect(harness.processCreativeBrief).not.toHaveBeenCalled();
    expect(harness.getAssetsByUnit).not.toHaveBeenCalled();
    expect(harness.client.rows("creative_logs")).toHaveLength(0);
  });

  it("derives a readable title when none is given", async () => {
    const created = await buildHarness().service.create(BODY);
    expect(created.title).toBe("Xpander GLS 2022 CINERE · DP_RINGAN");
  });

  it("keeps an explicit title", async () => {
    const created = await buildHarness().service.create({ ...BODY, title: "Promo Agustus" });
    expect(created.title).toBe("Promo Agustus");
  });

  it("records an honest default reason per origin when the manager gives none", async () => {
    const manual = await buildHarness().service.create(BODY);
    expect(manual.reason).toBe("Brief manual dibuat manager.");
    const samantha = await buildHarness().service.create({ ...BODY, origin: "SAMANTHA" });
    expect(samantha.reason).toBe("Disetujui manager dari rekomendasi Samantha.");
  });

  it("mints a real UUID briefId that the brief factory will accept", async () => {
    const created = await buildHarness().service.create(BODY);
    expect(created.briefId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("runs the real pipeline immediately when generate:true (the same explicit human click)", async () => {
    const harness = buildHarness({ photoUrls: ["https://gcs/foto-1.jpg"] });
    const created = await harness.service.create({ ...BODY, generate: true });
    expect(created.status).toBe("GENERATING");
    expect(harness.processCreativeBrief).toHaveBeenCalledTimes(1);
  });
});

describe("CreativePackagesService.generate", () => {
  it("raises an honest 503 (never a fake queued job) when Kai is not configured", async () => {
    const harness = buildHarness({ kaiConfigured: false });
    const created = await harness.service.create(BODY);
    await expect(harness.service.generate(created.id)).rejects.toThrow(UnavailableError);
    const after = await harness.service.byId(created.id);
    expect(after.package.status).toBe("DRAFT");
  });

  it("404s for an unknown package", async () => {
    await expect(buildHarness().service.generate("nope")).rejects.toThrow(NotFoundError);
  });

  it("refuses to start a second run while one is already GENERATING", async () => {
    // A pipeline that never settles — the real one takes minutes, so this is the realistic case.
    const harness = buildHarness({ kaiNeverSettles: true });
    const created = await harness.service.create({ ...BODY, generate: true });
    await settle();
    await expect(harness.service.generate(created.id)).rejects.toThrow(ValidationError);
    expect(harness.processCreativeBrief).toHaveBeenCalledTimes(1);
  });

  it("records the REAL source photos found for the unit before starting", async () => {
    const harness = buildHarness({
      photoUrls: ["https://gcs/foto-1.jpg", "https://gcs/foto-2.jpg"],
    });
    const created = await harness.service.create(BODY);
    const generating = await harness.service.generate(created.id);
    expect(harness.getAssetsByUnit).toHaveBeenCalledWith({ unitId: "xpander-gls-2022-001" });
    expect(generating.sourcePhotoUrls).toEqual([
      "https://gcs/foto-1.jpg",
      "https://gcs/foto-2.jpg",
    ]);
  });

  it("records an empty source-photo list honestly when the unit has no scraped photos", async () => {
    const harness = buildHarness({ photoUrls: [] });
    const created = await harness.service.create(BODY);
    const generating = await harness.service.generate(created.id);
    expect(generating.sourcePhotoUrls).toEqual([]);
    const logs = await harness.service.logs({ limit: 100 });
    const generateLog = logs.find((entry) => entry.eventType === "GENERATE");
    expect(generateLog?.message).toContain("tidak ada foto unit");
  });

  it("degrades to [] (never aborts an authorised generation) when the photo query fails", async () => {
    const harness = buildHarness({ photoQueryFails: true });
    const created = await harness.service.create(BODY);
    const generating = await harness.service.generate(created.id);
    expect(generating.sourcePhotoUrls).toEqual([]);
    expect(harness.processCreativeBrief).toHaveBeenCalled();
  });

  it("degrades to [] when no asset library is configured at all", async () => {
    const harness = buildHarness({ assetLibraryConfigured: false });
    const created = await harness.service.create(BODY);
    const generating = await harness.service.generate(created.id);
    expect(generating.sourcePhotoUrls).toEqual([]);
  });

  it("writes BRIEF_SENT then GENERATE, both describing what really happened", async () => {
    const harness = buildHarness({ photoUrls: ["https://gcs/foto-1.jpg"] });
    const created = await harness.service.create(BODY);
    await harness.service.generate(created.id);
    const logs = await harness.service.logs({ limit: 100 });
    const brief = logs.find((entry) => entry.eventType === "BRIEF_SENT");
    const generate = logs.find((entry) => entry.eventType === "GENERATE");
    expect(brief?.fromAgent).toBe("MANAGER");
    expect(brief?.toAgent).toBe("KAI");
    expect(brief?.brief).toMatchObject({ unit: "xpander-gls-2022-001", angle: "DP_RINGAN" });
    expect(generate?.fromAgent).toBe("KAI");
    expect(generate?.toAgent).toBe("KIE_AI");
    expect(generate?.metadata).toMatchObject({ sourcePhotosFound: 1 });
  });

  it("attributes a Samantha-approved brief to SAMANTHA and carries its real ad ids into the log", async () => {
    const harness = buildHarness();
    const created = await harness.service.create({
      ...BODY,
      origin: "SAMANTHA",
      adId: "120000000000001",
      stableId: "C047",
    });
    await harness.service.generate(created.id);
    const brief = (await harness.service.logs({ limit: 100 })).find(
      (entry) => entry.eventType === "BRIEF_SENT",
    );
    expect(brief?.fromAgent).toBe("SAMANTHA");
    expect(brief?.adId).toBe("120000000000001");
    expect(brief?.stableId).toBe("C047");
  });

  it("fails the package (and logs ERROR) when the persisted brief is invalid", async () => {
    const harness = buildHarness();
    const created = await harness.service.create(BODY);
    // Corrupt the persisted angle to a value `AdAngle` does not contain.
    const row = harness.client.rows("creative_packages")[0];
    if (row !== undefined) row["angle"] = "PROMO";
    await expect(harness.service.generate(created.id)).rejects.toThrow(/valid AdAngle/);
    const after = await harness.service.byId(created.id);
    expect(after.package.status).toBe("FAILED");
    expect(after.logs.some((entry) => entry.eventType === "ERROR")).toBe(true);
    expect(harness.processCreativeBrief).not.toHaveBeenCalled();
  });

  it("lands the REAL returned package: media urls, copy variants, real Kie AI model strings", async () => {
    const harness = buildHarness({ photoUrls: ["https://gcs/foto-1.jpg"] });
    const created = await harness.service.create(BODY);
    await harness.service.generate(created.id);
    await settle();
    const after = await harness.service.byId(created.id);
    expect(after.package.status).toBe("PENDING");
    expect(after.package.decidedFormat).toBe("VIDEO_AND_IMAGES");
    expect(after.package.videoUrl).toContain("video.mp4");
    expect(after.package.imageUrls).toHaveLength(1);
    expect(after.package.copyVariants.map((v) => v.variantLabel)).toEqual(["A", "B"]);
    // The real enum values, including nano-banana-pro's real `google/` prefix.
    expect(after.package.aiModel).toBe("veo3_fast+nano-banana-pro");
    expect(after.package.confidenceScore).toBe(0.83);
    expect(after.package.generationMs).toBe(563_000);
    const complete = after.logs.find((entry) => entry.eventType === "COMPLETE");
    expect(complete?.fromAgent).toBe("KIE_AI");
    expect(complete?.metadata).toMatchObject({ model: "veo3_fast+nano-banana-pro" });
  });

  it("records IMAGES_ONLY as the decided format when Kai delivered no video", async () => {
    const harness = buildHarness({
      kaiResult: ok(buildKaiPackage({ videoUrl: undefined, videoSpec: undefined })),
    });
    const created = await harness.service.create(BODY);
    await harness.service.generate(created.id);
    await settle();
    const after = await harness.service.byId(created.id);
    expect(after.package.decidedFormat).toBe("IMAGES_ONLY");
    expect(after.package.videoUrl).toBeUndefined();
    expect(after.package.aiModel).toBe("nano-banana-pro");
  });

  it("persists a FAILED status plus an ERROR log when the real pipeline returns an error", async () => {
    const harness = buildHarness({
      kaiResult: err(new GenerationError("Kie AI timeout after 15 minutes")),
    });
    const created = await harness.service.create(BODY);
    await harness.service.generate(created.id);
    await settle();
    const after = await harness.service.byId(created.id);
    expect(after.package.status).toBe("FAILED");
    expect(after.package.errorMessage).toContain("Kie AI timeout");
    const error = after.logs.find((entry) => entry.eventType === "ERROR");
    expect(error?.error).toContain("Kie AI timeout");
  });

  it("persists a FAILED status when the real pipeline throws (never an unhandled rejection)", async () => {
    const harness = buildHarness({ kaiThrows: new Error("socket hang up") });
    const created = await harness.service.create(BODY);
    await harness.service.generate(created.id);
    await settle();
    const after = await harness.service.byId(created.id);
    expect(after.package.status).toBe("FAILED");
    expect(after.package.errorMessage).toBe("socket hang up");
  });

  it("allows re-generating a FAILED package (the retry path)", async () => {
    const harness = buildHarness({ kaiThrows: new Error("socket hang up") });
    const created = await harness.service.create({ ...BODY, generate: true });
    await settle();
    await expect(harness.service.generate(created.id)).resolves.toMatchObject({
      status: "GENERATING",
    });
  });
});

describe("CreativePackagesService — AAOS-AI-JUDGE-SELF-IMPROVING Phase J1 (AUTOMOTIVE)", () => {
  it("records a real agent_runs row keyed by the real creative_packages id after a successful generation", async () => {
    const harness = buildHarness({ photoUrls: ["https://gcs/foto-1.jpg"] });
    const created = await harness.service.create(BODY);
    await harness.service.generate(created.id);
    await settle();

    const rows = harness.client.rows("agent_runs");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      agent: "KAI",
      run_ref: created.id,
      context: expect.objectContaining({
        vertical: "AUTOMOTIVE",
        angle: "DP_RINGAN",
        status: "PENDING",
        copyVariantCount: 2,
        aiModel: "veo3_fast+nano-banana-pro",
      }),
    });
  });

  it("records a real agent_runs row (status FAILED) when the real pipeline returns an error — not only on success", async () => {
    const harness = buildHarness({
      kaiResult: err(new GenerationError("Kie AI timeout after 15 minutes")),
    });
    const created = await harness.service.create(BODY);
    await harness.service.generate(created.id);
    await settle();

    const rows = harness.client.rows("agent_runs");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      agent: "KAI",
      run_ref: created.id,
      context: expect.objectContaining({ status: "FAILED" }),
    });
  });

  it("a real agent_runs recording failure does not abort the real Kai generation — the package still completes PENDING", async () => {
    const harness = buildHarness({
      photoUrls: ["https://gcs/foto-1.jpg"],
      agentRunInsertFails: true,
    });
    const created = await harness.service.create(BODY);
    await harness.service.generate(created.id);
    await settle();

    expect(harness.client.rows("agent_runs")).toHaveLength(0);
    const after = await harness.service.byId(created.id);
    expect(after.package.status).toBe("PENDING");
  });
});

describe("CreativePackagesService — AAOS-AI-JUDGE-SELF-IMPROVING Phase J2 (real judging wiring)", () => {
  it("awaits AiJudgeService.judgeRun with the real tenantId and the real new agent_runs id, inside the already-detached generation job", async () => {
    const aiJudgeService = buildFakeAiJudgeService();
    const harness = buildHarness({ photoUrls: ["https://gcs/foto-1.jpg"], aiJudgeService });
    const created = await harness.service.create(BODY);
    await harness.service.generate(created.id);
    await settle();

    const runId = harness.client.rows("agent_runs")[0]?.["id"];
    expect(aiJudgeService.judgeRun).toHaveBeenCalledWith("dss-motor", runId);
  });

  it("a judgeRun rejection never aborts the real Kai generation — the package still completes PENDING (best-effort, same discipline as AgentRunsService.record)", async () => {
    const aiJudgeService = buildFakeAiJudgeService(async () => {
      throw new Error("simulated judge failure");
    });
    const harness = buildHarness({ photoUrls: ["https://gcs/foto-1.jpg"], aiJudgeService });
    const created = await harness.service.create(BODY);
    await harness.service.generate(created.id);
    await settle();

    expect(aiJudgeService.judgeRun).toHaveBeenCalled();
    const after = await harness.service.byId(created.id);
    expect(after.package.status).toBe("PENDING");
    expect(harness.client.rows("agent_runs")).toHaveLength(1);
  });

  it("never calls judgeRun when the agent_runs insert itself failed (no real run id to judge)", async () => {
    const aiJudgeService = buildFakeAiJudgeService();
    const harness = buildHarness({
      photoUrls: ["https://gcs/foto-1.jpg"],
      agentRunInsertFails: true,
      aiJudgeService,
    });
    const created = await harness.service.create(BODY);
    await harness.service.generate(created.id);
    await settle();

    expect(aiJudgeService.judgeRun).not.toHaveBeenCalled();
  });
});

describe("CreativePackagesService.list / byId / logs", () => {
  it("lists every package by default and narrows by status", async () => {
    const harness = buildHarness();
    await harness.service.create(BODY);
    await harness.service.create({ ...BODY, generate: true });
    await settle();
    expect(await harness.service.list({ limit: 100 })).toHaveLength(2);
    expect(await harness.service.list({ status: "PENDING", limit: 100 })).toHaveLength(1);
    expect(await harness.service.list({ status: "DRAFT", limit: 100 })).toHaveLength(1);
  });

  it("byId returns the package plus its own real log trail, and never leaks tenantId", async () => {
    const harness = buildHarness();
    const created = await harness.service.create({ ...BODY, generate: true });
    await settle();
    const detail = await harness.service.byId(created.id);
    expect(detail.package.id).toBe(created.id);
    expect(detail.logs.length).toBeGreaterThan(0);
    expect(detail.package).not.toHaveProperty("tenantId");
    expect(detail.logs[0]).not.toHaveProperty("tenantId");
  });

  it("byId 404s for an unknown id", async () => {
    await expect(buildHarness().service.byId("nope")).rejects.toThrow(NotFoundError);
  });

  it("logs applies the relative period bound", async () => {
    const harness = buildHarness();
    await harness.service.create({ ...BODY, generate: true });
    await settle();
    expect((await harness.service.logs({ sinceHours: 24, limit: 100 })).length).toBeGreaterThan(0);
    // Everything written just now is far newer than "one hour before an hour ago".
    expect(await harness.service.logs({ sinceHours: 8760, limit: 100 })).not.toHaveLength(0);
  });

  it("logs filters by eventType", async () => {
    const harness = buildHarness();
    await harness.service.create({ ...BODY, generate: true });
    await settle();
    const complete = await harness.service.logs({ eventType: "COMPLETE", limit: 100 });
    expect(complete).toHaveLength(1);
    expect(complete[0]?.fromAgent).toBe("KIE_AI");
  });
});

describe("CreativePackagesService.approve / reject", () => {
  async function generated(): Promise<{ harness: Harness; id: string }> {
    const harness = buildHarness();
    const created = await harness.service.create({ ...BODY, generate: true });
    await settle();
    return { harness, id: created.id };
  }

  it("approves a PENDING package, defaulting to its first copy variant", async () => {
    const { harness, id } = await generated();
    const approved = await harness.service.approve(id, {}, new Date("2026-08-18T10:05:00.000Z"));
    expect(approved.status).toBe("APPROVED");
    expect(approved.selectedCopyVariantId).toBe("v-a");
    expect(approved.reviewedAt).toBe("2026-08-18T10:05:00.000Z");
  });

  it("honours an explicitly chosen copy variant and logs it", async () => {
    const { harness, id } = await generated();
    await harness.service.approve(id, { selectedCopyVariantId: "v-b" }, new Date());
    const detail = await harness.service.byId(id);
    expect(detail.package.selectedCopyVariantId).toBe("v-b");
    const log = detail.logs.find((entry) => entry.eventType === "APPROVED");
    expect(log?.fromAgent).toBe("MANAGER");
    expect(log?.message).toContain("copy B");
  });

  it("rejects a copy variant that does not belong to the package", async () => {
    const { harness, id } = await generated();
    await expect(
      harness.service.approve(id, { selectedCopyVariantId: "v-z" }, new Date()),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a PENDING package and records the reason", async () => {
    const { harness, id } = await generated();
    const rejected = await harness.service.reject(id, { reason: "tidak on-brand" }, new Date());
    expect(rejected.status).toBe("REJECTED");
    const log = (await harness.service.byId(id)).logs.find(
      (entry) => entry.eventType === "REJECTED",
    );
    expect(log?.message).toContain("tidak on-brand");
    expect(log?.metadata).toMatchObject({ reason: "tidak on-brand" });
  });

  it("rejects without a reason", async () => {
    const { harness, id } = await generated();
    const rejected = await harness.service.reject(id, {}, new Date());
    expect(rejected.status).toBe("REJECTED");
  });

  it("refuses to review a package that is not PENDING (a DRAFT has nothing to review)", async () => {
    const harness = buildHarness();
    const created = await harness.service.create(BODY);
    await expect(harness.service.approve(created.id, {}, new Date())).rejects.toThrow(
      ValidationError,
    );
    await expect(harness.service.reject(created.id, {}, new Date())).rejects.toThrow(
      ValidationError,
    );
  });

  it("404s when approving/rejecting an unknown package", async () => {
    const harness = buildHarness();
    await expect(harness.service.approve("nope", {}, new Date())).rejects.toThrow(NotFoundError);
    await expect(harness.service.reject("nope", {}, new Date())).rejects.toThrow(NotFoundError);
  });
});

describe("CreativePackagesService log-write resilience", () => {
  it("a failed log write never aborts the human's approve", async () => {
    const harness = buildHarness();
    const created = await harness.service.create({ ...BODY, generate: true });
    await settle();
    harness.client.forceErrorOnce("creative_logs", "log table down");
    const approved = await harness.service.approve(created.id, {}, new Date());
    expect(approved.status).toBe("APPROVED");
  });
});

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

const PROPERTY_BODY: PropertyCreatePackageBodyDto = {
  listingId: "listing-1",
  angle: PropertyAdAngle.READY_HUNI,
  format: "VIDEO_AND_IMAGES",
  urgency: "MEDIUM",
  origin: "MANUAL",
  aiRecommended: false,
  generate: false,
};

describe("CreativePackagesService.createProperty (K1)", () => {
  it("persists a PROPERTY DRAFT from a real, tenant-scoped listing — no Kie AI spend without generate:true", async () => {
    const harness = buildHarness({
      listing: { id: "listing-1", tenantId: TENANT_A, title: "Rumah Minimalis BSD" },
    });
    const created = await harness.service.createProperty(TENANT_A, PROPERTY_BODY);
    expect(created.status).toBe("DRAFT");
    expect(created.vertical).toBe("PROPERTY");
    expect(created.listingId).toBe("listing-1");
    expect(created.title).toBe("Rumah Minimalis BSD · READY_HUNI");
    expect(harness.orchestrate).not.toHaveBeenCalled();
    expect(harness.getListingById).toHaveBeenCalledWith(TENANT_A, "listing-1");
  });

  it("404s for a listingId that doesn't exist", async () => {
    const harness = buildHarness();
    await expect(
      harness.service.createProperty(TENANT_A, { ...PROPERTY_BODY, listingId: "nope" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("404s for a listing that belongs to another tenant — real tenant isolation", async () => {
    const harness = buildHarness({
      listing: { id: "listing-1", tenantId: TENANT_A, title: "Rumah Minimalis BSD" },
    });
    // Tenant B asking for tenant A's listing must get the same real 404 a missing id gets — never
    // a cross-tenant leak.
    await expect(harness.service.createProperty(TENANT_B, PROPERTY_BODY)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("042_creative_packages_ai_recommended: persists aiRecommended=false by default for a manually-authored brief", async () => {
    const harness = buildHarness({
      listing: { id: "listing-1", tenantId: TENANT_A, title: "Rumah Minimalis BSD" },
    });
    const created = await harness.service.createProperty(TENANT_A, PROPERTY_BODY);
    expect(created.aiRecommended).toBe(false);
  });

  it("042_creative_packages_ai_recommended: persists aiRecommended=true when the brief was submitted with an accepted Kai recommendation", async () => {
    const harness = buildHarness({
      listing: { id: "listing-1", tenantId: TENANT_A, title: "Rumah Minimalis BSD" },
    });
    const created = await harness.service.createProperty(TENANT_A, {
      ...PROPERTY_BODY,
      aiRecommended: true,
    });
    expect(created.aiRecommended).toBe(true);
    // A real, persisted row (not just the create() response) must also honestly reflect it —
    // proves the value round-trips through the repository/DB layer, not just the in-memory return.
    const [persisted] = harness.client.rows("creative_packages");
    expect(persisted?.["ai_recommended"]).toBe(true);
  });
});

describe("CreativePackagesService.generateProperty (K2)", () => {
  it("resolves sourcePhotoUrls DIRECTLY from listing.photos (no asset-library/unitId) and calls the SAME real CreativeOrchestratorService with those exact URLs", async () => {
    const harness = buildHarness({
      listing: {
        id: "listing-1",
        tenantId: TENANT_A,
        title: "Rumah Minimalis BSD",
        photos: ["https://gcs/listing-1/foto-1.jpg", "https://gcs/listing-1/foto-2.jpg"],
      },
    });
    const created = await harness.service.createProperty(TENANT_A, PROPERTY_BODY);
    const generating = await harness.service.generateProperty(TENANT_A, created.id);
    expect(generating.status).toBe("GENERATING");
    expect(generating.sourcePhotoUrls).toEqual([
      "https://gcs/listing-1/foto-1.jpg",
      "https://gcs/listing-1/foto-2.jpg",
    ]);
    expect(harness.getAssetsByUnit).not.toHaveBeenCalled();
    await settle();
    expect(harness.orchestrate).toHaveBeenCalledTimes(1);
    const call = harness.orchestrate.mock.calls[0]?.[0] as { sourcePhotoUrls: readonly string[] };
    expect(call.sourcePhotoUrls).toEqual([
      "https://gcs/listing-1/foto-1.jpg",
      "https://gcs/listing-1/foto-2.jpg",
    ]);
  });

  it("caps sourcePhotoUrls at Kie AI's real 2-image limit when a listing has more photos", async () => {
    const harness = buildHarness({
      listing: {
        id: "listing-1",
        tenantId: TENANT_A,
        title: "Rumah Minimalis BSD",
        photos: [
          "https://gcs/listing-1/foto-1.jpg",
          "https://gcs/listing-1/foto-2.jpg",
          "https://gcs/listing-1/foto-3.jpg",
        ],
      },
    });
    const created = await harness.service.createProperty(TENANT_A, PROPERTY_BODY);
    const generating = await harness.service.generateProperty(TENANT_A, created.id);
    expect(generating.sourcePhotoUrls).toEqual([
      "https://gcs/listing-1/foto-1.jpg",
      "https://gcs/listing-1/foto-2.jpg",
    ]);
  });

  it("a listing with zero photos degrades to a REAL text-only brief — never a fabricated photo URL", async () => {
    const harness = buildHarness({
      listing: { id: "listing-1", tenantId: TENANT_A, title: "Rumah Minimalis BSD" },
    });
    const created = await harness.service.createProperty(TENANT_A, PROPERTY_BODY);
    const generating = await harness.service.generateProperty(TENANT_A, created.id);
    expect(generating.sourcePhotoUrls).toEqual([]);
    await settle();
    const call = harness.orchestrate.mock.calls[0]?.[0] as { sourcePhotoUrls: readonly string[] };
    expect(call.sourcePhotoUrls).toEqual([]);
  });

  it("a listing with zero photos writes a real NEEDS_HUMAN escalation row with resolved sales humans (Kai manual-shoot escalation)", async () => {
    const harness = buildHarness({
      listing: {
        id: "listing-1",
        tenantId: TENANT_A,
        title: "Rumah Minimalis BSD",
        branchId: "BINTARO",
      },
      salesHumans: [{ name: "Budi Santoso", branchId: "BINTARO" }],
    });
    const created = await harness.service.createProperty(TENANT_A, PROPERTY_BODY);
    await harness.service.generateProperty(TENANT_A, created.id);

    expect(harness.getAvailableSales).toHaveBeenCalledWith({ branchId: "BINTARO" });
    expect(harness.activityLogger.start).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_A,
        agent: "KAI",
        actionType: "CREATIVE_NEEDS_MANUAL_SHOOT",
        input: expect.objectContaining({
          listingId: "listing-1",
          listingTitle: "Rumah Minimalis BSD",
          resolvedSalesHumans: [{ name: "Budi Santoso", branchId: "BINTARO" }],
        }) as unknown,
      }),
    );
    expect(harness.activityLogger.escalate).toHaveBeenCalledWith("activity-1");
  });

  it("a listing with real photos does NOT write the NEEDS_HUMAN escalation row — only the existing normal generation path runs", async () => {
    const harness = buildHarness({
      listing: {
        id: "listing-1",
        tenantId: TENANT_A,
        title: "Rumah Minimalis BSD",
        branchId: "BINTARO",
        photos: ["https://gcs/listing-1/foto-1.jpg"],
      },
    });
    const created = await harness.service.createProperty(TENANT_A, PROPERTY_BODY);
    await harness.service.generateProperty(TENANT_A, created.id);

    expect(harness.getAvailableSales).not.toHaveBeenCalled();
    expect(harness.activityLogger.start).not.toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "CREATIVE_NEEDS_MANUAL_SHOOT" }),
    );
  });

  it("degrades honestly (empty resolvedSalesHumans, generation still completes) when GetAvailableSales/branch resolution throws", async () => {
    const harness = buildHarness({
      listing: {
        id: "listing-1",
        tenantId: TENANT_A,
        title: "Rumah Minimalis BSD",
        branchId: "BINTARO",
      },
      salesResolutionThrows: true,
    });
    const created = await harness.service.createProperty(TENANT_A, PROPERTY_BODY);
    const generating = await harness.service.generateProperty(TENANT_A, created.id);

    expect(generating.status).toBe("GENERATING");
    expect(harness.getAvailableSales).toHaveBeenCalledWith({ branchId: "BINTARO" });
    expect(harness.activityLogger.start).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ resolvedSalesHumans: [] }) as unknown,
      }),
    );
    await settle();
    expect(harness.orchestrate).toHaveBeenCalledTimes(1);
  });

  it("degrades honestly (empty resolvedSalesHumans, no crash) when the listing has no branchId at all", async () => {
    const harness = buildHarness({
      listing: { id: "listing-1", tenantId: TENANT_A, title: "Rumah Minimalis BSD" },
    });
    const created = await harness.service.createProperty(TENANT_A, PROPERTY_BODY);
    const generating = await harness.service.generateProperty(TENANT_A, created.id);

    expect(generating.status).toBe("GENERATING");
    expect(harness.getAvailableSales).not.toHaveBeenCalled();
    expect(harness.activityLogger.start).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ resolvedSalesHumans: [] }) as unknown,
      }),
    );
  });

  it("persists generated media via the shared IAssetStorage adapter and completes as PENDING", async () => {
    const harness = buildHarness({
      listing: {
        id: "listing-1",
        tenantId: TENANT_A,
        title: "Rumah Minimalis BSD",
        photos: ["https://gcs/listing-1/foto-1.jpg"],
      },
    });
    const created = await harness.service.createProperty(TENANT_A, PROPERTY_BODY);
    await harness.service.generateProperty(TENANT_A, created.id);
    await settle();
    // `byId`/`list`/`logs` all still read `AAOS_API_CONFIG.AAOS_TENANT_ID` (the pre-existing,
    // unfixed gap `generateProperty`'s own docstring flags), so a PROPERTY row persisted under a
    // real per-request `tenantId` is asserted directly against the repository's raw row here
    // rather than through those tenant-blind read paths.
    const [row] = harness.client
      .rows("creative_packages")
      .filter((r) => r["id"] === created.id) as Array<Record<string, unknown>>;
    expect(row?.["status"]).toBe("PENDING");
    expect(row?.["image_urls"]).toHaveLength(1);
    expect((row?.["image_urls"] as string[])[0]).toContain("creative-property/");
    expect((row?.["copy_variants"] as unknown[]).length).toBeGreaterThan(0);
    expect(harness.assetStorageUpload).toHaveBeenCalled();
  });

  it("404s for an unknown package", async () => {
    await expect(buildHarness().service.generateProperty(TENANT_A, "nope")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("refuses generateProperty on an AUTOMOTIVE package", async () => {
    const harness = buildHarness({ photoUrls: [] });
    const automotive = await harness.service.create(BODY);
    // The AUTOMOTIVE row is persisted under `AAOS_API_CONFIG.AAOS_TENANT_ID` ("dss-motor",
    // `buildTestConfig`'s default) — looking it up under an unrelated PROPERTY tenantId 404s
    // exactly like any other cross-tenant lookup, never silently finding it.
    await expect(harness.service.generateProperty(TENANT_A, automotive.id)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("CreativePackagesService — AAOS-AI-JUDGE-SELF-IMPROVING Phase J1 (PROPERTY)", () => {
  it("records a real agent_runs row keyed by the real creative_packages id after a successful PROPERTY generation — the SAME helper the AUTOMOTIVE path reuses", async () => {
    const harness = buildHarness({
      listing: {
        id: "listing-1",
        tenantId: TENANT_A,
        title: "Rumah Minimalis BSD",
        photos: ["https://gcs/listing-1/foto-1.jpg"],
      },
    });
    const created = await harness.service.createProperty(TENANT_A, PROPERTY_BODY);
    await harness.service.generateProperty(TENANT_A, created.id);
    await settle();

    const rows = harness.client.rows("agent_runs");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tenant_id: TENANT_A,
      agent: "KAI",
      run_ref: created.id,
      context: expect.objectContaining({ vertical: "PROPERTY", status: "PENDING" }),
    });
  });

  it("records a real agent_runs row (status FAILED) when the real PROPERTY orchestration fails — not only on success", async () => {
    const harness = buildHarness({
      listing: {
        id: "listing-1",
        tenantId: TENANT_A,
        title: "Rumah Minimalis BSD",
        photos: ["https://gcs/listing-1/foto-1.jpg"],
      },
      orchestrateResult: err(new GenerationError("Kie AI timeout after 15 minutes")),
    });
    const created = await harness.service.createProperty(TENANT_A, PROPERTY_BODY);
    await harness.service.generateProperty(TENANT_A, created.id);
    await settle();

    const rows = harness.client.rows("agent_runs");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      agent: "KAI",
      run_ref: created.id,
      context: expect.objectContaining({ status: "FAILED" }),
    });
  });

  it("a real agent_runs recording failure does not abort the real PROPERTY generation — the package still completes PENDING", async () => {
    const harness = buildHarness({
      listing: {
        id: "listing-1",
        tenantId: TENANT_A,
        title: "Rumah Minimalis BSD",
        photos: ["https://gcs/listing-1/foto-1.jpg"],
      },
      agentRunInsertFails: true,
    });
    const created = await harness.service.createProperty(TENANT_A, PROPERTY_BODY);
    await harness.service.generateProperty(TENANT_A, created.id);
    await settle();

    expect(harness.client.rows("agent_runs")).toHaveLength(0);
    const [row] = harness.client
      .rows("creative_packages")
      .filter((r) => r["id"] === created.id) as Array<Record<string, unknown>>;
    expect(row?.["status"]).toBe("PENDING");
  });
});

// =================================================================================================
// AAOS LOOP UPGRADE, Sprint 8b (Prompt 19 Step 4) — `triggerAutoLoopGeneration` real auto-trigger +
// QA/retry pipeline.
// =================================================================================================

/** Builds a real, minimal-but-structurally-valid JPEG buffer with a genuine SOF0 marker — the exact real bytes `runQaChecks`' JPEG parser reads. Mirrors `domain/creative-qa.spec.ts`'s own helper. */
function buildJpegBuffer(width: number, height: number, totalSize = 6_000): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  const app0 = Buffer.from([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01,
    0x00, 0x00,
  ]);
  const sof0 = Buffer.alloc(13);
  sof0[0] = 0xff;
  sof0[1] = 0xc0;
  sof0.writeUInt16BE(11, 2);
  sof0[4] = 0x08;
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);
  sof0[9] = 0x01;
  sof0[10] = 0x01;
  sof0[11] = 0x11;
  sof0[12] = 0x00;
  const eoi = Buffer.from([0xff, 0xd9]);
  const headerLen = soi.length + app0.length + sof0.length + eoi.length;
  const padding = Buffer.alloc(Math.max(0, totalSize - headerLen), 0x00);
  return Buffer.concat([soi, app0, sof0, padding, eoi]);
}

/** A real 1080x1080 (1:1) JPEG — matches `PropertyFormatDecider.decideImageSpec`'s real default `aspectRatio` (SQUARE) for every non-VIRTUAL_TOUR angle, e.g. the real `READY_HUNI` default `SchedulerService.runNeedCreativeCheck` uses for an auto-loop brief. */
function buildQaPassingImage(): Buffer {
  return buildJpegBuffer(1080, 1080);
}

/** A real, undersized (300x300) JPEG — fails `runQaChecks`' real Meta-minimum-resolution floor. */
function buildQaFailingImage(): Buffer {
  return buildJpegBuffer(300, 300);
}

/** Seeds a real raw `creative_packages` row (snake_case, column-for-column with `CreativePackageRow`) — the exact shape `SchedulerService.runNeedCreativeCheck`'s real `source: 'auto_loop'` insert produces, bypassing the DTO-level `createProperty` (which has no `source` field — only the real scheduler writer does). */
function seedAutoLoopPackage(
  client: FakeSupabaseClient,
  overrides: Record<string, unknown> = {},
): void {
  client.seed("creative_packages", {
    id: "cp-auto-1",
    tenant_id: TENANT_A,
    brief_id: "brief-auto-1",
    ad_id: null,
    stable_id: null,
    vertical: "PROPERTY",
    listing_id: "listing-1",
    branch: null,
    unit: null,
    unit_model: null,
    title: "[Auto] Refresh kreatif — Rumah Minimalis BSD",
    angle: PropertyAdAngle.READY_HUNI,
    target_persona: null,
    reason: "NEED_CREATIVE terdeteksi oleh Samantha.",
    requested_format: "IMAGES_ONLY",
    decided_format: null,
    primary_message: "Rumah Minimalis BSD",
    urgency: "MEDIUM",
    origin: "SAMANTHA",
    status: "DRAFT",
    ai_recommended: false,
    fatigue_status: "NORMAL",
    source: "auto_loop",
    related_verdict_id: "listing-1",
    priority: "MEDIUM",
    source_photo_urls: [],
    video_url: null,
    image_urls: [],
    copy_variants: [],
    ai_model: null,
    confidence_score: null,
    generation_ms: null,
    selected_copy_variant_id: null,
    error_message: null,
    generated_at: null,
    reviewed_at: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  });
}

describe("CreativePackagesService.triggerAutoLoopGeneration (Sprint 8b)", () => {
  it("throws ValidationError for a manual (non-auto_loop) package — never auto-triggers real Kie AI spend for a row a human didn't ask the scheduler to create", async () => {
    const harness = buildHarness({
      listing: { id: "listing-1", tenantId: TENANT_A, title: "Rumah Minimalis BSD" },
    });
    seedAutoLoopPackage(harness.client, { source: "manual" });

    await expect(harness.service.triggerAutoLoopGeneration(TENANT_A, "cp-auto-1")).rejects.toThrow(
      ValidationError,
    );
    expect(harness.orchestrate).not.toHaveBeenCalled();
  });

  it("throws ValidationError for a non-DRAFT auto_loop package (e.g. still PENDING_REVIEW)", async () => {
    const harness = buildHarness({
      listing: { id: "listing-1", tenantId: TENANT_A, title: "Rumah Minimalis BSD" },
    });
    seedAutoLoopPackage(harness.client, { status: "PENDING_REVIEW" });

    await expect(harness.service.triggerAutoLoopGeneration(TENANT_A, "cp-auto-1")).rejects.toThrow(
      ValidationError,
    );
    expect(harness.orchestrate).not.toHaveBeenCalled();
  });

  it("404s for an unknown package", async () => {
    const harness = buildHarness();
    await expect(harness.service.triggerAutoLoopGeneration(TENANT_A, "nope")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("QA passes on the first real attempt: completes PENDING, writes a real CREATIVE_GENERATED audit_log row and a real CREATIVE_AUTO_GENERATE activity row", async () => {
    const harness = buildHarness({
      listing: {
        id: "listing-1",
        tenantId: TENANT_A,
        title: "Rumah Minimalis BSD",
        photos: ["https://gcs/listing-1/foto-1.jpg"],
      },
      orchestrateResult: {
        ok: true,
        value: { imageBuffers: [buildQaPassingImage()], imageSpecs: [], videoDelivered: false },
      },
    });
    seedAutoLoopPackage(harness.client);

    const result = await harness.service.triggerAutoLoopGeneration(TENANT_A, "cp-auto-1");
    expect(result.status).toBe("GENERATING");
    await settle();

    expect(harness.orchestrate).toHaveBeenCalledTimes(1);
    const [row] = harness.client
      .rows("creative_packages")
      .filter((r) => r["id"] === "cp-auto-1") as Array<Record<string, unknown>>;
    expect(row?.["status"]).toBe("PENDING");
    expect((row?.["image_urls"] as string[]).length).toBe(1);

    expect(harness.auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_A,
        agent: "KAI",
        actionType: "CREATIVE_GENERATED",
        decidedBy: "ai_auto",
        relatedBriefId: "cp-auto-1",
        relatedVerdictId: "listing-1",
        reversible: false,
        afterState: expect.objectContaining({ status: "PENDING", attempts: 1 }) as unknown,
      }),
    );
    expect(harness.activityLogger.start).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_A,
        agent: "KAI",
        actionType: "CREATIVE_AUTO_GENERATE",
      }),
    );
    expect(harness.activityLogger.complete).toHaveBeenCalledWith(
      "activity-1",
      expect.objectContaining({ status: "SUCCESS" }),
    );
  });

  it("QA fails on attempts 1-2 (real undersized image), passes on real attempt 3 — completes PENDING after 2 real retries", async () => {
    const harness = buildHarness({
      listing: {
        id: "listing-1",
        tenantId: TENANT_A,
        title: "Rumah Minimalis BSD",
        photos: ["https://gcs/listing-1/foto-1.jpg"],
      },
    });
    seedAutoLoopPackage(harness.client);
    harness.orchestrate
      .mockResolvedValueOnce({
        ok: true,
        value: { imageBuffers: [buildQaFailingImage()], imageSpecs: [], videoDelivered: false },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { imageBuffers: [buildQaFailingImage()], imageSpecs: [], videoDelivered: false },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { imageBuffers: [buildQaPassingImage()], imageSpecs: [], videoDelivered: false },
      });

    await harness.service.triggerAutoLoopGeneration(TENANT_A, "cp-auto-1");
    await settle();

    expect(harness.orchestrate).toHaveBeenCalledTimes(3);
    const [row] = harness.client
      .rows("creative_packages")
      .filter((r) => r["id"] === "cp-auto-1") as Array<Record<string, unknown>>;
    expect(row?.["status"]).toBe("PENDING");
    expect(harness.auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "CREATIVE_GENERATED",
        afterState: expect.objectContaining({ status: "PENDING", attempts: 3 }) as unknown,
      }),
    );
  });

  it("QA fails on all 3 real attempts — real, honest FAILED state (never a fabricated success), real CREATIVE_GENERATED audit_log write describing the failure, never proceeds to any Meta call", async () => {
    const harness = buildHarness({
      listing: {
        id: "listing-1",
        tenantId: TENANT_A,
        title: "Rumah Minimalis BSD",
        photos: ["https://gcs/listing-1/foto-1.jpg"],
      },
      orchestrateResult: {
        ok: true,
        value: { imageBuffers: [buildQaFailingImage()], imageSpecs: [], videoDelivered: false },
      },
    });
    seedAutoLoopPackage(harness.client);

    await harness.service.triggerAutoLoopGeneration(TENANT_A, "cp-auto-1");
    await settle();

    expect(harness.orchestrate).toHaveBeenCalledTimes(3);
    const [row] = harness.client
      .rows("creative_packages")
      .filter((r) => r["id"] === "cp-auto-1") as Array<Record<string, unknown>>;
    expect(row?.["status"]).toBe("FAILED");
    expect(row?.["error_message"]).toEqual(expect.stringContaining("3 percobaan"));

    expect(harness.auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "CREATIVE_GENERATED",
        decidedBy: "ai_auto",
        afterState: expect.objectContaining({ status: "FAILED", attempts: 3 }) as unknown,
      }),
    );
    expect(harness.activityLogger.fail).toHaveBeenCalledWith("activity-1", expect.any(Error));
  });

  it("a real Kie AI orchestration failure (not just a QA failure) also counts toward the real retry cap", async () => {
    const harness = buildHarness({
      listing: {
        id: "listing-1",
        tenantId: TENANT_A,
        title: "Rumah Minimalis BSD",
        photos: ["https://gcs/listing-1/foto-1.jpg"],
      },
      orchestrateResult: err(new GenerationError("Kie AI timeout after 15 minutes")),
    });
    seedAutoLoopPackage(harness.client);

    await harness.service.triggerAutoLoopGeneration(TENANT_A, "cp-auto-1");
    await settle();

    expect(harness.orchestrate).toHaveBeenCalledTimes(3);
    const [row] = harness.client
      .rows("creative_packages")
      .filter((r) => r["id"] === "cp-auto-1") as Array<Record<string, unknown>>;
    expect(row?.["status"]).toBe("FAILED");
  });
});

import type { AssetLibrary } from "@aos/asset-library";
import { err, ok } from "@aos/common";
import type { CreativePackage, KaiAgentRuntime } from "@aos/creative-agent";
import { GenerationError } from "@aos/creative-agent";
import { NotFoundError, UnavailableError, ValidationError } from "@aos/errors";
import { describe, expect, it, vi } from "vitest";

import {
  createFakeSupabaseClient,
  type FakeSupabaseClient,
} from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";

import { CreativePackagesService } from "./creative-packages.service.js";
import type { CreatePackageBodyDto } from "./dto/create-package.dto.js";
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

interface Harness {
  readonly service: CreativePackagesService;
  readonly client: FakeSupabaseClient;
  readonly processCreativeBrief: ReturnType<typeof vi.fn>;
  readonly getAssetsByUnit: ReturnType<typeof vi.fn>;
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
  } = {},
): Harness {
  const client = createFakeSupabaseClient();
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

  const kai =
    options.kaiConfigured === false
      ? undefined
      : ({ processCreativeBrief: { execute: processCreativeBrief } } as unknown as KaiAgentRuntime);
  const assetLibrary =
    options.assetLibraryConfigured === false
      ? undefined
      : ({ getAssetsByUnit: { execute: getAssetsByUnit } } as unknown as AssetLibrary);

  const service = new CreativePackagesService(
    buildTestConfig(),
    kai,
    assetLibrary,
    new CreativePackageRepository(client),
    new CreativeLogRepository(client),
  );
  return { service, client, processCreativeBrief, getAssetsByUnit };
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
    const tamara = await buildHarness().service.create({ ...BODY, origin: "TAMARA" });
    expect(tamara.reason).toBe("Disetujui manager dari rekomendasi Tamara.");
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

  it("attributes a Tamara-approved brief to TAMARA and carries its real ad ids into the log", async () => {
    const harness = buildHarness();
    const created = await harness.service.create({
      ...BODY,
      origin: "TAMARA",
      adId: "120000000000001",
      stableId: "C047",
    });
    await harness.service.generate(created.id);
    const brief = (await harness.service.logs({ limit: 100 })).find(
      (entry) => entry.eventType === "BRIEF_SENT",
    );
    expect(brief?.fromAgent).toBe("TAMARA");
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

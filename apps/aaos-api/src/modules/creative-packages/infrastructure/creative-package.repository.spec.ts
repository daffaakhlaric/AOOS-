import { describe, expect, it } from "vitest";

import {
  createFakeSupabaseClient,
  type FakeSupabaseClient,
} from "../../../test-support/fake-supabase-client.js";
import type { CreateCreativePackageInput } from "../domain/creative-package.js";

import {
  CreativePackageRepository,
  CreativePackageRepositoryError,
} from "./creative-package.repository.js";

const TENANT = "dss-motor";

const INPUT: CreateCreativePackageInput = {
  id: "11111111-1111-4111-8111-111111111111",
  tenantId: TENANT,
  briefId: "22222222-2222-4222-8222-222222222222",
  branch: "CINERE",
  unit: "xpander-gls-2022-001",
  unitModel: "Xpander GLS 2022",
  title: "Xpander GLS 2022 CINERE · DP_RINGAN",
  angle: "DP_RINGAN",
  targetPersona: "PRIMARY_FAMILY",
  reason: "Brief manual dibuat manager.",
  requestedFormat: "VIDEO_AND_IMAGES",
  primaryMessage: "DP mulai 29 juta, cicilan 5 jutaan",
  urgency: "HIGH",
  origin: "MANUAL",
};

/** The repository selects the inserted row back, so a seeded row needs the DB-side defaults present. */
function seedPackage(client: FakeSupabaseClient, overrides: Record<string, unknown> = {}): void {
  client.seed("creative_packages", {
    id: "seed-1",
    tenant_id: TENANT,
    brief_id: "22222222-2222-4222-8222-222222222222",
    ad_id: null,
    stable_id: null,
    branch: "CINERE",
    unit: "xpander-gls-2022-001",
    unit_model: null,
    title: "Seeded",
    angle: "DP_RINGAN",
    target_persona: "PRIMARY_FAMILY",
    reason: "Brief manual dibuat manager.",
    requested_format: "VIDEO_AND_IMAGES",
    decided_format: null,
    primary_message: "DP mulai 29 juta",
    urgency: "MEDIUM",
    origin: "MANUAL",
    status: "DRAFT",
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
    created_at: "2026-08-18T00:00:00.000Z",
    updated_at: "2026-08-18T00:00:00.000Z",
    ...overrides,
  });
}

describe("CreativePackageRepository.create", () => {
  it("inserts a DRAFT row — never GENERATING, so nothing can reach Kie AI without an explicit generate call", async () => {
    const client = createFakeSupabaseClient();
    const repo = new CreativePackageRepository(client);
    const pkg = await repo.create(INPUT);
    expect(pkg.status).toBe("DRAFT");
    expect(pkg.id).toBe(INPUT.id);
    expect(pkg.unitModel).toBe("Xpander GLS 2022");
    expect(pkg.requestedFormat).toBe("VIDEO_AND_IMAGES");
    expect(pkg.targetPersona).toBe("PRIMARY_FAMILY");
    expect(pkg.sourcePhotoUrls).toEqual([]);
    expect(pkg.imageUrls).toEqual([]);
    expect(pkg.copyVariants).toEqual([]);
    expect(client.rows("creative_packages")).toHaveLength(1);
  });

  it("omits optional fields rather than emitting nulls into the domain shape", async () => {
    const client = createFakeSupabaseClient();
    const repo = new CreativePackageRepository(client);
    const { unitModel: _unitModel, ...withoutModel } = INPUT;
    const pkg = await repo.create(withoutModel);
    expect(pkg.unitModel).toBeUndefined();
    expect(pkg.adId).toBeUndefined();
    expect(pkg.stableId).toBeUndefined();
    expect(pkg.videoUrl).toBeUndefined();
    expect(pkg.reviewedAt).toBeUndefined();
  });

  it("records adId/stableId for a Samantha-originated brief", async () => {
    const client = createFakeSupabaseClient();
    const repo = new CreativePackageRepository(client);
    const pkg = await repo.create({
      ...INPUT,
      origin: "SAMANTHA",
      adId: "120000000000001",
      stableId: "C047",
    });
    expect(pkg.origin).toBe("SAMANTHA");
    expect(pkg.adId).toBe("120000000000001");
    expect(pkg.stableId).toBe("C047");
  });

  it("throws CreativePackageRepositoryError on a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("creative_packages", "db down");
    const repo = new CreativePackageRepository(client);
    await expect(repo.create(INPUT)).rejects.toThrow(CreativePackageRepositoryError);
  });
});

describe("CreativePackageRepository.findById / list", () => {
  it("findById returns undefined for an unknown id", async () => {
    const client = createFakeSupabaseClient();
    const repo = new CreativePackageRepository(client);
    expect(await repo.findById(TENANT, "nope")).toBeUndefined();
  });

  it("findById is tenant-scoped — another tenant's row is not visible", async () => {
    const client = createFakeSupabaseClient();
    seedPackage(client, { id: "other", tenant_id: "someone-else" });
    const repo = new CreativePackageRepository(client);
    expect(await repo.findById(TENANT, "other")).toBeUndefined();
  });

  it("findById maps every persisted column back, including the JSONB blobs", async () => {
    const client = createFakeSupabaseClient();
    seedPackage(client, {
      id: "pkg-x",
      status: "PENDING",
      decided_format: "IMAGES_ONLY",
      source_photo_urls: ["https://storage.googleapis.com/aoos/units/x/foto-1.jpg"],
      video_url: "https://storage.googleapis.com/aoos/ai-creatives/x/video.mp4",
      image_urls: ["https://storage.googleapis.com/aoos/ai-creatives/x/img-1.jpg"],
      copy_variants: [
        {
          id: "v-a",
          variantLabel: "A",
          primaryText: "DP 29 juta",
          headline: "DP Ringan",
          callToAction: "Hubungi Sekarang",
        },
      ],
      ai_model: "veo3_fast+nano-banana-pro",
      confidence_score: 0.9,
      generation_ms: 563000,
      generated_at: "2026-08-18T02:00:00.000Z",
    });
    const repo = new CreativePackageRepository(client);
    const pkg = await repo.findById(TENANT, "pkg-x");
    expect(pkg?.status).toBe("PENDING");
    expect(pkg?.decidedFormat).toBe("IMAGES_ONLY");
    expect(pkg?.sourcePhotoUrls).toHaveLength(1);
    expect(pkg?.videoUrl).toContain("video.mp4");
    expect(pkg?.copyVariants[0]?.variantLabel).toBe("A");
    expect(pkg?.aiModel).toBe("veo3_fast+nano-banana-pro");
    expect(pkg?.confidenceScore).toBe(0.9);
    expect(pkg?.generationMs).toBe(563000);
    expect(pkg?.generatedAt).toBe("2026-08-18T02:00:00.000Z");
  });

  it("findById throws on a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("creative_packages", "boom");
    const repo = new CreativePackageRepository(client);
    await expect(repo.findById(TENANT, "pkg-x")).rejects.toThrow(CreativePackageRepositoryError);
  });

  it("list filters by status when given one", async () => {
    const client = createFakeSupabaseClient();
    seedPackage(client, { id: "a", status: "PENDING" });
    seedPackage(client, { id: "b", status: "DRAFT" });
    const repo = new CreativePackageRepository(client);
    const pending = await repo.list(TENANT, { status: "PENDING" });
    expect(pending.map((pkg) => pkg.id)).toEqual(["a"]);
  });

  it("list honors the limit and returns newest first", async () => {
    const client = createFakeSupabaseClient();
    seedPackage(client, { id: "a", created_at: "2026-08-16T00:00:00.000Z" });
    seedPackage(client, { id: "b", created_at: "2026-08-18T00:00:00.000Z" });
    seedPackage(client, { id: "c", created_at: "2026-08-17T00:00:00.000Z" });
    const repo = new CreativePackageRepository(client);
    expect((await repo.list(TENANT)).map((pkg) => pkg.id)).toEqual(["b", "c", "a"]);
    expect(await repo.list(TENANT, { limit: 2 })).toHaveLength(2);
  });

  it("list throws on a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("creative_packages", "boom");
    const repo = new CreativePackageRepository(client);
    await expect(repo.list(TENANT)).rejects.toThrow(CreativePackageRepositoryError);
  });
});

describe("CreativePackageRepository mutations", () => {
  it("markGenerating records the real source photos and clears a previous error", async () => {
    const client = createFakeSupabaseClient();
    seedPackage(client, { id: "pkg-x", error_message: "earlier failure" });
    const repo = new CreativePackageRepository(client);
    await repo.markGenerating("pkg-x", ["https://storage.googleapis.com/aoos/units/x/foto-1.jpg"]);
    const pkg = await repo.findById(TENANT, "pkg-x");
    expect(pkg?.status).toBe("GENERATING");
    expect(pkg?.sourcePhotoUrls).toHaveLength(1);
    expect(pkg?.errorMessage).toBeUndefined();
  });

  it("complete lands the measured outcome and moves the package to PENDING review", async () => {
    const client = createFakeSupabaseClient();
    seedPackage(client, { id: "pkg-x", status: "GENERATING" });
    const repo = new CreativePackageRepository(client);
    await repo.complete(
      "pkg-x",
      {
        decidedFormat: "VIDEO_AND_IMAGES",
        sourcePhotoUrls: ["https://storage.googleapis.com/aoos/units/x/foto-1.jpg"],
        videoUrl: "https://storage.googleapis.com/aoos/ai-creatives/x/video.mp4",
        imageUrls: ["https://storage.googleapis.com/aoos/ai-creatives/x/img-1.jpg"],
        copyVariants: [],
        aiModel: "veo3_fast+nano-banana-pro",
        confidenceScore: 0.75,
        generationMs: 12345,
      },
      "2026-08-18T03:00:00.000Z",
    );
    const pkg = await repo.findById(TENANT, "pkg-x");
    expect(pkg?.status).toBe("PENDING");
    expect(pkg?.decidedFormat).toBe("VIDEO_AND_IMAGES");
    expect(pkg?.aiModel).toBe("veo3_fast+nano-banana-pro");
    expect(pkg?.generatedAt).toBe("2026-08-18T03:00:00.000Z");
  });

  it("complete writes null (not a fabricated placeholder) when no video was delivered", async () => {
    const client = createFakeSupabaseClient();
    seedPackage(client, { id: "pkg-x", status: "GENERATING" });
    const repo = new CreativePackageRepository(client);
    await repo.complete(
      "pkg-x",
      {
        decidedFormat: "IMAGES_ONLY",
        sourcePhotoUrls: [],
        imageUrls: [],
        copyVariants: [],
      },
      "2026-08-18T03:00:00.000Z",
    );
    const pkg = await repo.findById(TENANT, "pkg-x");
    expect(pkg?.videoUrl).toBeUndefined();
    expect(pkg?.aiModel).toBeUndefined();
    expect(pkg?.confidenceScore).toBeUndefined();
  });

  it("fail sets FAILED plus the real error message", async () => {
    const client = createFakeSupabaseClient();
    seedPackage(client, { id: "pkg-x", status: "GENERATING" });
    const repo = new CreativePackageRepository(client);
    await repo.fail("pkg-x", "Kie AI timeout after 15 minutes");
    const pkg = await repo.findById(TENANT, "pkg-x");
    expect(pkg?.status).toBe("FAILED");
    expect(pkg?.errorMessage).toBe("Kie AI timeout after 15 minutes");
  });

  it("review records the decision, its timestamp, and the chosen copy variant", async () => {
    const client = createFakeSupabaseClient();
    seedPackage(client, { id: "pkg-x", status: "PENDING" });
    const repo = new CreativePackageRepository(client);
    await repo.review("pkg-x", "APPROVED", "2026-08-18T04:00:00.000Z", "v-b");
    const pkg = await repo.findById(TENANT, "pkg-x");
    expect(pkg?.status).toBe("APPROVED");
    expect(pkg?.reviewedAt).toBe("2026-08-18T04:00:00.000Z");
    expect(pkg?.selectedCopyVariantId).toBe("v-b");
  });

  it("review leaves selected_copy_variant_id untouched when none is supplied (reject path)", async () => {
    const client = createFakeSupabaseClient();
    seedPackage(client, { id: "pkg-x", status: "PENDING", selected_copy_variant_id: "v-a" });
    const repo = new CreativePackageRepository(client);
    await repo.review("pkg-x", "REJECTED", "2026-08-18T04:00:00.000Z");
    const pkg = await repo.findById(TENANT, "pkg-x");
    expect(pkg?.status).toBe("REJECTED");
    expect(pkg?.selectedCopyVariantId).toBe("v-a");
  });

  it("every mutation throws CreativePackageRepositoryError on a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    const repo = new CreativePackageRepository(client);

    client.forceErrorOnce("creative_packages", "boom");
    await expect(repo.markGenerating("pkg-x", [])).rejects.toThrow(CreativePackageRepositoryError);
    client.forceErrorOnce("creative_packages", "boom");
    await expect(
      repo.complete(
        "pkg-x",
        { decidedFormat: "IMAGES_ONLY", sourcePhotoUrls: [], imageUrls: [], copyVariants: [] },
        "2026-08-18T03:00:00.000Z",
      ),
    ).rejects.toThrow(CreativePackageRepositoryError);
    client.forceErrorOnce("creative_packages", "boom");
    await expect(repo.fail("pkg-x", "x")).rejects.toThrow(CreativePackageRepositoryError);
    client.forceErrorOnce("creative_packages", "boom");
    await expect(repo.review("pkg-x", "APPROVED", "t")).rejects.toThrow(
      CreativePackageRepositoryError,
    );
  });
});

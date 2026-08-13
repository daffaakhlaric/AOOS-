import { AspectRatio, ImageModel, VideoModel } from "@aos/creative-connector";
import { AdAngle, CreativeBriefId } from "@aos/meta-ads-agent";
import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { CopyVariant } from "../../../../src/domain/entities/CopyVariant.js";
import { CreativePackage } from "../../../../src/domain/entities/CreativePackage.js";
import { ConfidenceScore } from "../../../../src/domain/value-objects/ConfidenceScore.js";
import { GenerationStatus } from "../../../../src/domain/value-objects/GenerationStatus.js";
import { ImageSpec } from "../../../../src/domain/value-objects/ImageSpec.js";
import { PackageId } from "../../../../src/domain/value-objects/PackageId.js";
import { VideoSpec } from "../../../../src/domain/value-objects/VideoSpec.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

function imageSpec(): ImageSpec {
  return unwrap(
    ImageSpec.create({
      count: 3,
      aspectRatio: AspectRatio.SQUARE,
      model: ImageModel.NANO_BANANA_PRO,
    }),
  );
}

function videoSpec(): VideoSpec {
  return unwrap(
    VideoSpec.create({
      durationSeconds: 8,
      aspectRatio: AspectRatio.WIDESCREEN,
      model: VideoModel.VEO3_FAST,
    }),
  );
}

function copyVariant(label: "A" | "B" | "C"): CopyVariant {
  return unwrap(
    CopyVariant.create({
      id: `id-${label}`,
      variantLabel: label,
      angle: AdAngle.DP_RINGAN,
      primaryText: "Sample copy text",
      headline: "Sample headline",
      callToAction: "Tanya Sekarang",
    }),
  );
}

function baseProps() {
  return {
    id: PackageId.generate(),
    briefId: CreativeBriefId.generate(),
    branch: Branch.BINTARO,
    unit: "Xpander Cross 2019",
    status: GenerationStatus.READY,
    imageUrls: ["https://cdn.test/img1.jpg", "https://cdn.test/img2.jpg"],
    imageSpecs: [imageSpec(), imageSpec()],
    copyVariants: [copyVariant("A"), copyVariant("B"), copyVariant("C")],
    generatedAt: new Date("2026-08-01T00:00:00.000Z"),
    totalGenerationMs: 12_345,
    confidenceScore: unwrap(ConfidenceScore.create(90)),
  };
}

describe("CreativePackage", () => {
  it("create() accepts valid props without a video", () => {
    const pkg = unwrap(CreativePackage.create(baseProps()));
    expect(pkg.unit).toBe("Xpander Cross 2019");
    expect(pkg.videoUrl).toBeUndefined();
    expect(pkg.imageUrls).toHaveLength(2);
    expect(pkg.copyVariants).toHaveLength(3);
    expect(pkg.status).toBe(GenerationStatus.READY);
  });

  it("create() accepts valid props with a video", () => {
    const pkg = unwrap(
      CreativePackage.create({
        ...baseProps(),
        videoUrl: "https://cdn.test/video.mp4",
        videoSpec: videoSpec(),
      }),
    );
    expect(pkg.videoUrl).toBe("https://cdn.test/video.mp4");
    expect(pkg.videoSpec?.durationSeconds).toBe(8);
  });

  it("create() rejects an empty unit", () => {
    expect(unwrapErr(CreativePackage.create({ ...baseProps(), unit: "" })).message).toContain(
      "unit",
    );
  });

  it("create() rejects an empty-string videoUrl when provided", () => {
    expect(
      unwrapErr(CreativePackage.create({ ...baseProps(), videoUrl: "", videoSpec: videoSpec() }))
        .message,
    ).toContain("videoUrl");
  });

  it("create() rejects mismatched imageUrls/imageSpecs lengths", () => {
    const error = unwrapErr(
      CreativePackage.create({ ...baseProps(), imageUrls: ["https://cdn.test/only-one.jpg"] }),
    );
    expect(error.message).toContain("imageUrls");
  });

  it("create() defensively copies imageUrls/imageSpecs/copyVariants", () => {
    const props = baseProps();
    const pkg = unwrap(CreativePackage.create(props));
    expect(pkg.imageUrls).not.toBe(props.imageUrls);
    expect(pkg.imageSpecs).not.toBe(props.imageSpecs);
    expect(pkg.copyVariants).not.toBe(props.copyVariants);
  });

  it("exposes generatedAt and totalGenerationMs", () => {
    const pkg = unwrap(CreativePackage.create(baseProps()));
    expect(pkg.generatedAt).toEqual(new Date("2026-08-01T00:00:00.000Z"));
    expect(pkg.totalGenerationMs).toBe(12_345);
  });

  it("exposes id, briefId, and branch", () => {
    const props = baseProps();
    const pkg = unwrap(CreativePackage.create(props));
    expect(pkg.id).toBe(props.id);
    expect(pkg.briefId).toBe(props.briefId);
    expect(pkg.branch).toBe(Branch.BINTARO);
  });
});

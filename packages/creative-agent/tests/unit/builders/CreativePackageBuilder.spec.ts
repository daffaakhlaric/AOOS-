import { CreativeBriefId } from "@aos/meta-ads-agent";
import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { CreativePackageBuilder } from "../../../src/builders/CreativePackageBuilder.js";
import { ConfidenceScore } from "../../../src/domain/value-objects/ConfidenceScore.js";
import { GenerationStatus } from "../../../src/domain/value-objects/GenerationStatus.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("CreativePackageBuilder", () => {
  it("build() generates a fresh PackageId and delegates to CreativePackage.create", () => {
    const pkg = unwrap(
      CreativePackageBuilder.build({
        briefId: CreativeBriefId.generate(),
        branch: Branch.BINTARO,
        unit: "Xpander Cross 2019",
        status: GenerationStatus.READY,
        imageUrls: [],
        imageSpecs: [],
        copyVariants: [],
        generatedAt: new Date(),
        totalGenerationMs: 100,
        confidenceScore: unwrap(ConfidenceScore.create(50)),
      }),
    );
    expect(pkg.id.toString()).toMatch(/^[0-9a-f-]{36}$/);
    expect(pkg.unit).toBe("Xpander Cross 2019");
  });

  it("build() propagates CreativePackage.create's validation failure", () => {
    const error = unwrapErr(
      CreativePackageBuilder.build({
        briefId: CreativeBriefId.generate(),
        branch: Branch.BINTARO,
        unit: "",
        status: GenerationStatus.READY,
        imageUrls: [],
        imageSpecs: [],
        copyVariants: [],
        generatedAt: new Date(),
        totalGenerationMs: 100,
        confidenceScore: unwrap(ConfidenceScore.create(50)),
      }),
    );
    expect(error.message).toContain("unit");
  });
});

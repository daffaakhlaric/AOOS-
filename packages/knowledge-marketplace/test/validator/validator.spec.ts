import { describe, expect, it } from "vitest";

import type { KnowledgeMarketplaceValidationInput } from "../../src/contracts/i-knowledge-marketplace-validator.js";
import { MarketplaceCategoryName } from "../../src/domain/marketplace-category-name.js";
import { MarketplacePackageStatus } from "../../src/domain/marketplace-package-status.js";
import { CategoryValidator } from "../../src/validator/category-validator.js";
import { CertificationValidator } from "../../src/validator/certification-validator.js";
import { CompatibilityValidator } from "../../src/validator/compatibility-validator.js";
import { ConfigurationValidator } from "../../src/validator/configuration-validator.js";
import { DependencyValidator } from "../../src/validator/dependency-validator.js";
import { IdentityValidator } from "../../src/validator/identity-validator.js";
import { IntegrityValidator } from "../../src/validator/integrity-validator.js";
import { KnowledgeMarketplaceValidator } from "../../src/validator/knowledge-marketplace-validator.js";
import { MetadataValidator } from "../../src/validator/metadata-validator.js";
import { PublisherValidator } from "../../src/validator/publisher-validator.js";
import { VersionValidator } from "../../src/validator/version-validator.js";
import { certificationFixture } from "../helpers/certification-fixture.js";
import { compatibilityFixture } from "../helpers/compatibility-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { dependencyFixture } from "../helpers/dependency-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";
import { packageFixture } from "../helpers/package-fixture.js";
import { publisherFixture } from "../helpers/publisher-fixture.js";

function baseInput(
  overrides: Partial<KnowledgeMarketplaceValidationInput> = {},
): KnowledgeMarketplaceValidationInput {
  return {
    metadata: metadataFixture(),
    context: contextFixture(),
    package: packageFixture(),
    publisher: publisherFixture(),
    categoryResolvable: true,
    dependencies: [],
    ...overrides,
  };
}

describe("IdentityValidator", () => {
  const validator = new IdentityValidator();

  it("passes for a consistent identity", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("fails for an empty listingId", () => {
    const input = baseInput({ metadata: metadataFixture({ listingId: "" }) });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("fails when metadata.listingId does not match context.listingId", () => {
    const input = baseInput({ context: contextFixture({ listingId: "other" }) });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("fails for a malformed context token", () => {
    const input = baseInput({ context: contextFixture({ token: "not-a-token" }) });
    expect(validator.validate(input).valid).toBe(false);
  });
});

describe("MetadataValidator", () => {
  const validator = new MetadataValidator();

  it("passes for valid metadata", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("fails for an empty title", () => {
    expect(validator.validate(baseInput({ metadata: metadataFixture({ title: "" }) })).valid).toBe(
      false,
    );
  });

  it("fails for an empty tenantId", () => {
    expect(
      validator.validate(baseInput({ metadata: metadataFixture({ tenantId: "" }) })).valid,
    ).toBe(false);
  });

  it("fails for an empty packageId", () => {
    expect(
      validator.validate(baseInput({ metadata: metadataFixture({ packageId: "" }) })).valid,
    ).toBe(false);
  });
});

describe("CategoryValidator", () => {
  const validator = new CategoryValidator();

  it("passes when categoryResolvable is true", () => {
    expect(validator.validate(baseInput({ categoryResolvable: true })).valid).toBe(true);
  });

  it("passes when categoryResolvable is undefined", () => {
    expect(validator.validate(baseInput({ categoryResolvable: undefined })).valid).toBe(true);
  });

  it("fails when categoryResolvable is false", () => {
    expect(validator.validate(baseInput({ categoryResolvable: false })).valid).toBe(false);
  });
});

describe("PublisherValidator", () => {
  const validator = new PublisherValidator();

  it("passes when the Publisher resolves and matches", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("fails when no Publisher resolved", () => {
    expect(validator.validate(baseInput({ publisher: undefined })).valid).toBe(false);
  });

  it("fails when the resolved Publisher's id mismatches", () => {
    const input = baseInput({ publisher: publisherFixture({ publisherId: "other" }) });
    expect(validator.validate(input).valid).toBe(false);
  });
});

describe("DependencyValidator", () => {
  const validator = new DependencyValidator();

  it("passes with no dependencies", () => {
    expect(validator.validate(baseInput({ dependencies: [] })).valid).toBe(true);
  });

  it("passes with a valid dependency and matching knownPackageIds", () => {
    const input = baseInput({
      dependencies: [dependencyFixture()],
      knownPackageIds: ["package-2"],
    });
    expect(validator.validate(input).valid).toBe(true);
  });

  it("fails for a self-dependency", () => {
    const input = baseInput({
      package: packageFixture({ packageId: "package-2" }),
      dependencies: [dependencyFixture({ dependencyPackageId: "package-2" })],
    });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("fails when the dependency target is not a known Package", () => {
    const input = baseInput({
      dependencies: [dependencyFixture()],
      knownPackageIds: ["some-other-package"],
    });
    expect(validator.validate(input).valid).toBe(false);
  });
});

describe("CompatibilityValidator", () => {
  const validator = new CompatibilityValidator();

  it("passes with no compatibility record", () => {
    expect(validator.validate(baseInput({ compatibility: undefined })).valid).toBe(true);
  });

  it("passes with a valid compatibility record", () => {
    expect(validator.validate(baseInput({ compatibility: compatibilityFixture() })).valid).toBe(
      true,
    );
  });

  it("fails for an empty aosVersion", () => {
    const input = baseInput({ compatibility: compatibilityFixture({ aosVersion: "" }) });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("fails for an empty requiredKnowledgeVersion", () => {
    const input = baseInput({
      compatibility: compatibilityFixture({ requiredKnowledgeVersion: "" }),
    });
    expect(validator.validate(input).valid).toBe(false);
  });
});

describe("VersionValidator", () => {
  const validator = new VersionValidator();

  it("passes for a semver-like version", () => {
    expect(
      validator.validate(baseInput({ package: packageFixture({ currentVersion: "2.3.1" }) })).valid,
    ).toBe(true);
  });

  it("fails for an empty version", () => {
    expect(
      validator.validate(baseInput({ package: packageFixture({ currentVersion: "" }) })).valid,
    ).toBe(false);
  });

  it("fails for a non-semver version", () => {
    expect(
      validator.validate(baseInput({ package: packageFixture({ currentVersion: "latest" }) }))
        .valid,
    ).toBe(false);
  });
});

describe("CertificationValidator", () => {
  const validator = new CertificationValidator();

  it("passes when not targeting Published", () => {
    expect(
      validator.validate(baseInput({ targetState: MarketplacePackageStatus.SUBMITTED })).valid,
    ).toBe(true);
  });

  it("fails targeting Published without a Certification", () => {
    const input = baseInput({
      targetState: MarketplacePackageStatus.PUBLISHED,
      certification: undefined,
    });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("passes targeting Published with a Certification", () => {
    const input = baseInput({
      targetState: MarketplacePackageStatus.PUBLISHED,
      certification: certificationFixture(),
    });
    expect(validator.validate(input).valid).toBe(true);
  });

  it("fails when certifiedBy is empty", () => {
    const input = baseInput({ certification: certificationFixture({ certifiedBy: "" }) });
    expect(validator.validate(input).valid).toBe(false);
  });
});

describe("ConfigurationValidator", () => {
  const validator = new ConfigurationValidator();

  it("passes for consistent tenancy", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("fails for an empty correlationId", () => {
    const input = baseInput({ context: contextFixture({ correlationId: "" }) });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("fails when metadata.tenantId mismatches context.tenantId", () => {
    const input = baseInput({ context: contextFixture({ tenantId: "other-tenant" }) });
    expect(validator.validate(input).valid).toBe(false);
  });
});

describe("IntegrityValidator", () => {
  const validator = new IntegrityValidator();

  it("passes for a consistent package/metadata pair", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("fails when packageId mismatches", () => {
    const input = baseInput({ package: packageFixture({ packageId: "other" }) });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("fails when marketplaceType mismatches", () => {
    const input = baseInput({
      package: packageFixture({ marketplaceType: "official" as never }),
    });
    expect(validator.validate(input).valid).toBe(false);
  });

  it("fails when category mismatches", () => {
    const input = baseInput({
      package: packageFixture({ category: MarketplaceCategoryName.FINANCE }),
    });
    expect(validator.validate(input).valid).toBe(false);
  });
});

describe("KnowledgeMarketplaceValidator", () => {
  it("has exactly 10 built-in stages", () => {
    expect(new KnowledgeMarketplaceValidator().stageNames).toHaveLength(10);
  });

  it("stage names are in the exact prompt order", () => {
    expect(new KnowledgeMarketplaceValidator().stageNames).toEqual([
      "identity",
      "metadata",
      "category",
      "publisher",
      "dependency",
      "compatibility",
      "version",
      "certification",
      "configuration",
      "integrity",
    ]);
  });

  it("validate aggregates issues from every failing stage without short-circuiting", () => {
    const validator = new KnowledgeMarketplaceValidator();
    const result = validator.validate(
      baseInput({
        metadata: metadataFixture({ title: "", listingId: "" }),
        publisher: undefined,
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(1);
  });

  it("validate passes for a fully consistent input", () => {
    expect(new KnowledgeMarketplaceValidator().validate(baseInput()).valid).toBe(true);
  });

  it("supports extraStages", () => {
    const validator = new KnowledgeMarketplaceValidator({
      extraStages: [
        {
          name: "custom",
          validate: () => ({ valid: false, issues: [{ path: "custom", message: "always fails" }] }),
        },
      ],
    });
    expect(validator.stageNames).toContain("custom");
    expect(validator.validate(baseInput()).valid).toBe(false);
  });
});

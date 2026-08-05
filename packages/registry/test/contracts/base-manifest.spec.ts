import { describe, expect, it } from "vitest";

import { baseManifestSchema } from "../../src/contracts/base-manifest.js";

describe("Schema Validation Test — baseManifestSchema", () => {
  it("accepts a minimal valid manifest", () => {
    const result = baseManifestSchema.safeParse({
      id: "content-manager",
      version: "1.0.0",
      category: "marketing",
    });
    expect(result.success).toBe(true);
  });

  it("accepts the full user-revised manifest shape (extra fields ignored at base level)", () => {
    const result = baseManifestSchema.safeParse({
      id: "content-manager",
      version: "1.0.0",
      category: "marketing",
      capabilities: ["content_generation", "image_generation"],
      permissions: ["social.publish"],
      dependencies: ["some-other-agent"],
      tags: ["marketing", "content"],
      owner: "marketing-team",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing id", () => {
    expect(baseManifestSchema.safeParse({ version: "1.0.0", category: "marketing" }).success).toBe(
      false,
    );
  });

  it("rejects an id with invalid characters", () => {
    expect(
      baseManifestSchema.safeParse({
        id: "Content Manager!",
        version: "1.0.0",
        category: "marketing",
      }).success,
    ).toBe(false);
  });

  it("rejects a non-SemVer version string", () => {
    expect(
      baseManifestSchema.safeParse({ id: "x", version: "v1", category: "marketing" }).success,
    ).toBe(false);
  });

  it("rejects a missing category", () => {
    expect(baseManifestSchema.safeParse({ id: "x", version: "1.0.0" }).success).toBe(false);
  });
});

describe("Manifest Test — Registry Manifest Standard (005.3A Enhancement 8)", () => {
  it("accepts the new displayName/description/industry/metadata fields, all optional", () => {
    const result = baseManifestSchema.safeParse({
      id: "content-manager",
      version: "1.0.0",
      category: "marketing",
      displayName: "Content Manager Agent",
      description: "Generates and publishes marketing content",
      industry: ["automotive", "retail"],
      metadata: { internalNotes: "beta", priority: 1 },
    });
    expect(result.success).toBe(true);
  });

  it("still accepts a pre-005.3A minimal manifest unchanged (backward compatible)", () => {
    const result = baseManifestSchema.safeParse({
      id: "content-manager",
      version: "1.0.0",
      category: "marketing",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty displayName or description when present", () => {
    expect(
      baseManifestSchema.safeParse({
        id: "x",
        version: "1.0.0",
        category: "marketing",
        displayName: "",
      }).success,
    ).toBe(false);
    expect(
      baseManifestSchema.safeParse({
        id: "x",
        version: "1.0.0",
        category: "marketing",
        description: "",
      }).success,
    ).toBe(false);
  });
});

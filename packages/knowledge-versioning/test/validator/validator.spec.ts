import { describe, expect, it } from "vitest";

import { KnowledgeBranchType } from "../../src/domain/knowledge-branch-type.js";
import { KnowledgeVersionState } from "../../src/domain/knowledge-version-state.js";
import { KnowledgeVersionType } from "../../src/domain/knowledge-version-type.js";
import { KnowledgeVersionPermission } from "../../src/permission/knowledge-version-permission.js";
import { KnowledgeVersionPolicy } from "../../src/policy/knowledge-version-policy.js";
import { BranchValidator } from "../../src/validator/branch-validator.js";
import { ConfigurationValidator } from "../../src/validator/configuration-validator.js";
import { DependencyValidator } from "../../src/validator/dependency-validator.js";
import { IdentityValidator } from "../../src/validator/identity-validator.js";
import { IntegrityValidator } from "../../src/validator/integrity-validator.js";
import { KnowledgeVersionValidator } from "../../src/validator/knowledge-version-validator.js";
import { LifecycleValidator } from "../../src/validator/lifecycle-validator.js";
import { MetadataValidator } from "../../src/validator/metadata-validator.js";
import { PermissionValidator } from "../../src/validator/permission-validator.js";
import { PolicyValidator } from "../../src/validator/policy-validator.js";
import { VersionNumberValidator } from "../../src/validator/version-number-validator.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

function baseInput() {
  return {
    metadata: metadataFixture(),
    context: contextFixture(),
    configuration: configurationFixture(),
  };
}

describe("IdentityValidator", () => {
  const validator = new IdentityValidator();

  it("passes for a coherent metadata/context pair", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("flags blank versionId/assetId", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, versionId: "", assetId: "" },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("flags mismatched versionId/assetId between metadata and context", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      context: { ...input.context, versionId: "other", assetId: "other-asset" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a malformed context token", () => {
    const input = baseInput();
    const result = validator.validate({ ...input, context: { ...input.context, token: "bad" } });
    expect(result.valid).toBe(false);
  });
});

describe("MetadataValidator", () => {
  const validator = new MetadataValidator();

  it("passes for valid metadata matching the context tenant", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("flags a metadata schema violation", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, versionId: "" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a tenant mismatch", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      context: { ...input.context, tenantId: "other-tenant" },
    });
    expect(result.valid).toBe(false);
  });
});

describe("VersionNumberValidator", () => {
  const validator = new VersionNumberValidator();

  it("passes a numeric version number for a numeric type", () => {
    const input = baseInput();
    expect(validator.validate(input).valid).toBe(true);
  });

  it("flags a blank version number", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, versionNumber: "  " },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a non-numeric version number for a numeric type", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, versionNumber: "not-numeric" },
    });
    expect(result.valid).toBe(false);
  });

  it("allows a non-numeric label for a non-numeric type", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      metadata: {
        ...input.metadata,
        versionType: KnowledgeVersionType.DRAFT,
        versionNumber: "draft-1",
      },
    });
    expect(result.valid).toBe(true);
  });
});

describe("LifecycleValidator", () => {
  const validator = new LifecycleValidator();

  it("passes when no current/target state is supplied", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("passes a legal transition", () => {
    const result = validator.validate({
      ...baseInput(),
      currentState: KnowledgeVersionState.DRAFT,
      targetState: KnowledgeVersionState.CREATED,
    });
    expect(result.valid).toBe(true);
  });

  it("flags an illegal transition", () => {
    const result = validator.validate({
      ...baseInput(),
      currentState: KnowledgeVersionState.DRAFT,
      targetState: KnowledgeVersionState.PUBLISHED,
    });
    expect(result.valid).toBe(false);
  });
});

describe("BranchValidator", () => {
  const validator = new BranchValidator();

  it("passes when metadata has no branchId", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("flags a branchId with no resolved branch", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, branchId: "b1" },
    });
    expect(result.valid).toBe(false);
  });

  it("passes a resolved, matching branch", () => {
    const input = baseInput();
    const branch = {
      id: "b1",
      name: "main",
      branchType: KnowledgeBranchType.MAIN,
      assetId: input.metadata.assetId,
      tenantId: input.metadata.tenantId,
      createdAt: new Date().toISOString(),
    };
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, branchId: "b1" },
      branch,
    });
    expect(result.valid).toBe(true);
  });

  it("flags a branch id mismatch", () => {
    const input = baseInput();
    const branch = {
      id: "other",
      name: "main",
      branchType: KnowledgeBranchType.MAIN,
      assetId: input.metadata.assetId,
      tenantId: input.metadata.tenantId,
      createdAt: new Date().toISOString(),
    };
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, branchId: "b1" },
      branch,
    });
    expect(result.valid).toBe(false);
  });

  it("flags a resolved branch that fails the KnowledgeBranch schema", () => {
    const input = baseInput();
    const branch = {
      id: "b1",
      name: "main",
      branchType: "not-a-real-branch-type",
      assetId: input.metadata.assetId,
      tenantId: input.metadata.tenantId,
      createdAt: new Date().toISOString(),
    };
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, branchId: "b1" },
      branch: branch as never,
    });
    expect(result.valid).toBe(false);
  });

  it("flags a branch belonging to a different asset", () => {
    const input = baseInput();
    const branch = {
      id: "b1",
      name: "main",
      branchType: KnowledgeBranchType.MAIN,
      assetId: "different-asset",
      tenantId: input.metadata.tenantId,
      createdAt: new Date().toISOString(),
    };
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, branchId: "b1" },
      branch,
    });
    expect(result.valid).toBe(false);
  });
});

describe("PolicyValidator", () => {
  it("passes against an empty default policy set", () => {
    const validator = new PolicyValidator();
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("flags a violation from a shared policy instance", () => {
    const policy = new KnowledgeVersionPolicy();
    policy.register({
      id: "p1",
      name: "deny-major",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      deniedVersionTypes: [KnowledgeVersionType.MAJOR],
      createdAt: new Date().toISOString(),
    });
    const validator = new PolicyValidator(policy);
    expect(validator.validate(baseInput()).valid).toBe(false);
  });
});

describe("PermissionValidator", () => {
  it("passes against an empty default grant set", () => {
    const validator = new PermissionValidator();
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("flags a denial from a shared permission instance", () => {
    const permission = new KnowledgeVersionPermission();
    permission.register({
      id: "g1",
      scope: { tenantId: "tenant-1" },
      effect: "deny",
      createdAt: new Date().toISOString(),
    });
    const validator = new PermissionValidator(permission);
    expect(validator.validate(baseInput()).valid).toBe(false);
  });
});

describe("ConfigurationValidator", () => {
  const validator = new ConfigurationValidator();

  it("passes a valid configuration", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("flags an autoSnapshot=true configuration with no maxSnapshots budget", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      configuration: { ...input.configuration, autoSnapshot: true, maxSnapshots: undefined },
    });
    expect(result.valid).toBe(false);
  });
});

describe("DependencyValidator", () => {
  const validator = new DependencyValidator();

  it("passes with no dependencies", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("flags a self-dependency", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, dependencies: [input.metadata.versionId] },
    });
    expect(result.valid).toBe(false);
  });

  it("passes an unknown dependency when knownVersionIds is not supplied", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, dependencies: ["dep-1"] },
    });
    expect(result.valid).toBe(true);
  });

  it("flags a dependency absent from knownVersionIds", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, dependencies: ["dep-1"] },
      knownVersionIds: ["dep-2"],
    });
    expect(result.valid).toBe(false);
  });

  it("passes a dependency present in knownVersionIds", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, dependencies: ["dep-1"] },
      knownVersionIds: ["dep-1"],
    });
    expect(result.valid).toBe(true);
  });
});

describe("IntegrityValidator", () => {
  const validator = new IntegrityValidator();

  it("passes coherent metadata/configuration", () => {
    expect(validator.validate(baseInput()).valid).toBe(true);
  });

  it("flags invalid timestamps", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, createdAt: "not-a-date" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags updatedAt preceding createdAt", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      metadata: {
        ...input.metadata,
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(result.valid).toBe(false);
  });

  it("flags blank labels/tags", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, labels: ["  "], tags: ["  "] },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a configuration/metadata versionId mismatch", () => {
    const input = baseInput();
    const result = validator.validate({
      ...input,
      configuration: { ...input.configuration, versionId: "other" },
    });
    expect(result.valid).toBe(false);
  });
});

describe("KnowledgeVersionValidator", () => {
  it("runs all 10 built-in stages in order", () => {
    const validator = new KnowledgeVersionValidator();
    expect(validator.stageNames).toEqual([
      "identity",
      "metadata",
      "versionNumber",
      "lifecycle",
      "branch",
      "policy",
      "permission",
      "configuration",
      "dependency",
      "integrity",
    ]);
  });

  it("passes a fully valid input", () => {
    const validator = new KnowledgeVersionValidator();
    const result = validator.validate(baseInput());
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("aggregates issues across multiple failing stages without short-circuiting", () => {
    const validator = new KnowledgeVersionValidator();
    const input = baseInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, versionId: "", versionNumber: "" },
    });
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(1);
  });

  it("runs caller-supplied extraStages alongside the 10 built-in stages", () => {
    const extraStage = {
      name: "custom",
      validate: () => ({ valid: false, issues: [{ path: "custom", message: "always fails" }] }),
    };
    const validator = new KnowledgeVersionValidator({ extraStages: [extraStage] });
    expect(validator.stageNames).toContain("custom");
    expect(validator.validate(baseInput()).valid).toBe(false);
  });

  it("wires a shared policy/permission instance into its stages", () => {
    const policy = new KnowledgeVersionPolicy();
    const permission = new KnowledgeVersionPermission();
    const validator = new KnowledgeVersionValidator({ policy, permission });
    expect(validator.validate(baseInput()).valid).toBe(true);
  });
});

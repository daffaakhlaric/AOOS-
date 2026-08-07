import { describe, expect, it } from "vitest";

import { EmbeddingModelName } from "../../src/domain/embedding-model-name.js";
import { EmbeddingProviderType } from "../../src/domain/embedding-provider-type.js";
import { EmbeddingState } from "../../src/domain/embedding-state.js";
import { AuditValidator } from "../../src/validator/audit-validator.js";
import { ConfigurationValidator } from "../../src/validator/configuration-validator.js";
import { DependencyValidator } from "../../src/validator/dependency-validator.js";
import { EmbeddingValidator } from "../../src/validator/embedding-validator.js";
import { IdentityValidator } from "../../src/validator/identity-validator.js";
import { IntegrityValidator } from "../../src/validator/integrity-validator.js";
import { LifecycleValidator } from "../../src/validator/lifecycle-validator.js";
import { MetadataValidator } from "../../src/validator/metadata-validator.js";
import { ModelValidator } from "../../src/validator/model-validator.js";
import { NamespaceValidator } from "../../src/validator/namespace-validator.js";
import { ProviderValidator } from "../../src/validator/provider-validator.js";
import { StatisticsValidator } from "../../src/validator/statistics-validator.js";
import { VersionValidator } from "../../src/validator/version-validator.js";
import { validatorInputFixture } from "../helpers/validator-input-fixture.js";

describe("EmbeddingValidator aggregator", () => {
  it("has exactly 12 built-in stages, in the documented order", () => {
    const validator = new EmbeddingValidator();
    expect(validator.stageNames).toEqual([
      "identity",
      "metadata",
      "provider",
      "model",
      "namespace",
      "configuration",
      "version",
      "lifecycle",
      "dependency",
      "statistics",
      "integrity",
      "audit",
    ]);
  });

  it("validates a well-formed input as valid", () => {
    const validator = new EmbeddingValidator();
    const result = validator.validate(validatorInputFixture());
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("aggregates issues from multiple stages without short-circuiting", () => {
    const validator = new EmbeddingValidator();
    const input = validatorInputFixture({
      embedding: { ...validatorInputFixture().embedding, embeddingId: "" },
      request: { ...validatorInputFixture().request, requestedBy: "" },
    });
    const result = validator.validate(input);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(1);
  });

  it("supports extraStages", () => {
    const validator = new EmbeddingValidator({
      extraStages: [
        {
          name: "custom",
          validate: () => ({ valid: false, issues: [{ path: "custom", message: "always fails" }] }),
        },
      ],
    });
    expect(validator.stageNames).toContain("custom");
    expect(validator.validate(validatorInputFixture()).valid).toBe(false);
  });
});

describe("IdentityValidator", () => {
  const stage = new IdentityValidator();

  it("passes for a well-formed input", () => {
    expect(stage.validate(validatorInputFixture()).valid).toBe(true);
  });

  it("flags a blank embeddingId", () => {
    const input = validatorInputFixture();
    const result = stage.validate({ ...input, embedding: { ...input.embedding, embeddingId: "" } });
    expect(result.valid).toBe(false);
  });

  it("flags a metadata/embedding embeddingId mismatch", () => {
    const input = validatorInputFixture();
    const result = stage.validate({
      ...input,
      metadata: { ...input.metadata, embeddingId: "other" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a request/embedding embeddingId mismatch", () => {
    const input = validatorInputFixture();
    const result = stage.validate({
      ...input,
      request: { ...input.request, embeddingId: "other" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a malformed context token", () => {
    const input = validatorInputFixture();
    const result = stage.validate({ ...input, context: { ...input.context, token: "bad-token" } });
    expect(result.valid).toBe(false);
  });
});

describe("MetadataValidator", () => {
  const stage = new MetadataValidator();

  it("passes for a well-formed input", () => {
    expect(stage.validate(validatorInputFixture()).valid).toBe(true);
  });

  it("flags a blank title", () => {
    const input = validatorInputFixture();
    const result = stage.validate({ ...input, metadata: { ...input.metadata, title: "" } });
    expect(result.valid).toBe(false);
  });

  it("flags a blank tenantId", () => {
    const input = validatorInputFixture();
    const result = stage.validate({ ...input, metadata: { ...input.metadata, tenantId: "" } });
    expect(result.valid).toBe(false);
  });

  it("flags a malformed createdAt", () => {
    const input = validatorInputFixture();
    const result = stage.validate({
      ...input,
      metadata: { ...input.metadata, createdAt: "not-a-date" },
    });
    expect(result.valid).toBe(false);
  });
});

describe("ProviderValidator", () => {
  const stage = new ProviderValidator();

  it("passes for a well-formed input", () => {
    expect(stage.validate(validatorInputFixture()).valid).toBe(true);
  });

  it("flags an inactive resolvedProvider", () => {
    const input = validatorInputFixture({
      resolvedProvider: {
        id: "p-1",
        providerId: "p-1",
        name: "OpenAI",
        type: EmbeddingProviderType.OPENAI,
        tenantId: "tenant-1",
        active: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(stage.validate(input).valid).toBe(false);
  });
});

describe("ModelValidator", () => {
  const stage = new ModelValidator();

  it("passes for a compatible Model/Provider pair", () => {
    expect(stage.validate(validatorInputFixture()).valid).toBe(true);
  });

  it("flags an incompatible Model/Provider pair", () => {
    const input = validatorInputFixture();
    const result = stage.validate({
      ...input,
      request: { ...input.request, providerType: EmbeddingProviderType.COHERE },
    });
    expect(result.valid).toBe(false);
  });

  it("flags an inactive resolvedModel", () => {
    const input = validatorInputFixture({
      resolvedModel: {
        id: "m-1",
        modelId: "m-1",
        name: EmbeddingModelName.TEXT_EMBEDDING_3_SMALL,
        providerType: EmbeddingProviderType.OPENAI,
        tenantId: "tenant-1",
        active: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(stage.validate(input).valid).toBe(false);
  });
});

describe("NamespaceValidator", () => {
  const stage = new NamespaceValidator();

  it("passes when no namespaceId is declared", () => {
    expect(stage.validate(validatorInputFixture()).valid).toBe(true);
  });

  it("flags a blank declared namespaceId", () => {
    const input = validatorInputFixture();
    const result = stage.validate({ ...input, request: { ...input.request, namespaceId: "  " } });
    expect(result.valid).toBe(false);
  });

  it("flags an inactive resolvedNamespace", () => {
    const input = validatorInputFixture({
      resolvedNamespace: {
        id: "n-1",
        namespaceId: "n-1",
        name: "docs",
        tenantId: "tenant-1",
        active: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(stage.validate(input).valid).toBe(false);
  });
});

describe("ConfigurationValidator", () => {
  const stage = new ConfigurationValidator();

  it("passes when no configuration is present", () => {
    expect(stage.validate(validatorInputFixture()).valid).toBe(true);
  });

  it("does not flag an embeddingId mismatch (Configuration may be a reusable template registered before the Embedding exists)", () => {
    const input = validatorInputFixture({
      configuration: {
        id: "cfg-1",
        configurationId: "cfg-1",
        embeddingId: "other",
        tenantId: "tenant-1",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(stage.validate(input).valid).toBe(true);
  });

  it("flags a non-positive timeoutMs", () => {
    const base = validatorInputFixture();
    const input = validatorInputFixture({
      configuration: {
        id: "cfg-1",
        configurationId: "cfg-1",
        embeddingId: base.embedding.embeddingId,
        tenantId: "tenant-1",
        timeoutMs: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(stage.validate(input).valid).toBe(false);
  });

  it("flags a negative retries", () => {
    const base = validatorInputFixture();
    const input = validatorInputFixture({
      configuration: {
        id: "cfg-1",
        configurationId: "cfg-1",
        embeddingId: base.embedding.embeddingId,
        tenantId: "tenant-1",
        retries: -1,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(stage.validate(input).valid).toBe(false);
  });
});

describe("VersionValidator", () => {
  const stage = new VersionValidator();

  it("passes when no version is resolved", () => {
    expect(stage.validate(validatorInputFixture()).valid).toBe(true);
  });

  it("flags a blank versionLabel", () => {
    const input = validatorInputFixture({
      resolvedVersion: {
        id: "v-1",
        versionId: "v-1",
        modelId: "m-1",
        providerType: EmbeddingProviderType.OPENAI,
        tenantId: "tenant-1",
        versionLabel: "",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(stage.validate(input).valid).toBe(false);
  });

  it("flags a modelId mismatch against the resolvedModel", () => {
    const input = validatorInputFixture({
      resolvedModel: {
        id: "m-1",
        modelId: "m-1",
        name: EmbeddingModelName.TEXT_EMBEDDING_3_SMALL,
        providerType: EmbeddingProviderType.OPENAI,
        tenantId: "tenant-1",
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      resolvedVersion: {
        id: "v-1",
        versionId: "v-1",
        modelId: "other-model",
        providerType: EmbeddingProviderType.OPENAI,
        tenantId: "tenant-1",
        versionLabel: "1.0.0",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(stage.validate(input).valid).toBe(false);
  });
});

describe("LifecycleValidator", () => {
  const stage = new LifecycleValidator();

  it("passes when no target state is supplied", () => {
    expect(stage.validate(validatorInputFixture()).valid).toBe(true);
  });

  it("passes for a legal transition", () => {
    const input = validatorInputFixture({
      currentState: EmbeddingState.DRAFT,
      targetState: EmbeddingState.QUEUED,
    });
    expect(stage.validate(input).valid).toBe(true);
  });

  it("flags an illegal transition", () => {
    const input = validatorInputFixture({
      currentState: EmbeddingState.DRAFT,
      targetState: EmbeddingState.COMPLETED,
    });
    expect(stage.validate(input).valid).toBe(false);
  });
});

describe("DependencyValidator", () => {
  const stage = new DependencyValidator();

  it("passes for a well-formed input", () => {
    expect(stage.validate(validatorInputFixture()).valid).toBe(true);
  });

  it("flags Custom Provider paired with a non-custom Model", () => {
    const input = validatorInputFixture();
    const result = stage.validate({
      ...input,
      request: {
        ...input.request,
        providerType: EmbeddingProviderType.CUSTOM_PROVIDER,
        modelName: EmbeddingModelName.TEXT_EMBEDDING_3_SMALL,
      },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a blank textReference", () => {
    const input = validatorInputFixture();
    const result = stage.validate({ ...input, request: { ...input.request, textReference: "" } });
    expect(result.valid).toBe(false);
  });
});

describe("StatisticsValidator", () => {
  const stage = new StatisticsValidator();

  it("passes when no snapshot is supplied", () => {
    expect(stage.validate(validatorInputFixture()).valid).toBe(true);
  });

  it("passes for a well-formed snapshot", () => {
    const input = validatorInputFixture({
      statisticsSnapshot: {
        requestedCount: 1,
        completedCount: 1,
        failedCount: 0,
        cancelledCount: 0,
      },
    });
    expect(stage.validate(input).valid).toBe(true);
  });

  it("flags a negative counter", () => {
    const input = validatorInputFixture({
      statisticsSnapshot: {
        requestedCount: -1,
        completedCount: 0,
        failedCount: 0,
        cancelledCount: 0,
      },
    });
    expect(stage.validate(input).valid).toBe(false);
  });
});

describe("IntegrityValidator", () => {
  const stage = new IntegrityValidator();

  it("passes for a well-formed input", () => {
    expect(stage.validate(validatorInputFixture()).valid).toBe(true);
  });

  it("flags a context/metadata tenantId mismatch", () => {
    const input = validatorInputFixture();
    const result = stage.validate({
      ...input,
      context: { ...input.context, tenantId: "other-tenant" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a resolvedProvider tenantId mismatch", () => {
    const input = validatorInputFixture({
      resolvedProvider: {
        id: "p-1",
        providerId: "p-1",
        name: "OpenAI",
        type: EmbeddingProviderType.OPENAI,
        tenantId: "other-tenant",
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(stage.validate(input).valid).toBe(false);
  });

  it("flags a resolvedModel tenantId mismatch", () => {
    const input = validatorInputFixture({
      resolvedModel: {
        id: "m-1",
        modelId: "m-1",
        name: EmbeddingModelName.TEXT_EMBEDDING_3_SMALL,
        providerType: EmbeddingProviderType.OPENAI,
        tenantId: "other-tenant",
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(stage.validate(input).valid).toBe(false);
  });

  it("flags a resolvedNamespace tenantId mismatch", () => {
    const input = validatorInputFixture({
      resolvedNamespace: {
        id: "n-1",
        namespaceId: "n-1",
        name: "docs",
        tenantId: "other-tenant",
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(stage.validate(input).valid).toBe(false);
  });
});

describe("AuditValidator", () => {
  const stage = new AuditValidator();

  it("passes for a well-formed input", () => {
    expect(stage.validate(validatorInputFixture()).valid).toBe(true);
  });

  it("flags a blank requestedBy", () => {
    const input = validatorInputFixture();
    const result = stage.validate({ ...input, request: { ...input.request, requestedBy: "" } });
    expect(result.valid).toBe(false);
  });

  it("flags a malformed createdAt", () => {
    const input = validatorInputFixture();
    const result = stage.validate({
      ...input,
      request: { ...input.request, createdAt: "not-a-date" },
    });
    expect(result.valid).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { embeddingAuditSchema } from "../../src/domain/embedding-audit.js";
import { embeddingCacheSchema } from "../../src/domain/embedding-cache.js";
import { embeddingConfigurationSchema } from "../../src/domain/embedding-configuration.js";
import { embeddingJobSchema } from "../../src/domain/embedding-job.js";
import { embeddingMetadataSchema } from "../../src/domain/embedding-metadata.js";
import { EmbeddingModelName } from "../../src/domain/embedding-model-name.js";
import { embeddingModelSchema } from "../../src/domain/embedding-model.js";
import { embeddingNamespaceSchema } from "../../src/domain/embedding-namespace.js";
import { EmbeddingProviderType } from "../../src/domain/embedding-provider-type.js";
import { embeddingProviderSchema } from "../../src/domain/embedding-provider.js";
import { embeddingRequestSchema } from "../../src/domain/embedding-request.js";
import { embeddingResultMetadataSchema } from "../../src/domain/embedding-result-metadata.js";
import { embeddingSessionSchema } from "../../src/domain/embedding-session.js";
import { EmbeddingState } from "../../src/domain/embedding-state.js";
import { embeddingVersionSchema } from "../../src/domain/embedding-version.js";
import { embeddingSchema } from "../../src/domain/embedding.js";

const NOW = "2026-01-01T00:00:00.000Z";

describe("domain schemas", () => {
  it("validates a well-formed Embedding", () => {
    const result = embeddingSchema.safeParse({
      id: "e-1",
      token: "embt_1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      state: EmbeddingState.DRAFT,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an Embedding with a blank id", () => {
    const result = embeddingSchema.safeParse({
      id: "",
      token: "embt_1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      state: EmbeddingState.DRAFT,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(result.success).toBe(false);
  });

  it("validates a well-formed EmbeddingJob", () => {
    const result = embeddingJobSchema.safeParse({
      id: "j-1",
      jobId: "j-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      createdAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an EmbeddingJob with an out-of-range priority", () => {
    const result = embeddingJobSchema.safeParse({
      id: "j-1",
      jobId: "j-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      priority: 42,
      createdAt: NOW,
    });
    expect(result.success).toBe(false);
  });

  it("validates a well-formed EmbeddingSession record", () => {
    const result = embeddingSessionSchema.safeParse({
      id: "s-1",
      sessionId: "s-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      holder: "user-1",
      state: "open",
      openedAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("validates a well-formed EmbeddingRequest", () => {
    const result = embeddingRequestSchema.safeParse({
      id: "r-1",
      requestId: "r-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      textReference: "ref-1",
      providerType: EmbeddingProviderType.OPENAI,
      modelName: EmbeddingModelName.TEXT_EMBEDDING_3_SMALL,
      requestedBy: "user-1",
      createdAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an EmbeddingRequest with a blank textReference", () => {
    const result = embeddingRequestSchema.safeParse({
      id: "r-1",
      requestId: "r-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      textReference: "",
      providerType: EmbeddingProviderType.OPENAI,
      modelName: EmbeddingModelName.TEXT_EMBEDDING_3_SMALL,
      requestedBy: "user-1",
      createdAt: NOW,
    });
    expect(result.success).toBe(false);
  });

  it("validates a well-formed EmbeddingResultMetadata", () => {
    const result = embeddingResultMetadataSchema.safeParse({
      id: "rm-1",
      resultId: "rm-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      dimensionCount: 1536,
      completedAt: NOW,
      createdAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("rejects EmbeddingResultMetadata with a non-positive dimensionCount", () => {
    const result = embeddingResultMetadataSchema.safeParse({
      id: "rm-1",
      resultId: "rm-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      dimensionCount: 0,
      completedAt: NOW,
      createdAt: NOW,
    });
    expect(result.success).toBe(false);
  });

  it("validates a well-formed EmbeddingMetadata", () => {
    const result = embeddingMetadataSchema.safeParse({
      id: "m-1",
      embeddingId: "e-1",
      title: "Title",
      tenantId: "tenant-1",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("validates a well-formed EmbeddingProvider", () => {
    const result = embeddingProviderSchema.safeParse({
      id: "p-1",
      providerId: "p-1",
      name: "OpenAI",
      type: EmbeddingProviderType.OPENAI,
      tenantId: "tenant-1",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("validates a well-formed EmbeddingModel", () => {
    const result = embeddingModelSchema.safeParse({
      id: "m-1",
      modelId: "m-1",
      name: EmbeddingModelName.TEXT_EMBEDDING_3_SMALL,
      providerType: EmbeddingProviderType.OPENAI,
      tenantId: "tenant-1",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("validates a well-formed EmbeddingVersion", () => {
    const result = embeddingVersionSchema.safeParse({
      id: "v-1",
      versionId: "v-1",
      modelId: "m-1",
      providerType: EmbeddingProviderType.OPENAI,
      tenantId: "tenant-1",
      versionLabel: "1.0.0",
      createdAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("validates a well-formed EmbeddingNamespace", () => {
    const result = embeddingNamespaceSchema.safeParse({
      id: "n-1",
      namespaceId: "n-1",
      name: "docs",
      tenantId: "tenant-1",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("validates a well-formed EmbeddingCache", () => {
    const result = embeddingCacheSchema.safeParse({
      id: "c-1",
      cacheId: "c-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      cacheKeyReference: "key-1",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("validates a well-formed EmbeddingConfiguration", () => {
    const result = embeddingConfigurationSchema.safeParse({
      id: "cfg-1",
      configurationId: "cfg-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      createdAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("validates a well-formed EmbeddingAudit", () => {
    const result = embeddingAuditSchema.safeParse({
      id: "a-1",
      auditId: "a-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      action: "create_embedding",
      occurredAt: NOW,
    });
    expect(result.success).toBe(true);
  });
});

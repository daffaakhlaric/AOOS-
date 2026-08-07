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
import { embeddingStatisticsSnapshotSchema } from "../../src/domain/embedding-statistics-snapshot.js";
import { embeddingVersionSchema } from "../../src/domain/embedding-version.js";
import { embeddingSchema } from "../../src/domain/embedding.js";

const NOW = "2026-01-01T00:00:00.000Z";

describe("domain schemas — negative cases", () => {
  it("embeddingSchema rejects an invalid state value", () => {
    expect(
      embeddingSchema.safeParse({
        id: "e-1",
        token: "embt_1",
        embeddingId: "e-1",
        tenantId: "tenant-1",
        state: "not-a-real-state",
        createdAt: NOW,
        updatedAt: NOW,
      }).success,
    ).toBe(false);
  });

  it("embeddingSchema rejects a malformed createdAt", () => {
    expect(
      embeddingSchema.safeParse({
        id: "e-1",
        token: "embt_1",
        embeddingId: "e-1",
        tenantId: "tenant-1",
        state: EmbeddingState.DRAFT,
        createdAt: "not-a-date",
        updatedAt: NOW,
      }).success,
    ).toBe(false);
  });

  it("embeddingJobSchema rejects a negative priority", () => {
    expect(
      embeddingJobSchema.safeParse({
        id: "j-1",
        jobId: "j-1",
        embeddingId: "e-1",
        tenantId: "tenant-1",
        priority: -1,
        createdAt: NOW,
      }).success,
    ).toBe(false);
  });

  it("embeddingJobSchema accepts an omitted priority (defaults to 5)", () => {
    const result = embeddingJobSchema.safeParse({
      id: "j-1",
      jobId: "j-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      createdAt: NOW,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.priority).toBe(5);
  });

  it("embeddingSessionSchema rejects an invalid session state", () => {
    expect(
      embeddingSessionSchema.safeParse({
        id: "s-1",
        sessionId: "s-1",
        embeddingId: "e-1",
        tenantId: "tenant-1",
        holder: "user-1",
        state: "bogus",
        openedAt: NOW,
      }).success,
    ).toBe(false);
  });

  it("embeddingRequestSchema rejects an invalid providerType", () => {
    expect(
      embeddingRequestSchema.safeParse({
        id: "r-1",
        requestId: "r-1",
        embeddingId: "e-1",
        tenantId: "tenant-1",
        textReference: "ref",
        providerType: "not-a-provider",
        modelName: EmbeddingModelName.CUSTOM,
        requestedBy: "user-1",
        createdAt: NOW,
      }).success,
    ).toBe(false);
  });

  it("embeddingRequestSchema rejects an invalid modelName", () => {
    expect(
      embeddingRequestSchema.safeParse({
        id: "r-1",
        requestId: "r-1",
        embeddingId: "e-1",
        tenantId: "tenant-1",
        textReference: "ref",
        providerType: EmbeddingProviderType.OPENAI,
        modelName: "not-a-model",
        requestedBy: "user-1",
        createdAt: NOW,
      }).success,
    ).toBe(false);
  });

  it("embeddingRequestSchema accepts an optional contentReference", () => {
    const result = embeddingRequestSchema.safeParse({
      id: "r-1",
      requestId: "r-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      textReference: "ref",
      contentReference: "content-ref",
      providerType: EmbeddingProviderType.OPENAI,
      modelName: EmbeddingModelName.TEXT_EMBEDDING_3_SMALL,
      requestedBy: "user-1",
      createdAt: NOW,
    });
    expect(result.success).toBe(true);
  });

  it("embeddingResultMetadataSchema rejects a negative dimensionCount", () => {
    expect(
      embeddingResultMetadataSchema.safeParse({
        id: "rm-1",
        resultId: "rm-1",
        embeddingId: "e-1",
        tenantId: "tenant-1",
        dimensionCount: -5,
        completedAt: NOW,
        createdAt: NOW,
      }).success,
    ).toBe(false);
  });

  it("embeddingMetadataSchema rejects a blank title", () => {
    expect(
      embeddingMetadataSchema.safeParse({
        id: "m-1",
        embeddingId: "e-1",
        title: "",
        tenantId: "tenant-1",
        createdAt: NOW,
        updatedAt: NOW,
      }).success,
    ).toBe(false);
  });

  it("embeddingProviderSchema rejects an invalid type", () => {
    expect(
      embeddingProviderSchema.safeParse({
        id: "p-1",
        providerId: "p-1",
        name: "X",
        type: "not-a-type",
        tenantId: "tenant-1",
        createdAt: NOW,
        updatedAt: NOW,
      }).success,
    ).toBe(false);
  });

  it("embeddingProviderSchema accepts an omitted active (defaults to true)", () => {
    const result = embeddingProviderSchema.safeParse({
      id: "p-1",
      providerId: "p-1",
      name: "X",
      type: EmbeddingProviderType.OPENAI,
      tenantId: "tenant-1",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.active).toBe(true);
  });

  it("embeddingModelSchema rejects a non-positive dimensions", () => {
    expect(
      embeddingModelSchema.safeParse({
        id: "m-1",
        modelId: "m-1",
        name: EmbeddingModelName.CUSTOM,
        providerType: EmbeddingProviderType.CUSTOM_PROVIDER,
        tenantId: "tenant-1",
        dimensions: 0,
        createdAt: NOW,
        updatedAt: NOW,
      }).success,
    ).toBe(false);
  });

  it("embeddingVersionSchema rejects a blank versionLabel", () => {
    expect(
      embeddingVersionSchema.safeParse({
        id: "v-1",
        versionId: "v-1",
        modelId: "m-1",
        providerType: EmbeddingProviderType.OPENAI,
        tenantId: "tenant-1",
        versionLabel: "",
        createdAt: NOW,
      }).success,
    ).toBe(false);
  });

  it("embeddingNamespaceSchema rejects a blank name", () => {
    expect(
      embeddingNamespaceSchema.safeParse({
        id: "n-1",
        namespaceId: "n-1",
        name: "",
        tenantId: "tenant-1",
        createdAt: NOW,
        updatedAt: NOW,
      }).success,
    ).toBe(false);
  });

  it("embeddingCacheSchema rejects a negative hitCount", () => {
    expect(
      embeddingCacheSchema.safeParse({
        id: "c-1",
        cacheId: "c-1",
        embeddingId: "e-1",
        tenantId: "tenant-1",
        cacheKeyReference: "key",
        hitCount: -1,
        createdAt: NOW,
        updatedAt: NOW,
      }).success,
    ).toBe(false);
  });

  it("embeddingConfigurationSchema rejects a negative retries", () => {
    expect(
      embeddingConfigurationSchema.safeParse({
        id: "cfg-1",
        configurationId: "cfg-1",
        embeddingId: "e-1",
        tenantId: "tenant-1",
        retries: -1,
        createdAt: NOW,
      }).success,
    ).toBe(false);
  });

  it("embeddingAuditSchema rejects a blank action", () => {
    expect(
      embeddingAuditSchema.safeParse({
        id: "a-1",
        auditId: "a-1",
        embeddingId: "e-1",
        tenantId: "tenant-1",
        action: "",
        occurredAt: NOW,
      }).success,
    ).toBe(false);
  });

  it("embeddingStatisticsSnapshotSchema rejects a negative counter", () => {
    expect(
      embeddingStatisticsSnapshotSchema.safeParse({
        requestedCount: -1,
        completedCount: 0,
        failedCount: 0,
        cancelledCount: 0,
      }).success,
    ).toBe(false);
  });

  it("embeddingStatisticsSnapshotSchema accepts a well-formed snapshot", () => {
    expect(
      embeddingStatisticsSnapshotSchema.safeParse({
        requestedCount: 1,
        completedCount: 1,
        failedCount: 0,
        cancelledCount: 0,
        lastActivityAt: NOW,
      }).success,
    ).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import type { IEmbeddingAuditProvider } from "../../src/contracts/i-embedding-audit-provider.js";
import type { IEmbeddingCacheProvider } from "../../src/contracts/i-embedding-cache-provider.js";
import type { IEmbeddingCompressionProvider } from "../../src/contracts/i-embedding-compression-provider.js";
import type { IEmbeddingCostProvider } from "../../src/contracts/i-embedding-cost-provider.js";
import type { IEmbeddingEncryptionProvider } from "../../src/contracts/i-embedding-encryption-provider.js";
import type { IEmbeddingMetricsProvider } from "../../src/contracts/i-embedding-metrics-provider.js";
import type { IEmbeddingModelProvider } from "../../src/contracts/i-embedding-model-provider.js";
import type { IEmbeddingProvider } from "../../src/contracts/i-embedding-provider.js";
import type { IEmbeddingPublisher } from "../../src/contracts/i-embedding-publisher.js";
import type { IEmbeddingScheduler } from "../../src/contracts/i-embedding-scheduler.js";
import type { IEmbeddingStorageProvider } from "../../src/contracts/i-embedding-storage-provider.js";
import type { IEmbeddingStreamingProvider } from "../../src/contracts/i-embedding-streaming-provider.js";
import type { IKnowledgeGraphEmbeddingProvider } from "../../src/contracts/i-knowledge-graph-embedding-provider.js";
import type { IKnowledgeRecommendationEmbeddingProvider } from "../../src/contracts/i-knowledge-recommendation-embedding-provider.js";
import { EmbeddingModelName } from "../../src/domain/embedding-model-name.js";

/**
 * "EXTENSION POINTS: Interfaces ONLY. Never implement." — these tests confirm each of
 * the 12 documented interfaces (plus the 2 Future Readiness contracts) is a usable,
 * correctly-shaped TypeScript contract by constructing a minimal fake and exercising it
 * — NOT a real implementation shipped by this package.
 */
describe("Extension Point contracts — minimal fakes satisfy each interface", () => {
  it("IEmbeddingProvider.embed() returns dimensionCount metadata, never a vector", async () => {
    const fake: IEmbeddingProvider = { embed: async () => ({ dimensionCount: 768 }) };
    const result = await fake.embed({
      id: "r-1",
      requestId: "r-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      textReference: "ref",
      providerType: "openai" as never,
      modelName: EmbeddingModelName.CUSTOM,
      requestedBy: "user-1",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.dimensionCount).toBe(768);
    expect("vector" in result).toBe(false);
  });

  it("IEmbeddingModelProvider.describeModel() may resolve undefined", async () => {
    const fake: IEmbeddingModelProvider = { describeModel: async () => undefined };
    await expect(fake.describeModel(EmbeddingModelName.CUSTOM)).resolves.toBeUndefined();
  });

  it("IEmbeddingStorageProvider.store() resolves void", async () => {
    const fake: IEmbeddingStorageProvider = { store: async () => undefined };
    await expect(
      fake.store({
        id: "rm-1",
        resultId: "rm-1",
        embeddingId: "e-1",
        tenantId: "tenant-1",
        dimensionCount: 10,
        completedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ).resolves.toBeUndefined();
  });

  it("IEmbeddingCacheProvider.lookup()/record() round-trip", async () => {
    const store = new Map<string, unknown>();
    const fake: IEmbeddingCacheProvider = {
      lookup: async (key) => store.get(key) as never,
      record: async (cache) => {
        store.set(cache.cacheKeyReference, cache);
      },
    };
    await fake.record({
      id: "c-1",
      cacheId: "c-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      cacheKeyReference: "key-1",
      hitCount: 0,
      missCount: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(await fake.lookup("key-1")).toBeDefined();
  });

  it("IEmbeddingScheduler.schedule() resolves void", async () => {
    const fake: IEmbeddingScheduler = { schedule: async () => undefined };
    await expect(
      fake.schedule({
        id: "j-1",
        jobId: "j-1",
        embeddingId: "e-1",
        tenantId: "tenant-1",
        priority: 5,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ).resolves.toBeUndefined();
  });

  it("IEmbeddingAuditProvider.record() resolves void", async () => {
    const fake: IEmbeddingAuditProvider = { record: async () => undefined };
    await expect(
      fake.record({
        id: "a-1",
        auditId: "a-1",
        embeddingId: "e-1",
        tenantId: "tenant-1",
        action: "test",
        occurredAt: "2026-01-01T00:00:00.000Z",
      }),
    ).resolves.toBeUndefined();
  });

  it("IEmbeddingPublisher.publish() accepts a type and payload", async () => {
    const seen: unknown[] = [];
    const fake: IEmbeddingPublisher = {
      publish: async (type, payload) => {
        seen.push({ type, payload });
      },
    };
    await fake.publish("embedding.created", { a: 1 });
    expect(seen).toHaveLength(1);
  });

  it("IEmbeddingCompressionProvider.describe() returns an algorithm label", async () => {
    const fake: IEmbeddingCompressionProvider = { describe: async () => ({ algorithm: "pq8" }) };
    expect((await fake.describe()).algorithm).toBe("pq8");
  });

  it("IEmbeddingEncryptionProvider.describe() returns an algorithm label", async () => {
    const fake: IEmbeddingEncryptionProvider = {
      describe: async () => ({ algorithm: "aes-256-gcm" }),
    };
    expect((await fake.describe()).algorithm).toBe("aes-256-gcm");
  });

  it("IEmbeddingCostProvider.estimateCost() returns amount/currency", async () => {
    const fake: IEmbeddingCostProvider = {
      estimateCost: async () => ({ amount: 0.02, currency: "USD" }),
    };
    const result = await fake.estimateCost({
      id: "r-1",
      requestId: "r-1",
      embeddingId: "e-1",
      tenantId: "tenant-1",
      textReference: "ref",
      providerType: "openai" as never,
      modelName: EmbeddingModelName.CUSTOM,
      requestedBy: "user-1",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.currency).toBe("USD");
  });

  it("IEmbeddingMetricsProvider.publish() accepts a metrics snapshot", async () => {
    const seen: unknown[] = [];
    const fake: IEmbeddingMetricsProvider = {
      publish: async (snapshot) => {
        seen.push(snapshot);
      },
    };
    await fake.publish({
      embeddingCount: 1,
      providerCount: 1,
      modelCount: 1,
      versionCount: 0,
      namespaceCount: 0,
      averageDurationMs: 0,
      cacheMetadataCount: 0,
      providerUsage: {},
      checkCount: 1,
      checkFailureCount: 0,
    });
    expect(seen).toHaveLength(1);
  });

  it("IEmbeddingStreamingProvider.stream() is an async iterable", async () => {
    const fake: IEmbeddingStreamingProvider = {
      stream: async function* () {
        yield {
          id: "rm-1",
          resultId: "rm-1",
          embeddingId: "e-1",
          tenantId: "tenant-1",
          dimensionCount: 10,
          completedAt: "2026-01-01T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
        };
      },
    };
    const collected = [];
    for await (const item of fake.stream("e-1")) collected.push(item);
    expect(collected).toHaveLength(1);
  });

  it("IKnowledgeGraphEmbeddingProvider.linkEmbeddingToNode() resolves void (Future Readiness for 005.7O)", async () => {
    const fake: IKnowledgeGraphEmbeddingProvider = { linkEmbeddingToNode: async () => undefined };
    await expect(
      fake.linkEmbeddingToNode(
        {
          id: "rm-1",
          resultId: "rm-1",
          embeddingId: "e-1",
          tenantId: "tenant-1",
          dimensionCount: 10,
          completedAt: "2026-01-01T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        "node-1",
      ),
    ).resolves.toBeUndefined();
  });

  it("IKnowledgeRecommendationEmbeddingProvider.rankCandidates() returns an ordered id list (Future Readiness for 005.7P)", async () => {
    const fake: IKnowledgeRecommendationEmbeddingProvider = {
      rankCandidates: async (_result, candidateIds) => [...candidateIds].reverse(),
    };
    const ranked = await fake.rankCandidates(
      {
        id: "rm-1",
        resultId: "rm-1",
        embeddingId: "e-1",
        tenantId: "tenant-1",
        dimensionCount: 10,
        completedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      ["a", "b"],
    );
    expect(ranked).toEqual(["b", "a"]);
  });
});

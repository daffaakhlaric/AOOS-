import type { IEmbeddingAuditProvider } from "../contracts/i-embedding-audit-provider.js";
import type { IEmbeddingCacheProvider } from "../contracts/i-embedding-cache-provider.js";
import type { IEmbeddingCompressionProvider } from "../contracts/i-embedding-compression-provider.js";
import type { IEmbeddingCostProvider } from "../contracts/i-embedding-cost-provider.js";
import type { IEmbeddingEncryptionProvider } from "../contracts/i-embedding-encryption-provider.js";
import type { IEmbeddingMetricsProvider } from "../contracts/i-embedding-metrics-provider.js";
import type { IEmbeddingModelProvider } from "../contracts/i-embedding-model-provider.js";
import type { IEmbeddingProvider } from "../contracts/i-embedding-provider.js";
import type { IEmbeddingPublisher } from "../contracts/i-embedding-publisher.js";
import type { IEmbeddingScheduler } from "../contracts/i-embedding-scheduler.js";
import type { IEmbeddingStorageProvider } from "../contracts/i-embedding-storage-provider.js";
import type { IEmbeddingStreamingProvider } from "../contracts/i-embedding-streaming-provider.js";
import type { IKnowledgeGraphEmbeddingProvider } from "../contracts/i-knowledge-graph-embedding-provider.js";
import type { IKnowledgeRecommendationEmbeddingProvider } from "../contracts/i-knowledge-recommendation-embedding-provider.js";

/**
 * "EXTENSION POINTS: Interfaces ONLY. Never implement." (docs/PROMPT-005.7N-EMBEDDING-
 * MANAGER.md) — every field is optional. `provider` is the only seam through which
 * `start()` can ever invoke a caller-supplied `IEmbeddingProvider` — this package
 * registers NONE by default (no default "fake embedding" implementation). Also carries
 * the 2 Future Readiness contracts for 005.7O/005.7P.
 */
export interface EmbeddingManagerConfig {
  readonly provider?: IEmbeddingProvider;
  readonly modelProvider?: IEmbeddingModelProvider;
  readonly storage?: IEmbeddingStorageProvider;
  readonly cacheProvider?: IEmbeddingCacheProvider;
  readonly scheduler?: IEmbeddingScheduler;
  readonly auditProvider?: IEmbeddingAuditProvider;
  readonly publisher?: IEmbeddingPublisher;
  readonly compressionProvider?: IEmbeddingCompressionProvider;
  readonly encryptionProvider?: IEmbeddingEncryptionProvider;
  readonly costProvider?: IEmbeddingCostProvider;
  readonly metricsProvider?: IEmbeddingMetricsProvider;
  readonly streamingProvider?: IEmbeddingStreamingProvider;
  readonly knowledgeGraphProvider?: IKnowledgeGraphEmbeddingProvider;
  readonly knowledgeRecommendationProvider?: IKnowledgeRecommendationEmbeddingProvider;
}

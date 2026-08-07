import type { IEmbeddingManagerGenerator } from "../contracts/i-embedding-manager-generator.js";
import type { IKnowledgeContextProvider } from "../contracts/i-knowledge-context-provider.js";
import type { IKnowledgeGenerationAuditor } from "../contracts/i-knowledge-generation-auditor.js";
import type { IKnowledgeGenerationCache } from "../contracts/i-knowledge-generation-cache.js";
import type { IKnowledgeGenerationCostProvider } from "../contracts/i-knowledge-generation-cost-provider.js";
import type { IKnowledgeGenerationOptimizer } from "../contracts/i-knowledge-generation-optimizer.js";
import type { IKnowledgeGenerationPolicy } from "../contracts/i-knowledge-generation-policy.js";
import type { IKnowledgeGenerationProvider } from "../contracts/i-knowledge-generation-provider.js";
import type { IKnowledgeGenerationPublisher } from "../contracts/i-knowledge-generation-publisher.js";
import type { IKnowledgeGenerationScheduler } from "../contracts/i-knowledge-generation-scheduler.js";
import type { IKnowledgeGenerationStorage } from "../contracts/i-knowledge-generation-storage.js";
import type { IKnowledgeGenerationStreamingProvider } from "../contracts/i-knowledge-generation-streaming-provider.js";
import type { IKnowledgePromptProvider } from "../contracts/i-knowledge-prompt-provider.js";
import type { IKnowledgeQualityEngineGenerator } from "../contracts/i-knowledge-quality-engine-generator.js";
import type { IKnowledgeValidatorAiGenerator } from "../contracts/i-knowledge-validator-ai-generator.js";
import type { KnowledgeGenerationProviderType } from "../domain/knowledge-generation-provider-type.js";

/**
 * "EXTENSION POINTS: Interfaces ONLY. Never implement." (docs/PROMPT-005.7K-KNOWLEDGE-
 * GENERATOR.md) — every field is optional. `providers` is the only seam through which
 * the Pipeline's Provider Resolution stage (Stage 5) can ever find a caller-supplied
 * `IKnowledgeGenerationProvider` — this package registers ZERO entries by default.
 * Also carries the 3 Future Readiness contracts for 005.7L/005.7M/005.7N.
 */
export interface KnowledgeGeneratorConfig {
  readonly providers?: Readonly<
    Partial<Record<KnowledgeGenerationProviderType, IKnowledgeGenerationProvider>>
  >;
  readonly promptProvider?: IKnowledgePromptProvider;
  readonly contextProvider?: IKnowledgeContextProvider;
  readonly policy?: IKnowledgeGenerationPolicy;
  readonly optimizer?: IKnowledgeGenerationOptimizer;
  readonly cache?: IKnowledgeGenerationCache;
  readonly storage?: IKnowledgeGenerationStorage;
  readonly publisher?: IKnowledgeGenerationPublisher;
  readonly auditor?: IKnowledgeGenerationAuditor;
  readonly scheduler?: IKnowledgeGenerationScheduler;
  readonly costProvider?: IKnowledgeGenerationCostProvider;
  readonly streamingProvider?: IKnowledgeGenerationStreamingProvider;
  readonly qualityEngineProvider?: IKnowledgeQualityEngineGenerator;
  readonly validatorAiProvider?: IKnowledgeValidatorAiGenerator;
  readonly embeddingManagerProvider?: IEmbeddingManagerGenerator;
}

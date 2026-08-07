import type { IEmbeddingManagerQuality } from "../contracts/i-embedding-manager-quality.js";
import type { IKnowledgeQualityAuditProvider } from "../contracts/i-knowledge-quality-audit-provider.js";
import type { IKnowledgeQualityCostProvider } from "../contracts/i-knowledge-quality-cost-provider.js";
import type { IKnowledgeQualityMetricsProvider } from "../contracts/i-knowledge-quality-metrics-provider.js";
import type { IKnowledgeQualityPolicyProvider } from "../contracts/i-knowledge-quality-policy-provider.js";
import type { IKnowledgeQualityProvider } from "../contracts/i-knowledge-quality-provider.js";
import type { IKnowledgeQualityPublisher } from "../contracts/i-knowledge-quality-publisher.js";
import type { IKnowledgeQualityReporter } from "../contracts/i-knowledge-quality-reporter.js";
import type { IKnowledgeQualityRuleProvider } from "../contracts/i-knowledge-quality-rule-provider.js";
import type { IKnowledgeQualityScheduler } from "../contracts/i-knowledge-quality-scheduler.js";
import type { IKnowledgeQualityScoringProvider } from "../contracts/i-knowledge-quality-scoring-provider.js";
import type { IKnowledgeQualityStorage } from "../contracts/i-knowledge-quality-storage.js";
import type { IKnowledgeQualityStreamingProvider } from "../contracts/i-knowledge-quality-streaming-provider.js";
import type { IKnowledgeValidatorAiQuality } from "../contracts/i-knowledge-validator-ai-quality.js";

/**
 * "EXTENSION POINTS: Interfaces ONLY. Never implement." (docs/PROMPT-005.7L-KNOWLEDGE-
 * QUALITY.md) — every field is optional. `provider`/`scoringProvider` are the only
 * seams through which `start()` can ever invoke a caller-supplied
 * `IKnowledgeQualityProvider`/`IKnowledgeQualityScoringProvider` — this package
 * registers NEITHER by default (no default "fake AI" implementation). Also carries the
 * 2 Future Readiness contracts for 005.7M/005.7N.
 */
export interface KnowledgeQualityConfig {
  readonly provider?: IKnowledgeQualityProvider;
  readonly scoringProvider?: IKnowledgeQualityScoringProvider;
  readonly ruleProvider?: IKnowledgeQualityRuleProvider;
  readonly policyProvider?: IKnowledgeQualityPolicyProvider;
  readonly storage?: IKnowledgeQualityStorage;
  readonly publisher?: IKnowledgeQualityPublisher;
  readonly auditProvider?: IKnowledgeQualityAuditProvider;
  readonly scheduler?: IKnowledgeQualityScheduler;
  readonly reporter?: IKnowledgeQualityReporter;
  readonly costProvider?: IKnowledgeQualityCostProvider;
  readonly streamingProvider?: IKnowledgeQualityStreamingProvider;
  readonly metricsProvider?: IKnowledgeQualityMetricsProvider;
  readonly validatorAiProvider?: IKnowledgeValidatorAiQuality;
  readonly embeddingManagerProvider?: IEmbeddingManagerQuality;
}

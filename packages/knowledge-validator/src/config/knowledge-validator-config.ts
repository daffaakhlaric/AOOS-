import type { IEmbeddingManagerValidator } from "../contracts/i-embedding-manager-validator.js";
import type { IKnowledgeGraphValidator } from "../contracts/i-knowledge-graph-validator.js";
import type { IKnowledgeValidationAuditProvider } from "../contracts/i-knowledge-validation-audit-provider.js";
import type { IKnowledgeValidationCostProvider } from "../contracts/i-knowledge-validation-cost-provider.js";
import type { IKnowledgeValidationDecisionProvider } from "../contracts/i-knowledge-validation-decision-provider.js";
import type { IKnowledgeValidationMetricsProvider } from "../contracts/i-knowledge-validation-metrics-provider.js";
import type { IKnowledgeValidationPolicyProvider } from "../contracts/i-knowledge-validation-policy-provider.js";
import type { IKnowledgeValidationProvider } from "../contracts/i-knowledge-validation-provider.js";
import type { IKnowledgeValidationPublisher } from "../contracts/i-knowledge-validation-publisher.js";
import type { IKnowledgeValidationReporter } from "../contracts/i-knowledge-validation-reporter.js";
import type { IKnowledgeValidationRuleProvider } from "../contracts/i-knowledge-validation-rule-provider.js";
import type { IKnowledgeValidationScheduler } from "../contracts/i-knowledge-validation-scheduler.js";
import type { IKnowledgeValidationStorage } from "../contracts/i-knowledge-validation-storage.js";
import type { IKnowledgeValidationStreamingProvider } from "../contracts/i-knowledge-validation-streaming-provider.js";

/**
 * "EXTENSION POINTS: Interfaces ONLY. Never implement." (docs/PROMPT-005.7M-KNOWLEDGE-
 * VALIDATOR.md) — every field is optional. `provider`/`decisionProvider` are the only
 * seams through which `start()`/`approve()`/`reject()` can ever invoke a
 * caller-supplied `IKnowledgeValidationProvider`/`IKnowledgeValidationDecisionProvider`
 * — this package registers NEITHER by default (no default "fake AI" implementation).
 * Also carries the 2 Future Readiness contracts for 005.7N/005.7O.
 */
export interface KnowledgeValidatorConfig {
  readonly provider?: IKnowledgeValidationProvider;
  readonly decisionProvider?: IKnowledgeValidationDecisionProvider;
  readonly ruleProvider?: IKnowledgeValidationRuleProvider;
  readonly policyProvider?: IKnowledgeValidationPolicyProvider;
  readonly storage?: IKnowledgeValidationStorage;
  readonly publisher?: IKnowledgeValidationPublisher;
  readonly auditProvider?: IKnowledgeValidationAuditProvider;
  readonly scheduler?: IKnowledgeValidationScheduler;
  readonly reporter?: IKnowledgeValidationReporter;
  readonly costProvider?: IKnowledgeValidationCostProvider;
  readonly streamingProvider?: IKnowledgeValidationStreamingProvider;
  readonly metricsProvider?: IKnowledgeValidationMetricsProvider;
  readonly embeddingManagerProvider?: IEmbeddingManagerValidator;
  readonly knowledgeGraphProvider?: IKnowledgeGraphValidator;
}

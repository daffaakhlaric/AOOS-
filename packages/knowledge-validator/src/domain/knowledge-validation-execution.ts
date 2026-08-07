import type { KnowledgeValidatorContext } from "../context/knowledge-validator-context.js";

import type { KnowledgeValidationAudit } from "./knowledge-validation-audit.js";
import type { KnowledgeValidationConfiguration } from "./knowledge-validation-configuration.js";
import type { KnowledgeValidationDecision } from "./knowledge-validation-decision.js";
import type { KnowledgeValidationFinding } from "./knowledge-validation-finding.js";
import type { KnowledgeValidationHistoryEntry } from "./knowledge-validation-history-entry.js";
import type { KnowledgeValidationLogEntry } from "./knowledge-validation-log-entry.js";
import type { KnowledgeValidationMetadata } from "./knowledge-validation-metadata.js";
import type { KnowledgeValidationPolicy } from "./knowledge-validation-policy.js";
import type { KnowledgeValidationReport } from "./knowledge-validation-report.js";
import type { KnowledgeValidationRequest } from "./knowledge-validation-request.js";
import type { KnowledgeValidationResultMetadata } from "./knowledge-validation-result-metadata.js";
import type { KnowledgeValidationRule } from "./knowledge-validation-rule.js";
import type { KnowledgeValidation } from "./knowledge-validation.js";

/**
 * The unit every State Machine transition / Pipeline stage reads and returns —
 * `instance` (the `KnowledgeValidation`) + `context` + `metadata` + `request`, plus
 * whatever has been resolved so far (`resolvedRules`/`policy`/`configuration`), the
 * Findings/Decision/Report/ResultMetadata recorded against this Validation, the ordered
 * `history` of every transition, and the Audit/Logging metadata the Pipeline stages
 * stamp onto it. Immutable — every stage returns an updated copy.
 */
export interface KnowledgeValidationExecution {
  readonly instance: KnowledgeValidation;
  readonly context: KnowledgeValidatorContext;
  readonly metadata: KnowledgeValidationMetadata;
  readonly request: KnowledgeValidationRequest;
  readonly resolvedRules: readonly KnowledgeValidationRule[];
  readonly policy?: KnowledgeValidationPolicy;
  readonly configuration?: KnowledgeValidationConfiguration;
  readonly findings: readonly KnowledgeValidationFinding[];
  readonly decision?: KnowledgeValidationDecision;
  readonly resultMetadata: readonly KnowledgeValidationResultMetadata[];
  readonly report?: KnowledgeValidationReport;
  readonly history: readonly KnowledgeValidationHistoryEntry[];
  readonly auditTrail: readonly KnowledgeValidationAudit[];
  readonly logs: readonly KnowledgeValidationLogEntry[];
}

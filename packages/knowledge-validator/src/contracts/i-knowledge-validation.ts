import type { KnowledgeValidatorContext } from "../context/knowledge-validator-context.js";
import type { KnowledgeValidationAudit } from "../domain/knowledge-validation-audit.js";
import type { KnowledgeValidationConfiguration } from "../domain/knowledge-validation-configuration.js";
import type { KnowledgeValidationDecision } from "../domain/knowledge-validation-decision.js";
import type { KnowledgeValidationFinding } from "../domain/knowledge-validation-finding.js";
import type { KnowledgeValidationHistoryEntry } from "../domain/knowledge-validation-history-entry.js";
import type { KnowledgeValidationLogEntry } from "../domain/knowledge-validation-log-entry.js";
import type { KnowledgeValidationMetadata } from "../domain/knowledge-validation-metadata.js";
import type { KnowledgeValidationPolicy } from "../domain/knowledge-validation-policy.js";
import type { KnowledgeValidationReport } from "../domain/knowledge-validation-report.js";
import type { KnowledgeValidationRequest } from "../domain/knowledge-validation-request.js";
import type { KnowledgeValidationResultMetadata } from "../domain/knowledge-validation-result-metadata.js";
import type { KnowledgeValidationState } from "../domain/knowledge-validation-state.js";

/**
 * "IKnowledgeValidation" — the read-only view surface `KnowledgeValidationRecord`
 * implements over one Validation's execution envelope. Named distinctly from the
 * `KnowledgeValidator` façade to avoid a same-name collision at the package barrel.
 */
export interface IKnowledgeValidation {
  readonly id: string;
  readonly token: string;
  readonly validationId: string;
  readonly state: KnowledgeValidationState;
  readonly metadata: KnowledgeValidationMetadata;
  readonly request: KnowledgeValidationRequest;
  readonly context: KnowledgeValidatorContext;
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

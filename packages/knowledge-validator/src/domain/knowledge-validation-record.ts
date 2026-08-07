import type { KnowledgeValidatorContext } from "../context/knowledge-validator-context.js";
import type { IKnowledgeValidation } from "../contracts/i-knowledge-validation.js";

import type { KnowledgeValidationAudit } from "./knowledge-validation-audit.js";
import type { KnowledgeValidationConfiguration } from "./knowledge-validation-configuration.js";
import type { KnowledgeValidationDecision } from "./knowledge-validation-decision.js";
import type { KnowledgeValidationExecution } from "./knowledge-validation-execution.js";
import type { KnowledgeValidationFinding } from "./knowledge-validation-finding.js";
import type { KnowledgeValidationHistoryEntry } from "./knowledge-validation-history-entry.js";
import type { KnowledgeValidationLogEntry } from "./knowledge-validation-log-entry.js";
import type { KnowledgeValidationMetadata } from "./knowledge-validation-metadata.js";
import type { KnowledgeValidationPolicy } from "./knowledge-validation-policy.js";
import type { KnowledgeValidationReport } from "./knowledge-validation-report.js";
import type { KnowledgeValidationRequest } from "./knowledge-validation-request.js";
import type { KnowledgeValidationResultMetadata } from "./knowledge-validation-result-metadata.js";
import type { KnowledgeValidationState } from "./knowledge-validation-state.js";

/**
 * "KnowledgeValidationRecord" — the concrete, read-only view over one Validation's
 * `KnowledgeValidationExecution`. Every operation that hands a Validation back to a
 * caller returns one of these rather than the raw execution envelope. Named distinctly
 * from the `KnowledgeValidator` façade (`validation/knowledge-validator.ts`, the
 * "Public API" name) to avoid a same-name collision at the package barrel — matching
 * the `KnowledgeQuality`/`KnowledgeQualityAssessmentRecord` convention.
 */
export class KnowledgeValidationRecord implements IKnowledgeValidation {
  constructor(private readonly execution: KnowledgeValidationExecution) {}

  get id(): string {
    return this.execution.instance.id;
  }

  get token(): string {
    return this.execution.instance.token;
  }

  get validationId(): string {
    return this.execution.instance.validationId;
  }

  get state(): KnowledgeValidationState {
    return this.execution.instance.state;
  }

  get metadata(): KnowledgeValidationMetadata {
    return this.execution.metadata;
  }

  get request(): KnowledgeValidationRequest {
    return this.execution.request;
  }

  get context(): KnowledgeValidatorContext {
    return this.execution.context;
  }

  get policy(): KnowledgeValidationPolicy | undefined {
    return this.execution.policy;
  }

  get configuration(): KnowledgeValidationConfiguration | undefined {
    return this.execution.configuration;
  }

  get findings(): readonly KnowledgeValidationFinding[] {
    return this.execution.findings;
  }

  get decision(): KnowledgeValidationDecision | undefined {
    return this.execution.decision;
  }

  get resultMetadata(): readonly KnowledgeValidationResultMetadata[] {
    return this.execution.resultMetadata;
  }

  get report(): KnowledgeValidationReport | undefined {
    return this.execution.report;
  }

  get history(): readonly KnowledgeValidationHistoryEntry[] {
    return this.execution.history;
  }

  get auditTrail(): readonly KnowledgeValidationAudit[] {
    return this.execution.auditTrail;
  }

  get logs(): readonly KnowledgeValidationLogEntry[] {
    return this.execution.logs;
  }

  toExecution(): KnowledgeValidationExecution {
    return this.execution;
  }
}

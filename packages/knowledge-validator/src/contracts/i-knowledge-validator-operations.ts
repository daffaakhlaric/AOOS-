import type { KnowledgeValidatorContext } from "../context/knowledge-validator-context.js";
import type { KnowledgeValidationCategory } from "../domain/knowledge-validation-category.js";
import type { KnowledgeValidationDecisionValue } from "../domain/knowledge-validation-decision-value.js";
import type { KnowledgeValidationFinding } from "../domain/knowledge-validation-finding.js";
import type { KnowledgeValidationJob } from "../domain/knowledge-validation-job.js";
import type { KnowledgeValidationRecord } from "../domain/knowledge-validation-record.js";
import type { KnowledgeValidationReport } from "../domain/knowledge-validation-report.js";

/* ---- Validation Operations ---- */

export interface CreateValidationInput {
  readonly context: KnowledgeValidatorContext;
  readonly title: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly category: KnowledgeValidationCategory;
  readonly targetReference: string;
  readonly ruleIds?: readonly string[];
  readonly policyId?: string;
  readonly configurationId?: string;
  readonly requestedBy: string;
  readonly instructions?: string;
}

export interface ValidationTokenInput {
  readonly token: string;
  readonly reason?: string;
}

export interface DecisionInput {
  readonly value: KnowledgeValidationDecisionValue;
  readonly reportedBy: string;
  readonly confidence?: number;
  readonly reason?: string;
}

export interface ApproveValidationInput {
  readonly token: string;
  readonly decision: DecisionInput;
}

export interface RejectValidationInput {
  readonly token: string;
  readonly decision: DecisionInput;
}

/* ---- Session Operations ---- */

export interface OpenValidatorSessionInput {
  readonly token: string;
  readonly holder: string;
  readonly ttlMs?: number;
}

export interface ValidatorSessionTokenInput {
  readonly token: string;
  readonly ttlMs?: number;
}

/* ---- Job Operations ---- */

export interface CreateValidationJobInput {
  readonly validationId: string;
  readonly tenantId: string;
  readonly priority?: number;
  readonly scheduledAt?: string;
}

export interface CreateValidationJobResult {
  readonly job: KnowledgeValidationJob;
}

export interface ValidationJobTokenInput {
  readonly jobId: string;
}

export interface FailValidationJobInput {
  readonly jobId: string;
  readonly reason: string;
}

/* ---- Finding Operations ---- */

export interface RecordFindingInput {
  readonly token: string;
  readonly category: KnowledgeValidationFinding["category"];
  readonly severity: KnowledgeValidationFinding["severity"];
  readonly description: string;
  readonly locationReference?: string;
  readonly ruleId?: string;
}

/* ---- Report Operations ---- */

export interface GenerateReportInput {
  readonly token: string;
  readonly summary?: string;
}

export interface GenerateReportResult {
  readonly report: KnowledgeValidationReport;
}

/* ---- Read Operations ---- */

export interface ListValidationsResult {
  readonly validations: readonly KnowledgeValidationRecord[];
}

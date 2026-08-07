import type { KnowledgeQualityContext } from "../context/knowledge-quality-context.js";
import type { KnowledgeQualityAssessmentJob } from "../domain/knowledge-quality-assessment-job.js";
import type { KnowledgeQualityAssessmentMode } from "../domain/knowledge-quality-assessment-mode.js";
import type { KnowledgeQualityAssessmentRecord } from "../domain/knowledge-quality-assessment-record.js";
import type { KnowledgeQualityFinding } from "../domain/knowledge-quality-finding.js";
import type { KnowledgeQualityReport } from "../domain/knowledge-quality-report.js";

/* ---- Assessment Operations ---- */

export interface CreateAssessmentInput {
  readonly context: KnowledgeQualityContext;
  readonly title: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly mode: KnowledgeQualityAssessmentMode;
  readonly targetReference: string;
  readonly ruleIds?: readonly string[];
  readonly profileId?: string;
  readonly policyId?: string;
  readonly configurationId?: string;
  readonly requestedBy: string;
  readonly instructions?: string;
}

export interface AssessmentTokenInput {
  readonly token: string;
  readonly reason?: string;
}

export interface FailAssessmentInput {
  readonly token: string;
  readonly reason: string;
}

export interface CompleteAssessmentInput {
  readonly token: string;
  readonly reason?: string;
}

/* ---- Session Operations ---- */

export interface OpenQualitySessionInput {
  readonly token: string;
  readonly holder: string;
  readonly ttlMs?: number;
}

export interface QualitySessionTokenInput {
  readonly token: string;
  readonly ttlMs?: number;
}

/* ---- Job Operations ---- */

export interface CreateAssessmentJobInput {
  readonly assessmentId: string;
  readonly tenantId: string;
  readonly priority?: number;
  readonly scheduledAt?: string;
}

export interface CreateAssessmentJobResult {
  readonly job: KnowledgeQualityAssessmentJob;
}

export interface AssessmentJobTokenInput {
  readonly jobId: string;
}

export interface FailAssessmentJobInput {
  readonly jobId: string;
  readonly reason: string;
}

/* ---- Finding Operations ---- */

export interface RecordFindingInput {
  readonly token: string;
  readonly dimension: KnowledgeQualityFinding["dimension"];
  readonly severity: KnowledgeQualityFinding["severity"];
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
  readonly report: KnowledgeQualityReport;
}

/* ---- Read Operations ---- */

export interface ListAssessmentsResult {
  readonly assessments: readonly KnowledgeQualityAssessmentRecord[];
}

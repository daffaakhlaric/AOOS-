import type { KnowledgeQualityContext } from "../context/knowledge-quality-context.js";
import type { KnowledgeQualityAssessmentAudit } from "../domain/knowledge-quality-assessment-audit.js";
import type { KnowledgeQualityAssessmentHistoryEntry } from "../domain/knowledge-quality-assessment-history-entry.js";
import type { KnowledgeQualityAssessmentLogEntry } from "../domain/knowledge-quality-assessment-log-entry.js";
import type { KnowledgeQualityAssessmentMetadata } from "../domain/knowledge-quality-assessment-metadata.js";
import type { KnowledgeQualityAssessmentRequest } from "../domain/knowledge-quality-assessment-request.js";
import type { KnowledgeQualityAssessmentState } from "../domain/knowledge-quality-assessment-state.js";
import type { KnowledgeQualityConfiguration } from "../domain/knowledge-quality-configuration.js";
import type { KnowledgeQualityFinding } from "../domain/knowledge-quality-finding.js";
import type { KnowledgeQualityPolicy } from "../domain/knowledge-quality-policy.js";
import type { KnowledgeQualityProfile } from "../domain/knowledge-quality-profile.js";
import type { KnowledgeQualityReport } from "../domain/knowledge-quality-report.js";
import type { KnowledgeQualityScoreMetadata } from "../domain/knowledge-quality-score-metadata.js";

/**
 * "IKnowledgeQuality" — the read-only view surface `KnowledgeQualityAssessmentRecord`
 * implements over one Assessment's execution envelope. Named distinctly from the
 * `KnowledgeQuality` façade to avoid a same-name collision at the package barrel.
 */
export interface IKnowledgeQuality {
  readonly id: string;
  readonly token: string;
  readonly assessmentId: string;
  readonly state: KnowledgeQualityAssessmentState;
  readonly metadata: KnowledgeQualityAssessmentMetadata;
  readonly request: KnowledgeQualityAssessmentRequest;
  readonly context: KnowledgeQualityContext;
  readonly policy?: KnowledgeQualityPolicy;
  readonly profile?: KnowledgeQualityProfile;
  readonly configuration?: KnowledgeQualityConfiguration;
  readonly findings: readonly KnowledgeQualityFinding[];
  readonly scoreMetadata: readonly KnowledgeQualityScoreMetadata[];
  readonly report?: KnowledgeQualityReport;
  readonly history: readonly KnowledgeQualityAssessmentHistoryEntry[];
  readonly auditTrail: readonly KnowledgeQualityAssessmentAudit[];
  readonly logs: readonly KnowledgeQualityAssessmentLogEntry[];
}

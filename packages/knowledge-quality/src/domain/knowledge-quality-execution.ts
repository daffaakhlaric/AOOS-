import type { KnowledgeQualityContext } from "../context/knowledge-quality-context.js";

import type { KnowledgeQualityAssessmentAudit } from "./knowledge-quality-assessment-audit.js";
import type { KnowledgeQualityAssessmentHistoryEntry } from "./knowledge-quality-assessment-history-entry.js";
import type { KnowledgeQualityAssessmentLogEntry } from "./knowledge-quality-assessment-log-entry.js";
import type { KnowledgeQualityAssessmentMetadata } from "./knowledge-quality-assessment-metadata.js";
import type { KnowledgeQualityAssessmentRequest } from "./knowledge-quality-assessment-request.js";
import type { KnowledgeQualityAssessment } from "./knowledge-quality-assessment.js";
import type { KnowledgeQualityConfiguration } from "./knowledge-quality-configuration.js";
import type { KnowledgeQualityFinding } from "./knowledge-quality-finding.js";
import type { KnowledgeQualityPolicy } from "./knowledge-quality-policy.js";
import type { KnowledgeQualityProfile } from "./knowledge-quality-profile.js";
import type { KnowledgeQualityReport } from "./knowledge-quality-report.js";
import type { KnowledgeQualityRule } from "./knowledge-quality-rule.js";
import type { KnowledgeQualityScoreMetadata } from "./knowledge-quality-score-metadata.js";

/**
 * The unit every State Machine transition / Pipeline stage reads and returns —
 * `instance` (the `KnowledgeQualityAssessment`) + `context` + `metadata` + `request`,
 * plus whatever has been resolved so far (`resolvedRules`/`profile`/`policy`/
 * `configuration`), the Findings/Report/ScoreMetadata recorded against this Assessment,
 * the ordered `history` of every transition, and the Audit/Logging metadata the
 * Pipeline stages stamp onto it. Immutable — every stage returns an updated copy.
 */
export interface KnowledgeQualityExecution {
  readonly instance: KnowledgeQualityAssessment;
  readonly context: KnowledgeQualityContext;
  readonly metadata: KnowledgeQualityAssessmentMetadata;
  readonly request: KnowledgeQualityAssessmentRequest;
  readonly resolvedRules: readonly KnowledgeQualityRule[];
  readonly profile?: KnowledgeQualityProfile;
  readonly policy?: KnowledgeQualityPolicy;
  readonly configuration?: KnowledgeQualityConfiguration;
  readonly findings: readonly KnowledgeQualityFinding[];
  readonly scoreMetadata: readonly KnowledgeQualityScoreMetadata[];
  readonly report?: KnowledgeQualityReport;
  readonly history: readonly KnowledgeQualityAssessmentHistoryEntry[];
  readonly auditTrail: readonly KnowledgeQualityAssessmentAudit[];
  readonly logs: readonly KnowledgeQualityAssessmentLogEntry[];
}

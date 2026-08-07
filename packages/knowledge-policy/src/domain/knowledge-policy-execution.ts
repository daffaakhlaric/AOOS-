import type { KnowledgePolicyContext } from "../context/knowledge-policy-context.js";

import type { KnowledgePolicyAssignment } from "./knowledge-policy-assignment.js";
import type { KnowledgePolicyAuditEntry } from "./knowledge-policy-audit.js";
import type { KnowledgePolicyConfigurationRecord } from "./knowledge-policy-configuration-record.js";
import type { KnowledgePolicyInstance } from "./knowledge-policy-instance.js";
import type { KnowledgePolicyLogEntry } from "./knowledge-policy-log.js";
import type { KnowledgePolicyMetadata } from "./knowledge-policy-metadata.js";
import type { KnowledgePolicyRule } from "./knowledge-policy-rule.js";
import type { KnowledgePolicyScope } from "./knowledge-policy-scope.js";
import type { KnowledgePolicyTrace } from "./knowledge-policy-trace.js";

/**
 * The unit every State Machine transition / Pipeline stage reads and returns —
 * `instance` + `context` + `metadata` + `configuration` + the ordered `history` of every
 * transition so far, plus the Tracing/Audit/Logging metadata the Pipeline stages stamp
 * onto it. Immutable — every stage returns an updated copy.
 */
export interface KnowledgePolicyExecution {
  readonly instance: KnowledgePolicyInstance;
  readonly context: KnowledgePolicyContext;
  readonly metadata: KnowledgePolicyMetadata;
  readonly configuration: KnowledgePolicyConfigurationRecord;
  readonly rules: readonly KnowledgePolicyRule[];
  readonly scopes: readonly KnowledgePolicyScope[];
  readonly assignments: readonly KnowledgePolicyAssignment[];
  readonly history: readonly KnowledgePolicyHistoryEntry[];
  readonly trace?: KnowledgePolicyTrace;
  readonly auditTrail: readonly KnowledgePolicyAuditEntry[];
  readonly logs: readonly KnowledgePolicyLogEntry[];
}

/** One immutable entry in a Policy's transition history. */
export interface KnowledgePolicyHistoryEntry {
  readonly id: string;
  readonly sequence: number;
  readonly policyId: string;
  readonly operation: string;
  readonly fromState?: string;
  readonly toState?: string;
  readonly reason?: string;
  readonly occurredAt: string;
}

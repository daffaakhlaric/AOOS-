import type { KnowledgePolicyContext } from "../context/knowledge-policy-context.js";
import type { IKnowledgePolicy } from "../contracts/i-knowledge-policy.js";

import type { KnowledgePolicyAssignment } from "./knowledge-policy-assignment.js";
import type { KnowledgePolicyAuditEntry } from "./knowledge-policy-audit.js";
import type { KnowledgePolicyConfigurationRecord } from "./knowledge-policy-configuration-record.js";
import type {
  KnowledgePolicyExecution,
  KnowledgePolicyHistoryEntry,
} from "./knowledge-policy-execution.js";
import type { KnowledgePolicyLogEntry } from "./knowledge-policy-log.js";
import type { KnowledgePolicyMetadata } from "./knowledge-policy-metadata.js";
import type { KnowledgePolicyRule } from "./knowledge-policy-rule.js";
import type { KnowledgePolicyScope } from "./knowledge-policy-scope.js";
import type { KnowledgePolicyState } from "./knowledge-policy-state.js";
import type { KnowledgePolicyType } from "./knowledge-policy-type.js";

/**
 * "KnowledgePolicyRecord" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Domain Model") —
 * the concrete, read-only view over one policy's `KnowledgePolicyExecution`. Every
 * operation that hands a policy back to a caller returns one of these rather than the
 * raw execution envelope.
 *
 * Named distinctly from the `KnowledgePolicy` façade (`policy/knowledge-policy.ts`,
 * the "Public API" name) to avoid a same-name collision at the package barrel: the
 * Public API list names exactly one `KnowledgePolicy` (unlike `@aos/knowledge-versioning`,
 * which has both a `KnowledgeVersioning` façade AND a separately-named `KnowledgeVersion`
 * read-model), so here the façade takes the bare name and this read-only view is
 * `KnowledgePolicyRecord`.
 */
export class KnowledgePolicyRecord implements IKnowledgePolicy {
  constructor(private readonly execution: KnowledgePolicyExecution) {}

  get id(): string {
    return this.execution.instance.id;
  }

  get token(): string {
    return this.execution.instance.token;
  }

  get policyId(): string {
    return this.execution.metadata.policyId;
  }

  get policyName(): string {
    return this.execution.metadata.policyName;
  }

  get policyType(): KnowledgePolicyType {
    return this.execution.metadata.policyType;
  }

  get priority(): number {
    return this.execution.metadata.priority;
  }

  get state(): KnowledgePolicyState {
    return this.execution.instance.state;
  }

  get metadata(): KnowledgePolicyMetadata {
    return this.execution.metadata;
  }

  get configuration(): KnowledgePolicyConfigurationRecord {
    return this.execution.configuration;
  }

  get context(): KnowledgePolicyContext {
    return this.execution.context;
  }

  get rules(): readonly KnowledgePolicyRule[] {
    return this.execution.rules;
  }

  get scopes(): readonly KnowledgePolicyScope[] {
    return this.execution.scopes;
  }

  get assignments(): readonly KnowledgePolicyAssignment[] {
    return this.execution.assignments;
  }

  get history(): readonly KnowledgePolicyHistoryEntry[] {
    return this.execution.history;
  }

  get auditTrail(): readonly KnowledgePolicyAuditEntry[] {
    return this.execution.auditTrail;
  }

  get logs(): readonly KnowledgePolicyLogEntry[] {
    return this.execution.logs;
  }

  toExecution(): KnowledgePolicyExecution {
    return this.execution;
  }
}

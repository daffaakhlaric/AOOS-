/**
 * "EVENTS: PolicyCreated, PolicyValidated, PolicyActivated, PolicySuspended,
 * PolicyArchived, PolicyRestored, PolicyDestroyed, PolicyAssigned, PolicyUnassigned,
 * PolicyEvaluated." (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md) — the exact 10 events.
 */
export enum KnowledgePolicyEventType {
  POLICY_CREATED = "knowledge.policy.created",
  POLICY_VALIDATED = "knowledge.policy.validated",
  POLICY_ACTIVATED = "knowledge.policy.activated",
  POLICY_SUSPENDED = "knowledge.policy.suspended",
  POLICY_ARCHIVED = "knowledge.policy.archived",
  POLICY_RESTORED = "knowledge.policy.restored",
  POLICY_DESTROYED = "knowledge.policy.destroyed",
  POLICY_ASSIGNED = "knowledge.policy.assigned",
  POLICY_UNASSIGNED = "knowledge.policy.unassigned",
  POLICY_EVALUATED = "knowledge.policy.evaluated",
}

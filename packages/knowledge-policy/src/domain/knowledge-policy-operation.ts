/**
 * "POLICY OPERATIONS: CreatePolicy, ValidatePolicy, ActivatePolicy, SuspendPolicy,
 * ArchivePolicy, RestorePolicy, DestroyPolicy, AssignPolicy, UnassignPolicy,
 * EvaluatePolicy." (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md) — the exact 10 operations.
 */
export enum KnowledgePolicyOperation {
  CREATE_POLICY = "create_policy",
  VALIDATE_POLICY = "validate_policy",
  ACTIVATE_POLICY = "activate_policy",
  SUSPEND_POLICY = "suspend_policy",
  ARCHIVE_POLICY = "archive_policy",
  RESTORE_POLICY = "restore_policy",
  DESTROY_POLICY = "destroy_policy",
  ASSIGN_POLICY = "assign_policy",
  UNASSIGN_POLICY = "unassign_policy",
  EVALUATE_POLICY = "evaluate_policy",
}

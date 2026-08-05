/** "EVENT BUS: Publish ..." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md). */
export enum KnowledgeEventType {
  CREATED = "knowledge.created",
  UPDATED = "knowledge.updated",
  DELETED = "knowledge.deleted",
  ARCHIVED = "knowledge.archived",
  VERSION_CREATED = "knowledge.version.created",
  REVIEW_COMPLETED = "knowledge.review.completed",
  POLICY_CHANGED = "knowledge.policy.changed",
  PERMISSION_CHANGED = "knowledge.permission.changed",
  RELATIONSHIP_CREATED = "knowledge.relationship.created",
  VALIDATION_FAILED = "knowledge.validation.failed",
  HEALTH_CHANGED = "knowledge.health.changed",
}

/** "CHANGE DETECTION: Support Added, Updated, Deleted, Moved, Renamed, Metadata Changed, Permission Changed, Policy Changed, Relationship Changed, Version Changed, Template Changed, Content Hash Changed. Only metadata detection. No content parsing." (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md) */
export enum KnowledgeChangeType {
  ADDED = "added",
  UPDATED = "updated",
  DELETED = "deleted",
  MOVED = "moved",
  RENAMED = "renamed",
  METADATA_CHANGED = "metadata_changed",
  PERMISSION_CHANGED = "permission_changed",
  POLICY_CHANGED = "policy_changed",
  RELATIONSHIP_CHANGED = "relationship_changed",
  VERSION_CHANGED = "version_changed",
  TEMPLATE_CHANGED = "template_changed",
  CONTENT_HASH_CHANGED = "content_hash_changed",
}

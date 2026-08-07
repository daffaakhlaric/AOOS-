/**
 * "SCOPE TYPES: Global, Organization, Workspace, Project, Knowledge Base, Namespace,
 * Folder, Asset, Version." (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md) — the exact 9
 * scope types from the prompt.
 */
export enum KnowledgePolicyScopeType {
  GLOBAL = "global",
  ORGANIZATION = "organization",
  WORKSPACE = "workspace",
  PROJECT = "project",
  KNOWLEDGE_BASE = "knowledge_base",
  NAMESPACE = "namespace",
  FOLDER = "folder",
  ASSET = "asset",
  VERSION = "version",
}

import { z } from "zod";

import { knowledgeScopeSchema } from "./knowledge-scope.js";

/** "KnowledgeWorkspace" — one isolated Workspace within a Tenant/Organization. */
export const knowledgeWorkspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tenantId: z.string().min(1),
  organizationId: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type KnowledgeWorkspace = z.infer<typeof knowledgeWorkspaceSchema>;

/** "KnowledgeLibrary" — the narrowest named grouping in the Scope hierarchy, one level above an individual Document. */
export const knowledgeLibrarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  scope: knowledgeScopeSchema,
  createdAt: z.string().datetime(),
});

export type KnowledgeLibrary = z.infer<typeof knowledgeLibrarySchema>;

/** "KnowledgeCollection" — a named, ordered set of Asset ids (not itself a Scope level — a Collection can span multiple Libraries). */
export const knowledgeCollectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  scope: knowledgeScopeSchema,
  assetIds: z.array(z.string()),
  createdAt: z.string().datetime(),
});

export type KnowledgeCollection = z.infer<typeof knowledgeCollectionSchema>;

/** "KnowledgeFolder" — a hierarchical grouping node, optionally nested under a parent Folder, within one Collection. */
export const knowledgeFolderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  collectionId: z.string().min(1),
  parentFolderId: z.string().min(1).optional(),
  scope: knowledgeScopeSchema,
});

export type KnowledgeFolder = z.infer<typeof knowledgeFolderSchema>;

/**
 * "KNOWLEDGE NAMESPACE: knowledge://tenant/workspace/library/document. Must support
 * hierarchical namespaces." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — the parsed
 * component shape; `namespace/knowledge-namespace.ts` owns parsing/building the actual
 * `knowledge://` URI string.
 */
export const knowledgeNamespaceSchema = z.object({
  uri: z.string().min(1),
  tenant: z.string().min(1),
  workspace: z.string().min(1),
  library: z.string().min(1),
  document: z.string().min(1),
});

export type KnowledgeNamespace = z.infer<typeof knowledgeNamespaceSchema>;

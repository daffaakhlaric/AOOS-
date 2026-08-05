import type { KnowledgeNamespace } from "../domain/knowledge-collection.js";
import { InvalidNamespaceException } from "../errors/invalid-namespace-exception.js";

const NAMESPACE_SCHEME = "knowledge://";

/** Builds the canonical `knowledge://tenant/workspace/library/document` URI from its 4 hierarchical segments. */
export function buildKnowledgeNamespaceUri(
  tenant: string,
  workspace: string,
  library: string,
  document: string,
): string {
  return `${NAMESPACE_SCHEME}${tenant}/${workspace}/${library}/${document}`;
}

/**
 * "KNOWLEDGE NAMESPACE: knowledge://tenant/workspace/library/document. Must support
 * hierarchical namespaces." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — parses a
 * `knowledge://` URI into its `KnowledgeNamespace` components. Throws
 * `InvalidNamespaceException` if the scheme is wrong or any of the 4 required segments
 * is missing.
 */
export function parseKnowledgeNamespace(uri: string): KnowledgeNamespace {
  if (!uri.startsWith(NAMESPACE_SCHEME)) {
    throw new InvalidNamespaceException(
      `Knowledge namespace "${uri}" must start with "${NAMESPACE_SCHEME}"`,
    );
  }
  const segments = uri
    .slice(NAMESPACE_SCHEME.length)
    .split("/")
    .filter((segment) => segment.length > 0);
  if (segments.length !== 4) {
    throw new InvalidNamespaceException(
      `Knowledge namespace "${uri}" must have exactly 4 segments (tenant/workspace/library/document), got ${segments.length}`,
    );
  }
  const [tenant, workspace, library, document] = segments as [string, string, string, string];
  return { uri, tenant, workspace, library, document };
}

/** Returns whether `uri` parses as a valid `knowledge://` namespace, without throwing. */
export function isValidKnowledgeNamespace(uri: string): boolean {
  try {
    parseKnowledgeNamespace(uri);
    return true;
  } catch {
    return false;
  }
}

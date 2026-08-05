import type { KnowledgeAsset } from "@aos/knowledge-engine";

import type { KnowledgeIndexContext } from "../context/knowledge-index-context.js";

/** The extension point `PolicyStage`/`PermissionStage` call; a future package can supply a real implementation (e.g. wrapping `@aos/knowledge-engine`'s `KnowledgePolicyEngine`/`KnowledgePermissionEngine`) without this package changing. */
export interface IKnowledgeIndexChecker {
  check(asset: KnowledgeAsset, context: KnowledgeIndexContext): boolean | Promise<boolean>;
}

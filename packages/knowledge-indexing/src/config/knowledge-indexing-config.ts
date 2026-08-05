import type { IKnowledgeIndexOptimizer } from "../contracts/i-knowledge-index-optimizer.js";
import type { KnowledgeIndexType } from "../domain/knowledge-index-type.js";
import type { IKnowledgeIndexChecker } from "../pipeline/i-index-checker.js";

export interface KnowledgeIndexingConfig {
  readonly indexTypes?: readonly KnowledgeIndexType[];
  readonly permissionChecker?: IKnowledgeIndexChecker;
  readonly policyChecker?: IKnowledgeIndexChecker;
  readonly optimizerProvider?: IKnowledgeIndexOptimizer;
}

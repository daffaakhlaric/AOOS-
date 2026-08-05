import type { KnowledgeSourceContext } from "../context/knowledge-source-context.js";
import type { KnowledgeSourceMetadataRecord } from "../domain/knowledge-source-metadata-record.js";

/** Interface-only shape a caller may implement to plug in an alternate Permission evaluator alongside/instead of `KnowledgeSourcePermission`. */
export interface IKnowledgeSourcePermission {
  check(context: KnowledgeSourceContext, metadata?: KnowledgeSourceMetadataRecord): boolean;
}

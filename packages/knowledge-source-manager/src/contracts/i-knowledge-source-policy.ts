import type { KnowledgeSourceContext } from "../context/knowledge-source-context.js";
import type { KnowledgeSourceMetadataRecord } from "../domain/knowledge-source-metadata-record.js";
import type { KnowledgeSourcePolicyViolation } from "../policy/knowledge-source-policy-record.js";

/** Interface-only shape a caller may implement to plug in an alternate Policy evaluator alongside/instead of `KnowledgeSourcePolicy`. */
export interface IKnowledgeSourcePolicy {
  evaluate(
    metadata: KnowledgeSourceMetadataRecord,
    context: KnowledgeSourceContext,
  ): readonly KnowledgeSourcePolicyViolation[];
}

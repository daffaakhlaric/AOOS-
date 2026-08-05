import type { KnowledgeSourceContext } from "../context/knowledge-source-context.js";
import type { KnowledgeSourceMetadataRecord } from "../domain/knowledge-source-metadata-record.js";

/** Interface only — no implementation in this package. A caller-supplied hook invoked before/after `KnowledgeSourcePipeline` runs for a Source. */
export interface IKnowledgeSourceHook {
  beforeRun?(
    metadata: KnowledgeSourceMetadataRecord,
    context: KnowledgeSourceContext,
  ): void | Promise<void>;
  afterRun?(
    metadata: KnowledgeSourceMetadataRecord,
    context: KnowledgeSourceContext,
  ): void | Promise<void>;
}

import type { KnowledgeSourceContext } from "../context/knowledge-source-context.js";
import type { KnowledgeSourceMetadataRecord } from "../domain/knowledge-source-metadata-record.js";

/** Interface-only shape of `KnowledgeSourceFactory` — lets a caller supply an alternate factory implementation. */
export interface IKnowledgeSourceFactory {
  metadata: {
    create(input: Readonly<Record<string, unknown>>): KnowledgeSourceMetadataRecord;
  };
  context: {
    create(input: Readonly<Record<string, unknown>>): KnowledgeSourceContext;
  };
}

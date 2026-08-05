import type { KnowledgeSourceCategory } from "../domain/knowledge-source-category.js";
import type { KnowledgeSourceMetadataRecord } from "../domain/knowledge-source-metadata-record.js";

/**
 * Interface only — no implementation in this package beyond the concrete
 * `KnowledgeSource` view class. The minimal read-only shape any "live configured
 * Source" object must satisfy — lets a caller pass a custom Source representation
 * anywhere this package expects one, without depending on `KnowledgeSource` itself.
 */
export interface IKnowledgeSource {
  readonly id: string;
  readonly category: KnowledgeSourceCategory;
  readonly providerId: string;
  readonly metadata: KnowledgeSourceMetadataRecord;
}

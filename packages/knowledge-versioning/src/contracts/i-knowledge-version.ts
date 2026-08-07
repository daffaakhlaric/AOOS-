import type { KnowledgeVersionMetadata } from "../domain/knowledge-version-metadata.js";
import type { KnowledgeVersionState } from "../domain/knowledge-version-state.js";
import type { KnowledgeVersionType } from "../domain/knowledge-version-type.js";

/**
 * Interface only — no implementation in this package beyond the concrete
 * `KnowledgeVersion` view class. The minimal read-only shape any "live version" object
 * must satisfy — lets a caller pass a custom version representation anywhere this
 * package expects one, without depending on `KnowledgeVersion` itself.
 */
export interface IKnowledgeVersion {
  readonly id: string;
  readonly token: string;
  readonly versionId: string;
  readonly assetId: string;
  readonly versionType: KnowledgeVersionType;
  readonly versionNumber: string;
  readonly state: KnowledgeVersionState;
  readonly metadata: KnowledgeVersionMetadata;
}

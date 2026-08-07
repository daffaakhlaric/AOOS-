import type { KnowledgeVersionMetadata } from "../domain/knowledge-version-metadata.js";

export interface UpdateKnowledgeVersionMetadataInput {
  readonly versionName?: string;
  readonly versionDescription?: string;
  readonly labels?: readonly string[];
  readonly tags?: readonly string[];
  readonly dependencies?: readonly string[];
  readonly updatedBy?: string;
}

/** Produces an updated copy of a `KnowledgeVersionMetadata` record with `updatedAt` stamped to now. */
export class KnowledgeVersionMetadataFactory {
  update(
    metadata: KnowledgeVersionMetadata,
    input: UpdateKnowledgeVersionMetadataInput,
  ): KnowledgeVersionMetadata {
    return {
      ...metadata,
      versionName: input.versionName ?? metadata.versionName,
      versionDescription: input.versionDescription ?? metadata.versionDescription,
      labels: input.labels ? [...input.labels] : metadata.labels,
      tags: input.tags ? [...input.tags] : metadata.tags,
      dependencies: input.dependencies ? [...input.dependencies] : metadata.dependencies,
      updatedBy: input.updatedBy ?? metadata.updatedBy,
      updatedAt: new Date().toISOString(),
    };
  }
}

import type { KnowledgePolicyConfigurationRecord } from "../domain/knowledge-policy-configuration-record.js";
import type { KnowledgePolicyMetadata } from "../domain/knowledge-policy-metadata.js";

/** One entry in the POLICY registry bucket. */
export interface PolicyRegistryEntry {
  readonly id: string;
  readonly token: string;
  readonly metadata: KnowledgePolicyMetadata;
  readonly configuration: KnowledgePolicyConfigurationRecord;
}

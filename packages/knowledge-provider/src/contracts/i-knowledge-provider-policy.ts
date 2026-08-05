import type { ProviderMetadataRecord } from "../domain/provider-metadata-record.js";

/** Interface only — no implementation in this package. An external pluggable Policy checker `KnowledgeProviderPolicy` may delegate to. */
export interface IKnowledgeProviderPolicy {
  readonly id: string;
  evaluate(metadata: ProviderMetadataRecord): boolean;
}

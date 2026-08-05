import type { KnowledgeProviderCapabilityFlag } from "../domain/knowledge-provider-capability-flag.js";

/** Interface only — no implementation in this package. A pluggable Capability descriptor an external Provider package may register alongside the 20 built-in flags. */
export interface IKnowledgeProviderCapability {
  readonly flag: KnowledgeProviderCapabilityFlag;
  readonly description?: string;
}

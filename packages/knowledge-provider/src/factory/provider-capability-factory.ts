import { KnowledgeProviderCapabilities } from "../capabilities/knowledge-provider-capabilities.js";
import type { KnowledgeProviderCapabilityFlag } from "../domain/knowledge-provider-capability-flag.js";

/** Builds a fresh `KnowledgeProviderCapabilities` wrapper from a list of flags. */
export class ProviderCapabilityFactory {
  create(flags: readonly KnowledgeProviderCapabilityFlag[]): KnowledgeProviderCapabilities {
    return new KnowledgeProviderCapabilities(flags);
  }
}

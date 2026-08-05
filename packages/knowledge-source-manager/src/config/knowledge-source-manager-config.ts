import type { IKnowledgeSourceProviderResolver } from "../contracts/i-knowledge-source-provider-resolver.js";

export interface KnowledgeSourceManagerConfig {
  readonly providerResolver?: IKnowledgeSourceProviderResolver;
}

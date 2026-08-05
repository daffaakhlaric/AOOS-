import type { IKnowledgeProvider } from "./i-knowledge-provider.js";

/** Interface only — no implementation in this package. An external pluggable resolution backend `KnowledgeProviderResolver` may delegate to. */
export interface IKnowledgeProviderResolver {
  resolve(query: Readonly<Record<string, unknown>>): readonly IKnowledgeProvider[];
}

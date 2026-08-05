import type { IKnowledgeProvider } from "./i-knowledge-provider.js";

/** Interface only — no implementation in this package. An external pluggable factory backend `KnowledgeProviderFactory` may delegate Provider construction to. */
export interface IKnowledgeProviderFactory {
  create(input: Readonly<Record<string, unknown>>): IKnowledgeProvider;
}

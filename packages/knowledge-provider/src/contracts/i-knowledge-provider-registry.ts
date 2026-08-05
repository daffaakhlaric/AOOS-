import type { IKnowledgeProvider } from "./i-knowledge-provider.js";

/** Interface only — no implementation in this package. An external pluggable registry backend (e.g. a distributed Provider catalog) — the concrete `KnowledgeProviderRegistry` always keeps its own in-memory store regardless of whether one is configured. */
export interface IKnowledgeProviderRegistry {
  register(provider: IKnowledgeProvider): void | Promise<void>;
  get(id: string): IKnowledgeProvider | undefined | Promise<IKnowledgeProvider | undefined>;
}

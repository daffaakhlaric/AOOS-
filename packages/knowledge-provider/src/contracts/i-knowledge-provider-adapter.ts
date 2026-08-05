import type { KnowledgeProviderContext } from "../context/knowledge-provider-context.js";

/** Interface only — no implementation in this package. Adapts a raw external system response into the metadata-driven shape this package understands — no connector/API-client logic lives here. */
export interface IKnowledgeProviderAdapter {
  readonly id: string;
  adapt(context: KnowledgeProviderContext, input: unknown): unknown;
}

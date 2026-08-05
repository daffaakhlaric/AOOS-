import type { KnowledgeProviderContext } from "../context/knowledge-provider-context.js";
import type { KnowledgeProviderCapabilityFlag } from "../domain/knowledge-provider-capability-flag.js";
import type { KnowledgeProviderCategory } from "../domain/knowledge-provider-category.js";

/**
 * Interface only — no implementation in this package. The connector contract every
 * external system (Google Drive, Notion, GitHub, a database, ...) implements and
 * registers into `KnowledgeProviderRegistry`. "Knowledge Engine must never know Google
 * Drive ... Every external system must implement a Knowledge Provider."
 */
export interface IKnowledgeProvider {
  readonly id: string;
  readonly category: KnowledgeProviderCategory;
  readonly capabilities: readonly KnowledgeProviderCapabilityFlag[];
  connect?(context: KnowledgeProviderContext): boolean | Promise<boolean>;
  disconnect?(context: KnowledgeProviderContext): void | Promise<void>;
}

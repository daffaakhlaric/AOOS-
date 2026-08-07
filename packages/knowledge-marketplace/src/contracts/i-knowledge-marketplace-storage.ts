import type { KnowledgeMarketplaceExecution } from "../domain/knowledge-marketplace-execution.js";

/** Extension Point — interface only, no implementation in this package. */
export interface IKnowledgeMarketplaceStorage {
  load(listingId: string): Promise<KnowledgeMarketplaceExecution | undefined>;
  save(execution: KnowledgeMarketplaceExecution): Promise<void>;
  delete(listingId: string): Promise<void>;
}

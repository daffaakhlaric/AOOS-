import type { KnowledgeSynchronizationContext } from "../context/knowledge-synchronization-context.js";
import type { KnowledgeSynchronizationProviderType } from "../domain/knowledge-synchronization-provider-type.js";

/**
 * Interface only — no implementation in this package. "PROVIDER RESOLVER: Resolve
 * providers only. No provider implementation." A future Provider (Document/Storage/
 * Repository/CMS/Database/API/File System/Knowledge Service — see
 * `KnowledgeSynchronizationProviderType`) supplies this contract; `optional
 * validateConnection()` backs the Pipeline's Connection Validation stage, permissive
 * when absent.
 */
export interface IKnowledgeSynchronizationProvider {
  readonly id: string;
  readonly providerType: KnowledgeSynchronizationProviderType;
  validateConnection?(context: KnowledgeSynchronizationContext): boolean | Promise<boolean>;
}

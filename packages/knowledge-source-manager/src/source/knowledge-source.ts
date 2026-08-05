import type { KnowledgeSourceConfigurationRecord } from "../configuration/knowledge-source-configuration-record.js";
import type { KnowledgeSourceContext } from "../context/knowledge-source-context.js";
import type { IKnowledgeSource } from "../contracts/i-knowledge-source.js";
import type { KnowledgeSourceCategory } from "../domain/knowledge-source-category.js";
import type { KnowledgeSourceExecution } from "../domain/knowledge-source-execution.js";
import type { KnowledgeSourceHistory } from "../domain/knowledge-source-history.js";
import type { KnowledgeSourceMetadataRecord } from "../domain/knowledge-source-metadata-record.js";
import type { KnowledgeSourceState } from "../domain/knowledge-source-state.js";

/**
 * "KnowledgeSource" (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md — "PUBLIC API") — the
 * concrete, read-only view over one configured Source's `KnowledgeSourceExecution`.
 * Distinct from `KnowledgeSourceManager` (the orchestrating façade — see the prompt's
 * Public API list, which names both). Every `KnowledgeSourceManager` operation that
 * hands a Source back to a caller returns one of these rather than the raw
 * `KnowledgeSourceExecution` envelope.
 */
export class KnowledgeSource implements IKnowledgeSource {
  constructor(private readonly execution: KnowledgeSourceExecution) {}

  get id(): string {
    return this.execution.instance.id;
  }

  get token(): string {
    return this.execution.instance.token;
  }

  get sourceId(): string {
    return this.execution.metadata.sourceId;
  }

  get category(): KnowledgeSourceCategory {
    return this.execution.metadata.sourceCategory;
  }

  get providerId(): string {
    return this.execution.metadata.providerId;
  }

  get state(): KnowledgeSourceState {
    return this.execution.instance.state;
  }

  get metadata(): KnowledgeSourceMetadataRecord {
    return this.execution.metadata;
  }

  get configuration(): KnowledgeSourceConfigurationRecord {
    return this.execution.configuration;
  }

  get context(): KnowledgeSourceContext {
    return this.execution.context;
  }

  get history(): KnowledgeSourceHistory {
    return this.execution.history;
  }

  toExecution(): KnowledgeSourceExecution {
    return this.execution;
  }
}

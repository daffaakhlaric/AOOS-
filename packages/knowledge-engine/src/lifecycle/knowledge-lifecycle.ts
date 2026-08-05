import type { KnowledgeAsset } from "../domain/knowledge-asset.js";
import {
  KNOWLEDGE_LIFECYCLE_TRANSITIONS,
  type KnowledgeLifecycleState,
} from "../domain/knowledge-lifecycle-state.js";
import { IllegalLifecycleTransitionException } from "../errors/illegal-lifecycle-transition-exception.js";

export interface KnowledgeLifecycleTransitionInput {
  readonly asset: KnowledgeAsset;
  readonly to: KnowledgeLifecycleState;
  readonly reason?: string;
}

/**
 * "KNOWLEDGE LIFECYCLE" (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — the only code allowed
 * to change a `KnowledgeAsset`'s `lifecycleState`. Every transition not present in
 * `KNOWLEDGE_LIFECYCLE_TRANSITIONS` throws `IllegalLifecycleTransitionException`.
 */
export class KnowledgeLifecycle {
  canTransition(from: KnowledgeLifecycleState, to: KnowledgeLifecycleState): boolean {
    return KNOWLEDGE_LIFECYCLE_TRANSITIONS[from].includes(to);
  }

  transition(input: KnowledgeLifecycleTransitionInput): KnowledgeAsset {
    const from = input.asset.lifecycleState;
    if (!this.canTransition(from, input.to)) {
      throw new IllegalLifecycleTransitionException(
        `Illegal Knowledge Lifecycle transition for "${input.asset.id}": "${from}" -> "${input.to}"`,
      );
    }
    return { ...input.asset, lifecycleState: input.to, updatedAt: new Date().toISOString() };
  }
}

import type { KnowledgeUpdateResult } from "../entities/knowledge-update-result.js";
import type { KnowledgeUpdateTask } from "../entities/knowledge-update-task.js";
import type { KnowledgeUpdateType } from "../types/update-type.js";

export interface StrategyExecutionContext {
  readonly task: KnowledgeUpdateTask;
  readonly now: number;
}

/**
 * Strategy-pattern interface: one implementation per `KnowledgeUpdateType` (or a small shared
 * family — see concrete classes). The pipeline's Execute Update stage dispatches to a resolved
 * strategy object rather than branching on an if/else chain.
 */
export interface IKnowledgeUpdateStrategy {
  readonly updateType: KnowledgeUpdateType;
  execute(context: StrategyExecutionContext): KnowledgeUpdateResult;
}

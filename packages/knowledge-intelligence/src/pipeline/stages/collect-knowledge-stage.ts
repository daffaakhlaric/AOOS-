import { InvalidKnowledgeItemException } from "../../errors/invalid-knowledge-item-exception.js";
import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/** Stage 1: validates the collected item set (non-empty, unique ids) before analysis begins. */
export class CollectKnowledgeStage implements PipelineStage {
  readonly name = "collect-knowledge";

  execute(context: PipelineContext): PipelineContext {
    const seen = new Set<string>();
    for (const item of context.items) {
      if (item.id.trim().length === 0) {
        throw new InvalidKnowledgeItemException(item.id, "id must not be empty");
      }
      if (seen.has(item.id)) {
        throw new InvalidKnowledgeItemException(item.id, "duplicate item id in collected set");
      }
      seen.add(item.id);
    }
    return context;
  }
}

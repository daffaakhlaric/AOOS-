import type { RecommendationType } from "../types/recommendation-type.js";

export interface KnowledgeRecommendationProps {
  readonly id: string;
  readonly type: RecommendationType;
  readonly itemIds: readonly string[];
  readonly reason: string;
  readonly priority: number;
  readonly createdAt: number;
}

/** Immutable actionable recommendation about one or more knowledge items. */
export class KnowledgeRecommendation {
  readonly id: string;
  readonly type: RecommendationType;
  readonly itemIds: readonly string[];
  readonly reason: string;
  readonly priority: number;
  readonly createdAt: number;

  constructor(props: KnowledgeRecommendationProps) {
    if (props.itemIds.length === 0) {
      throw new RangeError("KnowledgeRecommendation: itemIds must not be empty");
    }
    if (props.priority < 0 || props.priority > 100) {
      throw new RangeError("KnowledgeRecommendation: priority must be within [0, 100]");
    }
    this.id = props.id;
    this.type = props.type;
    this.itemIds = props.itemIds;
    this.reason = props.reason;
    this.priority = props.priority;
    this.createdAt = props.createdAt;
    Object.freeze(this);
    Object.freeze(this.itemIds);
  }
}

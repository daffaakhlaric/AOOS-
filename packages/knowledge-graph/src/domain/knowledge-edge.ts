import type { KnowledgeEdgeType } from "./knowledge-edge-type.js";

/** A single directed, typed relationship in a `KnowledgeGraph` connecting two `KnowledgeNode`s. */
export interface KnowledgeEdge {
  readonly id: string;
  readonly type: KnowledgeEdgeType;
  /** Required and only meaningful when `type === KnowledgeEdgeType.Custom`. */
  readonly customTypeLabel?: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly weight: number;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Fields a caller supplies to create a `KnowledgeEdge`; identity/timestamps are assigned by the factory. */
export interface CreateKnowledgeEdgeInput {
  readonly id?: string;
  readonly type: KnowledgeEdgeType;
  readonly customTypeLabel?: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly weight?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Fields a caller may mutate on an existing `KnowledgeEdge` via Update Edge. */
export interface UpdateKnowledgeEdgeInput {
  readonly weight?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

import type { KnowledgeNodeType } from "./knowledge-node-type.js";

/** A single vertex in a `KnowledgeGraph` — any addressable entity in the AOS platform. */
export interface KnowledgeNode {
  readonly id: string;
  readonly type: KnowledgeNodeType;
  /** Required and only meaningful when `type === KnowledgeNodeType.Custom`. */
  readonly customTypeLabel?: string;
  readonly label: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Fields a caller supplies to create a `KnowledgeNode`; identity/timestamps are assigned by the factory. */
export interface CreateKnowledgeNodeInput {
  readonly id?: string;
  readonly type: KnowledgeNodeType;
  readonly customTypeLabel?: string;
  readonly label: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Fields a caller may mutate on an existing `KnowledgeNode` via Update Node. */
export interface UpdateKnowledgeNodeInput {
  readonly label?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

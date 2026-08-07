/**
 * The 20 catalogued Knowledge Edge types. `Custom` is the escape hatch for relationship kinds
 * outside this catalogue — callers using `Custom` MUST supply `customTypeLabel` on the edge.
 */
export enum KnowledgeEdgeType {
  DependsOn = "DependsOn",
  Uses = "Uses",
  Calls = "Calls",
  References = "References",
  Generates = "Generates",
  Consumes = "Consumes",
  Owns = "Owns",
  Contains = "Contains",
  Extends = "Extends",
  Implements = "Implements",
  RelatedTo = "RelatedTo",
  ChildOf = "ChildOf",
  ParentOf = "ParentOf",
  DuplicateOf = "DuplicateOf",
  DerivedFrom = "DerivedFrom",
  VersionOf = "VersionOf",
  BelongsTo = "BelongsTo",
  AssignedTo = "AssignedTo",
  ManagedBy = "ManagedBy",
  Custom = "Custom",
}

const KNOWLEDGE_EDGE_TYPE_VALUES: ReadonlySet<string> = new Set(Object.values(KnowledgeEdgeType));

/** Type guard: is `value` one of the 20 `KnowledgeEdgeType` enum members? */
export function isKnowledgeEdgeType(value: unknown): value is KnowledgeEdgeType {
  return typeof value === "string" && KNOWLEDGE_EDGE_TYPE_VALUES.has(value);
}

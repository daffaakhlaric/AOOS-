/**
 * The 18 catalogued Knowledge Node types. `Custom` is the escape hatch for entity kinds outside
 * this catalogue — callers using `Custom` MUST supply `customTypeLabel` on the node.
 */
export enum KnowledgeNodeType {
  Knowledge = "Knowledge",
  Document = "Document",
  Chunk = "Chunk",
  Embedding = "Embedding",
  Memory = "Memory",
  Prompt = "Prompt",
  Agent = "Agent",
  Workflow = "Workflow",
  Capability = "Capability",
  Tool = "Tool",
  Connector = "Connector",
  Organization = "Organization",
  Department = "Department",
  Role = "Role",
  Employee = "Employee",
  BusinessProcess = "BusinessProcess",
  SolutionPack = "SolutionPack",
  Custom = "Custom",
}

const KNOWLEDGE_NODE_TYPE_VALUES: ReadonlySet<string> = new Set(Object.values(KnowledgeNodeType));

/** Type guard: is `value` one of the 18 `KnowledgeNodeType` enum members? */
export function isKnowledgeNodeType(value: unknown): value is KnowledgeNodeType {
  return typeof value === "string" && KNOWLEDGE_NODE_TYPE_VALUES.has(value);
}

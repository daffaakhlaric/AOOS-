/** Groups every `NodeType` (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md — "NODE CATEGORIES") — used by metrics/health breakdowns and by `NodeManifest.category`. */
export enum NodeCategory {
  FLOW = "flow",
  HUMAN = "human",
  AI = "ai",
  AI_NATIVE = "ai_native",
  CAPABILITY = "capability",
  KNOWLEDGE = "knowledge",
  MEMORY = "memory",
}

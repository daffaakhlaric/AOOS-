import { NodeCategory } from "./node-category.js";

/**
 * Every Node Type this Runtime manages — the 24 "Flow Nodes" from
 * docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md's "NODE CATEGORIES" section, plus the 11
 * AI-native types requested in the same prompt's additional-improvements section
 * (`contracts/ai-native/`). `Script` is explicitly "interface only" — no concrete
 * `NodeManifest` schema is ever executed for it, only its manifest shape exists.
 */
export enum NodeType {
  START = "start",
  END = "end",
  CONDITION = "condition",
  SWITCH = "switch",
  MERGE = "merge",
  FORK = "fork",
  JOIN = "join",
  LOOP = "loop",
  DELAY = "delay",
  TIMER = "timer",
  WAIT = "wait",
  EVENT = "event",
  HUMAN = "human",
  AI = "ai",
  CAPABILITY = "capability",
  KNOWLEDGE = "knowledge",
  MEMORY = "memory",
  WEBHOOK = "webhook",
  HTTP = "http",
  TRANSFORM = "transform",
  VARIABLE = "variable",
  EXPRESSION = "expression",
  SCRIPT = "script",
  CUSTOM = "custom",

  // AI-native (user's additional-improvements request — contracts only, no execution).
  AI_PLANNER = "ai_planner",
  AI_REASON = "ai_reason",
  AI_REFLECTION = "ai_reflection",
  AI_CRITIC = "ai_critic",
  AI_DEBATE = "ai_debate",
  AI_VOTING = "ai_voting",
  AI_CONSENSUS = "ai_consensus",
  AI_SIMULATION = "ai_simulation",
  PROMPT = "prompt",
  KNOWLEDGE_SEARCH = "knowledge_search",
  HUMAN_APPROVAL = "human_approval",
}

/** `NodeType` → `NodeCategory` — the authoritative mapping `contracts/node-manifest.ts`'s built-in manifests are checked against. */
export const NODE_TYPE_CATEGORY: Readonly<Record<NodeType, NodeCategory>> = {
  [NodeType.START]: NodeCategory.FLOW,
  [NodeType.END]: NodeCategory.FLOW,
  [NodeType.CONDITION]: NodeCategory.FLOW,
  [NodeType.SWITCH]: NodeCategory.FLOW,
  [NodeType.MERGE]: NodeCategory.FLOW,
  [NodeType.FORK]: NodeCategory.FLOW,
  [NodeType.JOIN]: NodeCategory.FLOW,
  [NodeType.LOOP]: NodeCategory.FLOW,
  [NodeType.DELAY]: NodeCategory.FLOW,
  [NodeType.TIMER]: NodeCategory.FLOW,
  [NodeType.WAIT]: NodeCategory.FLOW,
  [NodeType.EVENT]: NodeCategory.FLOW,
  [NodeType.WEBHOOK]: NodeCategory.FLOW,
  [NodeType.HTTP]: NodeCategory.FLOW,
  [NodeType.TRANSFORM]: NodeCategory.FLOW,
  [NodeType.VARIABLE]: NodeCategory.FLOW,
  [NodeType.EXPRESSION]: NodeCategory.FLOW,
  [NodeType.SCRIPT]: NodeCategory.FLOW,
  [NodeType.CUSTOM]: NodeCategory.FLOW,

  [NodeType.HUMAN]: NodeCategory.HUMAN,
  [NodeType.HUMAN_APPROVAL]: NodeCategory.HUMAN,

  [NodeType.AI]: NodeCategory.AI,
  [NodeType.PROMPT]: NodeCategory.AI,

  [NodeType.AI_PLANNER]: NodeCategory.AI_NATIVE,
  [NodeType.AI_REASON]: NodeCategory.AI_NATIVE,
  [NodeType.AI_REFLECTION]: NodeCategory.AI_NATIVE,
  [NodeType.AI_CRITIC]: NodeCategory.AI_NATIVE,
  [NodeType.AI_DEBATE]: NodeCategory.AI_NATIVE,
  [NodeType.AI_VOTING]: NodeCategory.AI_NATIVE,
  [NodeType.AI_CONSENSUS]: NodeCategory.AI_NATIVE,
  [NodeType.AI_SIMULATION]: NodeCategory.AI_NATIVE,

  [NodeType.CAPABILITY]: NodeCategory.CAPABILITY,

  [NodeType.KNOWLEDGE]: NodeCategory.KNOWLEDGE,
  [NodeType.KNOWLEDGE_SEARCH]: NodeCategory.KNOWLEDGE,

  [NodeType.MEMORY]: NodeCategory.MEMORY,
};

import { z } from "zod";

import { NodeCategory } from "./node-category.js";
import type { NodeManifest } from "./node-manifest.js";
import { NodeType } from "./node-type.js";

function manifest(
  type: NodeType,
  name: string,
  description: string,
  configSchema?: z.ZodTypeAny,
): NodeManifest {
  return { type, category: NodeCategory.FLOW, name, description, version: "1.0.0", configSchema };
}

/**
 * The 23 "Flow Nodes" built-in manifests (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md —
 * "NODE CATEGORIES"), minus Capability (its own manifest lives in
 * `contracts/ai-native/capability-node.ts` per the user's request to re-specify it as a
 * standalone contract). `Script` is registered with **no** `configSchema` — "Script
 * (interface only)".
 */
export const BUILT_IN_NODE_MANIFESTS: readonly NodeManifest[] = [
  manifest(NodeType.START, "Start", "Marks the entry point of a Workflow Definition."),
  manifest(NodeType.END, "End", "Marks a terminal point of a Workflow Definition."),
  manifest(
    NodeType.CONDITION,
    "Condition",
    "Gates a single outgoing path by an Expression.",
    z.object({ expression: z.string().min(1) }),
  ),
  manifest(
    NodeType.SWITCH,
    "Switch",
    "Selects among multiple outgoing paths by an Expression.",
    z.object({ expression: z.string().min(1), cases: z.array(z.string().min(1)).min(1) }),
  ),
  manifest(
    NodeType.MERGE,
    "Merge",
    "Joins multiple incoming paths into one.",
    z.object({ waitForAll: z.boolean().optional() }),
  ),
  manifest(
    NodeType.FORK,
    "Fork",
    "Splits execution into multiple parallel branches.",
    z.object({ branchCount: z.number().int().min(2) }),
  ),
  manifest(
    NodeType.JOIN,
    "Join",
    "Waits for multiple parallel branches to complete.",
    z.object({ branchCount: z.number().int().min(2) }),
  ),
  manifest(
    NodeType.LOOP,
    "Loop",
    "Repeats a body while a condition holds.",
    z.object({
      condition: z.string().min(1),
      maxIterations: z.number().int().positive().optional(),
    }),
  ),
  manifest(
    NodeType.DELAY,
    "Delay",
    "Pauses for a fixed duration.",
    z.object({ durationMs: z.number().int().positive() }),
  ),
  manifest(
    NodeType.TIMER,
    "Timer",
    "Fires after a fixed duration, independent of the Delay Node's semantics.",
    z.object({ durationMs: z.number().int().positive() }),
  ),
  manifest(
    NodeType.WAIT,
    "Wait",
    "Pauses until a condition holds.",
    z.object({ condition: z.string().min(1).optional() }),
  ),
  manifest(
    NodeType.EVENT,
    "Event",
    "Waits for a named external event.",
    z.object({ eventType: z.string().min(1) }),
  ),
  manifest(
    NodeType.HUMAN,
    "Human",
    "Requests human interaction.",
    z.object({ assigneeRole: z.string().min(1).optional(), formRef: z.string().min(1).optional() }),
  ),
  manifest(
    NodeType.AI,
    "AI",
    "Generic AI interaction — contract only, no LLM call.",
    z.object({ instruction: z.string().min(1) }),
  ),
  manifest(
    NodeType.KNOWLEDGE,
    "Knowledge",
    "References a Knowledge Base — contract only, no RAG.",
    z.object({ knowledgeBaseId: z.string().min(1) }),
  ),
  manifest(
    NodeType.MEMORY,
    "Memory",
    "References a Memory scope — contract only, no memory implementation.",
    z.object({ memoryScope: z.string().min(1) }),
  ),
  manifest(
    NodeType.WEBHOOK,
    "Webhook",
    "Registers an inbound webhook — contract only.",
    z.object({ url: z.string().url() }),
  ),
  manifest(
    NodeType.HTTP,
    "HTTP",
    "Describes an outbound HTTP call — contract only, no network call.",
    z.object({ method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]), url: z.string().url() }),
  ),
  manifest(
    NodeType.TRANSFORM,
    "Transform",
    "Describes a data transformation Expression.",
    z.object({ expression: z.string().min(1) }),
  ),
  manifest(
    NodeType.VARIABLE,
    "Variable",
    "Declares or assigns a Workflow Variable.",
    z.object({ name: z.string().min(1), value: z.unknown().optional() }),
  ),
  manifest(
    NodeType.EXPRESSION,
    "Expression",
    "Evaluates an Expression — contract only, no evaluation.",
    z.object({ expression: z.string().min(1) }),
  ),
  manifest(NodeType.SCRIPT, "Script", "Interface only — no config schema, no execution."),
  manifest(
    NodeType.CUSTOM,
    "Custom",
    "Free-form extension point for a custom Node Type.",
    z.record(z.string(), z.unknown()),
  ),
];

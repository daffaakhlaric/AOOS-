import { z } from "zod";

import { TransitionKind } from "../contracts/transition-kind.js";
import { expressionSchema } from "../expressions/expression.js";

/**
 * A Transition — a directed edge between two Nodes (docs/PROMPT-005.6A-WORKFLOW-
 * DEFINITION-LANGUAGE.md — "TRANSITIONS": Next/Condition/Parallel/Merge/Loop/Retry/
 * Failure/Timeout/Compensation). One schema covers every `TransitionKind` — the kind
 * itself, plus which fields are populated, is what changes the transition's meaning; a
 * `Condition` transition sets `condition`, a `Retry`/`Timeout`/`Failure`/`Compensation`
 * transition is what a Node's own `retry`/`timeout`/`compensation` config points at by id.
 */
export const transitionSchema = z.object({
  id: z.string().min(1),
  kind: z.nativeEnum(TransitionKind),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  /** Required when `kind` is `condition` — the guard that must evaluate truthy for this edge to be taken. */
  condition: expressionSchema.optional(),
  /** Disambiguates multiple outgoing transitions from the same node — lower fires first. */
  priority: z.number().int().optional(),
  description: z.string().min(1).optional(),
});

export type Transition = z.infer<typeof transitionSchema>;

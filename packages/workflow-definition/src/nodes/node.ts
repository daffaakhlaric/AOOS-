import { z } from "zod";

import { capabilityNodeSchema } from "./capability-node.js";
import { conditionNodeSchema } from "./condition-node.js";
import { decisionNodeSchema } from "./decision-node.js";
import { delayNodeSchema } from "./delay-node.js";
import { endNodeSchema } from "./end-node.js";
import { humanNodeSchema } from "./human-node.js";
import { loopNodeSchema } from "./loop-node.js";
import { mergeNodeSchema } from "./merge-node.js";
import { parallelNodeSchema } from "./parallel-node.js";
import { startNodeSchema } from "./start-node.js";
import { subWorkflowNodeSchema } from "./sub-workflow-node.js";
import { taskNodeSchema } from "./task-node.js";
import { waitNodeSchema } from "./wait-node.js";

/** The 13 supported Node Types (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md), as one discriminated union keyed by `type`. Event/AI/Script are explicitly future work. */
export const nodeSchema = z.discriminatedUnion("type", [
  startNodeSchema,
  endNodeSchema,
  taskNodeSchema,
  capabilityNodeSchema,
  conditionNodeSchema,
  decisionNodeSchema,
  parallelNodeSchema,
  mergeNodeSchema,
  loopNodeSchema,
  delayNodeSchema,
  waitNodeSchema,
  humanNodeSchema,
  subWorkflowNodeSchema,
]);

export type Node = z.infer<typeof nodeSchema>;

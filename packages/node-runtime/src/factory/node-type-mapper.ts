import { NodeType as DefinitionNodeType } from "@aos/workflow-definition";

import { NodeType } from "../contracts/node-type.js";

/**
 * Maps `@aos/workflow-definition`'s 13 WDL Node Types onto this package's 35 Node
 * Runtime Types. `TASK` and `SUB_WORKFLOW` have no direct Node Runtime equivalent and map
 * to `CUSTOM` — a future revision could introduce dedicated Node Runtime Types for them.
 */
const DEFINITION_NODE_TYPE_MAP: Readonly<Record<DefinitionNodeType, NodeType>> = {
  [DefinitionNodeType.START]: NodeType.START,
  [DefinitionNodeType.END]: NodeType.END,
  [DefinitionNodeType.TASK]: NodeType.CUSTOM,
  [DefinitionNodeType.CAPABILITY]: NodeType.CAPABILITY,
  [DefinitionNodeType.CONDITION]: NodeType.CONDITION,
  [DefinitionNodeType.DECISION]: NodeType.SWITCH,
  [DefinitionNodeType.PARALLEL]: NodeType.FORK,
  [DefinitionNodeType.MERGE]: NodeType.MERGE,
  [DefinitionNodeType.LOOP]: NodeType.LOOP,
  [DefinitionNodeType.DELAY]: NodeType.DELAY,
  [DefinitionNodeType.WAIT]: NodeType.WAIT,
  [DefinitionNodeType.HUMAN]: NodeType.HUMAN,
  [DefinitionNodeType.SUB_WORKFLOW]: NodeType.CUSTOM,
};

export function mapDefinitionNodeType(type: DefinitionNodeType): NodeType {
  return DEFINITION_NODE_TYPE_MAP[type];
}

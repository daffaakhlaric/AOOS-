/** The 13 supported Node Types (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "NODE TYPES"). Event/AI/Script are explicitly future work. */
export enum NodeType {
  START = "start",
  END = "end",
  TASK = "task",
  CAPABILITY = "capability",
  CONDITION = "condition",
  DECISION = "decision",
  PARALLEL = "parallel",
  MERGE = "merge",
  LOOP = "loop",
  DELAY = "delay",
  WAIT = "wait",
  HUMAN = "human",
  SUB_WORKFLOW = "sub_workflow",
}

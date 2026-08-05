/** Transition kinds (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "TRANSITIONS"). */
export enum TransitionKind {
  NEXT = "next",
  CONDITION = "condition",
  PARALLEL = "parallel",
  MERGE = "merge",
  LOOP = "loop",
  RETRY = "retry",
  FAILURE = "failure",
  TIMEOUT = "timeout",
  COMPENSATION = "compensation",
}

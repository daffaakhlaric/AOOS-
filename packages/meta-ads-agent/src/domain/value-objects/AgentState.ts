/** Tamara's current lifecycle state within a single `RunOptimizationCycle`. */
export enum AgentState {
  IDLE = "IDLE",
  ANALYZING = "ANALYZING",
  EXECUTING = "EXECUTING",
  WAITING_APPROVAL = "WAITING_APPROVAL",
}

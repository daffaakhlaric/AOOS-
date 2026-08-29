/**
 * The classification Samantha's DECIDE stage assigns to every finding — per-ad (VerdictDecisionEngine)
 * or portfolio-level (BudgetOptimizer) — before the ACT stage routes it.
 */
export enum DecisionType {
  AUTO_EXECUTE = "AUTO_EXECUTE",
  ESCALATE = "ESCALATE",
  BRIEF_KAI = "BRIEF_KAI",
  NO_ACTION = "NO_ACTION",
}

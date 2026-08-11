/** The 10 conversation stages Jessy's `StageDetector`/`ConversationEngine` moves a lead through (spec "Conversation Stages"). */
export enum ConversationStage {
  GREETING = "GREETING",
  DISCOVERY = "DISCOVERY",
  QUALIFICATION = "QUALIFICATION",
  UNIT_INFO = "UNIT_INFO",
  PRICE_INFO = "PRICE_INFO",
  OBJECTION = "OBJECTION",
  CLOSING = "CLOSING",
  HANDOFF = "HANDOFF",
  NURTURE = "NURTURE",
  CLOSED = "CLOSED",
}

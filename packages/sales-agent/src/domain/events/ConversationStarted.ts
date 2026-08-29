import type { BranchId } from "../value-objects/BranchId.js";

/** Payload for `aaos.sales.conversation.started`, emitted the first time Clara processes a lead's opening message. */
export interface ConversationStarted {
  readonly conversationId: string;
  readonly leadPhone: string;
  readonly branchId: BranchId;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}

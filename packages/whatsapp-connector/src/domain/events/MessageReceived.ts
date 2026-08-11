import type { Branch } from "@aos/meta-ads-connector";

import type { MessageType } from "../value-objects/MessageType.js";

/** Payload for `aaos.whatsapp.message.received`, emitted once per inbound message by `ProcessIncomingWebhook`. */
export interface MessageReceived {
  readonly messageId: string;
  readonly conversationId: string;
  readonly from: string;
  readonly to: string;
  readonly branch: Branch;
  readonly phoneNumberId: string;
  readonly type: MessageType;
  readonly body: string | undefined;
  readonly isFirstMessage: boolean;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}

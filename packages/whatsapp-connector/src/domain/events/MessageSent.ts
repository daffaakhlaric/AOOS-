import type { Branch } from "@aos/meta-ads-connector";

import type { MessageType } from "../value-objects/MessageType.js";

/** Payload for `aaos.whatsapp.message.sent`, emitted once a send use case successfully delivers to the WhatsApp Cloud API. */
export interface MessageSent {
  readonly messageId: string;
  readonly conversationId: string;
  readonly to: string;
  readonly from: string;
  readonly branch: Branch;
  readonly phoneNumberId: string;
  readonly type: MessageType;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}

import type { Branch } from "@aos/meta-ads-connector";

/** Payload for `aaos.whatsapp.message.delivered`, emitted when a `statuses[].status === "delivered"` webhook entry arrives. */
export interface MessageDelivered {
  readonly messageId: string;
  readonly recipientId: string;
  readonly branch: Branch;
  readonly phoneNumberId: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}

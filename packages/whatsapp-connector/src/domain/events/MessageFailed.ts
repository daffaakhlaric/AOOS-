import type { Branch } from "@aos/meta-ads-connector";

/** Payload for `aaos.whatsapp.message.failed`, emitted when a `statuses[].status === "failed"` webhook entry arrives, or a send use case exhausts its retries. */
export interface MessageFailed {
  readonly messageId: string;
  readonly recipientId: string;
  readonly branch: Branch;
  readonly phoneNumberId: string;
  readonly errorCode: number | undefined;
  readonly errorTitle: string | undefined;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}

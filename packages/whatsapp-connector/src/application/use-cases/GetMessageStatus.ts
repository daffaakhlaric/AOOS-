import type { Result } from "@aos/common";
import type { NotFoundError } from "@aos/errors";

import type { MappedMessageStatus } from "../../mappers/MessageStatusMapper.js";
import type { WebhookProcessorService } from "../services/WebhookProcessorService.js";

/** Thin read wrapper around `WebhookProcessorService.getStatus` — the last-known status recorded from an inbound `statuses[]` webhook entry for a given `wamid`. */
export class GetMessageStatus {
  constructor(private readonly webhookProcessor: WebhookProcessorService) {}

  execute(messageId: string): Result<MappedMessageStatus, NotFoundError> {
    return this.webhookProcessor.getStatus(messageId);
  }
}

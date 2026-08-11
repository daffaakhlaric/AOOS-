import type { Result } from "@aos/common";

import type { WebhookError } from "../domain/errors/index.js";
import type { MetaWebhookChange } from "../types/MetaWebhookTypes.js";

/** A single raw lead extracted from a webhook payload's `entry[].changes[]`, before domain mapping. */
export interface RawLeadData {
  readonly change: MetaWebhookChange;
  readonly publisherObject: string;
  readonly receivedAt: Date;
}

/**
 * Port for parsing+validating a raw webhook body into extracted, still-raw lead records.
 * The only implementation is `infrastructure/webhook/WebhookParser.ts`.
 */
export interface ILeadWebhookParser {
  parse(rawBody: string): Result<ReadonlyArray<RawLeadData>, WebhookError>;
}

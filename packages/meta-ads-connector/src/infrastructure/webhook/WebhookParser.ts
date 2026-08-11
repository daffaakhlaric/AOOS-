import { err, ok, type Result } from "@aos/common";

import type { ILeadWebhookParser, RawLeadData } from "../../contracts/ILeadWebhookParser.js";
import { PayloadParseError, type WebhookError } from "../../domain/errors/index.js";
import { MetaWebhookPayloadSchema } from "../../types/MetaWebhookTypes.js";

export interface WebhookParserOptions {
  /** Injectable clock for `receivedAt` stamping — defaults to `() => new Date()`. */
  readonly now?: () => Date;
}

/**
 * Parses+Zod-validates a raw webhook request body and extracts every lead-bearing
 * `entry[].changes[]` row across all entries, per `ProcessLeadWebhook` step 2/3. A payload with
 * zero entries, or entries with zero/no `changes`, is valid and yields an empty array (spec edge
 * case: "Webhook with 0 leads in payload") — not an error.
 */
export class WebhookParser implements ILeadWebhookParser {
  private readonly now: () => Date;

  constructor(options: WebhookParserOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  parse(rawBody: string): Result<ReadonlyArray<RawLeadData>, WebhookError> {
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch (cause) {
      return err(
        new PayloadParseError(
          `Webhook body is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
          { cause },
        ),
      );
    }

    const parsed = MetaWebhookPayloadSchema.safeParse(json);
    if (!parsed.success) {
      return err(
        new PayloadParseError("Webhook body failed schema validation", {
          context: {
            issues: parsed.error.issues.map(
              (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
            ),
          },
        }),
      );
    }

    const receivedAt = this.now();
    const rawLeads: RawLeadData[] = [];
    for (const entry of parsed.data.entry) {
      for (const change of entry.changes ?? []) {
        rawLeads.push({ change, publisherObject: parsed.data.object, receivedAt });
      }
    }
    return ok(rawLeads);
  }
}

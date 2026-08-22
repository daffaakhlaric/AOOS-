import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";

import type { IMetaAdsClient } from "../../contracts/IMetaAdsClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import { ApiServerError, type MetaApiError } from "../../domain/errors/index.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";
import { hashPhoneForAudience, normalizePhoneForAudience } from "../../utils/PhoneHasher.js";

import { callMetaApi } from "./meta-api-call-helpers.js";
import type { Tracer } from "./PullCampaignData.js";

export interface AddUsersToCustomAudienceInput {
  readonly customAudienceId: string;
  /** Raw (unhashed, unnormalized) phone numbers — hashing/normalization happens inside this use case. */
  readonly phones: ReadonlyArray<string>;
  readonly accessToken: string;
}

export interface AddUsersToCustomAudienceOutput {
  readonly numReceived: number | undefined;
  readonly numInvalidEntries: number | undefined;
}

/**
 * AAOS-ABTESTING-LOOKALIKE Part 2: `POST /{custom-audience-id}/users` — SHA256-hashes and uploads
 * a batch of phone numbers into an existing Custom Audience (`payload.schema: ["PHONE"]`).
 * Coordinator note point 3 confirmed this capability did not exist anywhere in `IMetaAdsClient`
 * before this change. Endpoint/params verified 2026-08-21 against Meta's Marketing API "Custom
 * Audiences" guide — the real `schema` literal for phone data is `"PHONE"`, not `"PHONE_SHA256"`.
 */
export class AddUsersToCustomAudience {
  constructor(
    private readonly client: IMetaAdsClient,
    private readonly rateLimiter: IRateLimiter,
    private readonly retry: ExponentialBackoffRetry,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
  ) {}

  async execute(
    input: AddUsersToCustomAudienceInput,
  ): Promise<Result<AddUsersToCustomAudienceOutput, MetaApiError>> {
    return this.tracer.startActiveSpan(
      "meta-ads-connector.add-users-to-custom-audience",
      async (span: { end: () => void }) => {
        try {
          const hashedPhones = input.phones
            .filter((phone) => normalizePhoneForAudience(phone).length > 0)
            .map((phone) => hashPhoneForAudience(phone));
          if (hashedPhones.length === 0) {
            return err(
              new ApiServerError(
                "AddUsersToCustomAudience: no valid phone numbers to upload after normalization",
              ),
            );
          }
          const result = await callMetaApi(this.rateLimiter, this.retry, () =>
            this.client.addUsersToCustomAudience(
              input.customAudienceId,
              { hashedPhones },
              input.accessToken,
            ),
          );
          if (!result.ok) {
            this.logger.warn(
              { customAudienceId: input.customAudienceId, error: result.error.message },
              "meta-ads-connector: adding users to custom audience failed",
            );
            return err(result.error);
          }
          this.logger.info(
            {
              customAudienceId: input.customAudienceId,
              count: hashedPhones.length,
              numReceived: result.value.num_received,
            },
            "meta-ads-connector: users added to custom audience",
          );
          return ok({
            numReceived: result.value.num_received,
            numInvalidEntries: result.value.num_invalid_entries,
          });
        } finally {
          span.end();
        }
      },
    );
  }
}

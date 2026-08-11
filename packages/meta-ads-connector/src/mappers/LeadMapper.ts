import { err, ok, type Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import type { RawLeadData } from "../contracts/ILeadWebhookParser.js";
import { Lead } from "../domain/entities/Lead.js";
import type { AdAccountId } from "../domain/value-objects/AdAccountId.js";
import type { AdId } from "../domain/value-objects/AdId.js";
import type { AdSetId } from "../domain/value-objects/AdSetId.js";
import type { CampaignId } from "../domain/value-objects/CampaignId.js";
import { LeadId } from "../domain/value-objects/LeadId.js";
import { LeadType } from "../domain/value-objects/LeadType.js";
import { PublisherPlatform } from "../domain/value-objects/PublisherPlatform.js";

/** The internal domain identifiers a raw Meta `ad_id` resolves to, once that ad has been synced at least once via `PullCampaignData` and cached in `AdAccountRegistry`. */
export interface AdIdentifiers {
  readonly adId: AdId;
  readonly adSetId: AdSetId;
  readonly campaignId: CampaignId;
  readonly adAccountId: AdAccountId;
}

/**
 * Resolves a raw Meta ad id to its internal AAOS identifiers. Injected rather than hard-wired to
 * `AdAccountRegistry` so `LeadMapper` stays a pure, registry-agnostic function for unit testing.
 */
export type AdResolver = (metaAdId: string) => Result<AdIdentifiers, ValidationError>;

/**
 * Derives the `PublisherPlatform` a webhook entry originated from, from the payload's top-level
 * `object` field (Meta webhook subscription object type — "page", "instagram", "whatsapp_business_account").
 * Judgment call: `"whatsapp_business_account"` (the object type for CTWA-into-WhatsApp webhooks)
 * has no dedicated `PublisherPlatform` member — CTWA ads still run as Facebook/Instagram
 * placements, only the *conversation* happens on WhatsApp — so it defaults to `FACEBOOK`, the
 * platform the ad itself was served on, documented here rather than left implicit.
 */
export function derivePublisherPlatform(webhookObject: string): PublisherPlatform {
  if (webhookObject === "instagram") {
    return PublisherPlatform.INSTAGRAM;
  }
  if (webhookObject === "threads") {
    return PublisherPlatform.THREADS;
  }
  return PublisherPlatform.FACEBOOK;
}

/**
 * Maps one raw extracted webhook lead (`RawLeadData`, from `WebhookParser`) into an AAOS `Lead`
 * entity, resolving the raw Meta `ad_id` to internal UUIDs via the injected `AdResolver`.
 *
 * Known limitation (documented in README/REPORT): a native Meta lead-form webhook (`field:
 * "leadgen"`) does not itself carry the submitted field *values* — only `leadgen_id`/`form_id`,
 * which identify a form submission that must be fetched separately via `GET /{leadgen_id}` (a
 * call this package's `ProcessLeadWebhook` use case does not make, since it is outside the
 * documented step sequence). `formFields` here is therefore populated with the identifying
 * metadata Meta *does* send inline, not the applicant's actual answers.
 */
export function mapLead(raw: RawLeadData, resolve: AdResolver): Result<Lead, ValidationError> {
  const identifiersResult = resolve(raw.change.value.ad_id);
  if (!identifiersResult.ok) {
    return err(identifiersResult.error);
  }
  const identifiers = identifiersResult.value;
  const source = derivePublisherPlatform(raw.publisherObject);
  const receivedAt = raw.receivedAt;

  if (raw.change.field === "leadgen") {
    const { value } = raw.change;
    return Lead.create({
      id: LeadId.generate(),
      adId: identifiers.adId,
      adSetId: identifiers.adSetId,
      campaignId: identifiers.campaignId,
      adAccountId: identifiers.adAccountId,
      type: LeadType.FORM,
      formFields: {
        leadgen_id: value.leadgen_id,
        form_id: value.form_id,
        ...(value.page_id !== undefined ? { page_id: value.page_id } : {}),
      },
      source,
      receivedAt,
    });
  }

  const { value } = raw.change;
  return Lead.create({
    id: LeadId.generate(),
    adId: identifiers.adId,
    adSetId: identifiers.adSetId,
    campaignId: identifiers.campaignId,
    adAccountId: identifiers.adAccountId,
    type: LeadType.CTWA,
    wabaId: value.waba_id,
    phone: value.phone_number,
    source,
    receivedAt,
  });
}

/** Maps every raw lead in a batch, short-circuiting (fail-fast) on the first mapping error. */
export function mapLeads(
  rawLeads: ReadonlyArray<RawLeadData>,
  resolve: AdResolver,
): Result<Lead[], ValidationError> {
  const leads: Lead[] = [];
  for (const raw of rawLeads) {
    const result = mapLead(raw, resolve);
    if (!result.ok) {
      return err(result.error);
    }
    leads.push(result.value);
  }
  return ok(leads);
}

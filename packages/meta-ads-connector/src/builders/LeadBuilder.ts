import type { Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import { Lead, type LeadProps } from "../domain/entities/Lead.js";
import { AdAccountId } from "../domain/value-objects/AdAccountId.js";
import { AdId } from "../domain/value-objects/AdId.js";
import { AdSetId } from "../domain/value-objects/AdSetId.js";
import { CampaignId } from "../domain/value-objects/CampaignId.js";
import { LeadId } from "../domain/value-objects/LeadId.js";
import { LeadType } from "../domain/value-objects/LeadType.js";
import { PublisherPlatform } from "../domain/value-objects/PublisherPlatform.js";

/** Builder Pattern class for constructing `Lead` entities with sensible defaults — see `CampaignBuilder`'s docstring for the rationale. Defaults to a valid CTWA lead; call `.withType(LeadType.FORM).withFormFields({...})` for a Form lead (`.withPhone`/`.withWabaId` are ignored by `Lead.create` unless `type === CTWA`). */
export class LeadBuilder {
  private props: LeadProps = {
    id: unwrapOrThrow(LeadId.create("00000000-0000-4000-8000-000000000004")),
    adId: unwrapOrThrow(AdId.create("00000000-0000-4000-8000-000000000003")),
    adSetId: unwrapOrThrow(AdSetId.create("00000000-0000-4000-8000-000000000002")),
    campaignId: unwrapOrThrow(CampaignId.create("00000000-0000-4000-8000-000000000001")),
    adAccountId: unwrapOrThrow(AdAccountId.create("act_752604553578354")),
    type: LeadType.CTWA,
    wabaId: "wa-business-account-1",
    phone: "+6281234567890",
    formFields: undefined,
    source: PublisherPlatform.FACEBOOK,
    receivedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  withId(id: LeadId): this {
    this.props = { ...this.props, id };
    return this;
  }

  withAdId(adId: AdId): this {
    this.props = { ...this.props, adId };
    return this;
  }

  withAdSetId(adSetId: AdSetId): this {
    this.props = { ...this.props, adSetId };
    return this;
  }

  withCampaignId(campaignId: CampaignId): this {
    this.props = { ...this.props, campaignId };
    return this;
  }

  withAdAccountId(adAccountId: AdAccountId): this {
    this.props = { ...this.props, adAccountId };
    return this;
  }

  withType(type: LeadType): this {
    this.props = { ...this.props, type };
    return this;
  }

  withWabaId(wabaId: string | undefined): this {
    this.props = { ...this.props, wabaId };
    return this;
  }

  withPhone(phone: string | undefined): this {
    this.props = { ...this.props, phone };
    return this;
  }

  withFormFields(formFields: Readonly<Record<string, string>> | undefined): this {
    this.props = { ...this.props, formFields };
    return this;
  }

  withSource(source: PublisherPlatform): this {
    this.props = { ...this.props, source };
    return this;
  }

  withReceivedAt(receivedAt: Date): this {
    this.props = { ...this.props, receivedAt };
    return this;
  }

  build(): Result<Lead, ValidationError> {
    return Lead.create(this.props);
  }
}

function unwrapOrThrow<T>(result: Result<T, ValidationError>): T {
  // Unreachable in practice: every default literal above (fixed UUIDs, etc.) is valid by
  // construction. This guards only against a future edit introducing an invalid hardcoded default.
  /* v8 ignore next 3 */
  if (!result.ok) {
    throw new Error(`LeadBuilder default construction failed: ${result.error.message}`);
  }
  return result.value;
}

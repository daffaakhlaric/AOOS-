import { err, ok, type Result } from "@aos/common";

import type { IEventHasher } from "../contracts/IEventHasher.js";
import { CapiEvent } from "../domain/entities/CapiEvent.js";
import { HashingError } from "../domain/errors/HashingError.js";
import { ActionSource } from "../domain/value-objects/ActionSource.js";
import { EventName } from "../domain/value-objects/EventName.js";
import { EventSourceUrl } from "../domain/value-objects/EventSourceUrl.js";
import { EventTime } from "../domain/value-objects/EventTime.js";

export interface LeadEventMapperInput {
  /** E.164 (`+62...`) phone number, as `Lead.leadPhone.toString()` produces. */
  readonly phone: string;
  readonly name?: string;
  readonly adId?: string;
  readonly campaignId?: string;
  readonly occurredAt: Date;
}

/** Maps lead-store lifecycle signals (`LeadCreated`, `ScoreUpdated` past the 30 threshold, `LeadBecameHot`) into Meta CAPI `Contact` / `InitiateCheckout` / `AddToWishlist` events, per the spec's "AAOS Event -> Meta Event Mapping" table. */
export class LeadToCapiEventMapper {
  constructor(
    private readonly hasher: IEventHasher,
    private readonly eventSourceUrl: string,
  ) {}

  toContact(input: LeadEventMapperInput): Result<CapiEvent, HashingError> {
    return this.build(EventName.CONTACT, input, true);
  }

  toInitiateCheckout(input: LeadEventMapperInput): Result<CapiEvent, HashingError> {
    return this.build(EventName.INITIATE_CHECKOUT, input, false);
  }

  toAddToWishlist(input: LeadEventMapperInput): Result<CapiEvent, HashingError> {
    return this.build(EventName.ADD_TO_WISHLIST, input, true);
  }

  private build(
    eventName: EventName,
    input: LeadEventMapperInput,
    withContentType: boolean,
  ): Result<CapiEvent, HashingError> {
    const phoneResult = this.hasher.hashPhone(input.phone);
    if (!phoneResult.ok) {
      return err(phoneResult.error);
    }
    let nameHash;
    if (input.name !== undefined) {
      const nameResult = this.hasher.hashName(input.name);
      if (!nameResult.ok) {
        return err(nameResult.error);
      }
      nameHash = nameResult.value;
    }

    const eventTimeResult = EventTime.fromDate(input.occurredAt);
    const urlResult = EventSourceUrl.create(this.eventSourceUrl);
    if (!eventTimeResult.ok) {
      return err(new HashingError(eventTimeResult.error.message, { cause: eventTimeResult.error }));
    }
    if (!urlResult.ok) {
      return err(new HashingError(urlResult.error.message, { cause: urlResult.error }));
    }

    const contentIds = input.adId !== undefined ? [input.adId] : undefined;
    const created = CapiEvent.create({
      eventName,
      eventTime: eventTimeResult.value,
      eventSourceUrl: urlResult.value,
      actionSource: ActionSource.website(),
      userData: {
        ph: [phoneResult.value],
        fn: nameHash !== undefined ? [nameHash] : undefined,
        country: [this.hasher.hashCountry()],
        clientUserAgent: "",
      },
      customData:
        contentIds !== undefined
          ? { contentIds, contentType: withContentType ? "product" : undefined }
          : undefined,
    });
    if (!created.ok) {
      return err(new HashingError(created.error.message, { cause: created.error }));
    }
    return ok(created.value);
  }
}

import { err, ok, type Result } from "@aos/common";

import type { IEventHasher } from "../contracts/IEventHasher.js";
import { CapiEvent } from "../domain/entities/CapiEvent.js";
import { HashingError } from "../domain/errors/HashingError.js";
import { ActionSource } from "../domain/value-objects/ActionSource.js";
import { CurrencyCode } from "../domain/value-objects/CurrencyCode.js";
import { EventName } from "../domain/value-objects/EventName.js";
import { EventSourceUrl } from "../domain/value-objects/EventSourceUrl.js";
import { EventTime } from "../domain/value-objects/EventTime.js";

export interface ClosingLeadEventMapperInput {
  /** E.164 (`+62...`) phone number, resolved via `GetLead` (`ClosingRecorded` carries no phone — coordinator note #4). */
  readonly phone: string;
  readonly name?: string;
  readonly unitId?: string;
  readonly occurredAt: Date;
}

export interface ClosingPurchaseEventMapperInput extends ClosingLeadEventMapperInput {
  /** Sale price (IDR) — resolved from the `Closing` entity via `IClosingRepository`, never `commissionIdr` (coordinator note #4). */
  readonly unitPrice: number;
}

/** Maps lead-store's `ClosingRecorded` (`TEST_DRIVE` / `SPK`) into Meta CAPI `Lead` / `Purchase` events, per the spec's "AAOS Event -> Meta Event Mapping" table. `CANCELLED` is intentionally not mapped by this class — `EventListenerService` no-ops it before ever calling here (coordinator note #5). */
export class ClosingToCapiEventMapper {
  constructor(
    private readonly hasher: IEventHasher,
    private readonly eventSourceUrl: string,
  ) {}

  /** `TEST_DRIVE` closing -> `"Lead"`. */
  toLead(input: ClosingLeadEventMapperInput): Result<CapiEvent, HashingError> {
    return this.build(EventName.LEAD, input, undefined);
  }

  /** `SPK` closing -> `"Purchase"`, with `custom_data.value`/`currency`. */
  toPurchase(input: ClosingPurchaseEventMapperInput): Result<CapiEvent, HashingError> {
    return this.build(EventName.PURCHASE, input, input.unitPrice);
  }

  private build(
    eventName: EventName,
    input: ClosingLeadEventMapperInput,
    unitPrice: number | undefined,
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

    const contentIds = input.unitId !== undefined ? [input.unitId] : undefined;
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
        contentIds !== undefined || unitPrice !== undefined
          ? {
              value: unitPrice,
              currency: unitPrice !== undefined ? CurrencyCode.idr() : undefined,
              contentIds,
              contentType: contentIds !== undefined ? "product" : undefined,
            }
          : undefined,
    });
    if (!created.ok) {
      return err(new HashingError(created.error.message, { cause: created.error }));
    }
    return ok(created.value);
  }
}

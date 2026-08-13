import { err, ok, type Result } from "@aos/common";

import type { EventDispatchContext, IEventBatcher } from "../../contracts/IEventBatcher.js";
import type { EventResult } from "../../domain/entities/EventResult.js";
import type { CapiError } from "../../domain/errors/CapiError.js";
import type {
  ClosingLeadEventMapperInput,
  ClosingPurchaseEventMapperInput,
  ClosingToCapiEventMapper,
} from "../../mappers/ClosingToCapiEventMapper.js";
import type {
  LeadEventMapperInput,
  LeadToCapiEventMapper,
} from "../../mappers/LeadToCapiEventMapper.js";

export type SendEventInput = LeadEventMapperInput & EventDispatchContext;
export type SendLeadInput = ClosingLeadEventMapperInput & EventDispatchContext;
export type SendPurchaseInput = ClosingPurchaseEventMapperInput & EventDispatchContext;

/** The single `pending`-or-flushed `EventResult` for one mapped-and-batched send call — `batchSize = 1` (MVP default) always returns the flushed result; a larger `batchSize` returns a `pending: true` placeholder until the buffer's threshold is reached. */
function toSingleResult(
  flushResults: readonly EventResult[],
  fallbackEventName: EventResult["eventName"],
): EventResult {
  const [first] = flushResults;
  return first ?? { eventName: fallbackEventName, success: true, pending: true };
}

/** Orchestrates event creation (via the mappers) + hashing + batched sending (via `EventBatcherService`), per the spec's `CapiEventService` "orchestrate event creation + sending" responsibility. */
export class CapiEventService {
  constructor(
    private readonly leadMapper: LeadToCapiEventMapper,
    private readonly closingMapper: ClosingToCapiEventMapper,
    private readonly batcher: IEventBatcher,
  ) {}

  async sendContact(input: SendEventInput): Promise<Result<EventResult, CapiError>> {
    return this.sendLeadEvent((mapperInput) => this.leadMapper.toContact(mapperInput), input);
  }

  async sendInitiateCheckout(input: SendEventInput): Promise<Result<EventResult, CapiError>> {
    return this.sendLeadEvent(
      (mapperInput) => this.leadMapper.toInitiateCheckout(mapperInput),
      input,
    );
  }

  async sendAddToWishlist(input: SendEventInput): Promise<Result<EventResult, CapiError>> {
    return this.sendLeadEvent((mapperInput) => this.leadMapper.toAddToWishlist(mapperInput), input);
  }

  async sendLead(input: SendLeadInput): Promise<Result<EventResult, CapiError>> {
    const eventResult = this.closingMapper.toLead(input);
    if (!eventResult.ok) {
      return err(eventResult.error);
    }
    const flushResult = await this.batcher.add(eventResult.value, input);
    if (!flushResult.ok) {
      return err(flushResult.error);
    }
    return ok(toSingleResult(flushResult.value, eventResult.value.eventName));
  }

  async sendPurchase(input: SendPurchaseInput): Promise<Result<EventResult, CapiError>> {
    const eventResult = this.closingMapper.toPurchase(input);
    if (!eventResult.ok) {
      return err(eventResult.error);
    }
    const flushResult = await this.batcher.add(eventResult.value, input);
    if (!flushResult.ok) {
      return err(flushResult.error);
    }
    return ok(toSingleResult(flushResult.value, eventResult.value.eventName));
  }

  private async sendLeadEvent(
    map: (input: LeadEventMapperInput) => ReturnType<LeadToCapiEventMapper["toContact"]>,
    input: SendEventInput,
  ): Promise<Result<EventResult, CapiError>> {
    const eventResult = map(input);
    if (!eventResult.ok) {
      return err(eventResult.error);
    }
    const flushResult = await this.batcher.add(eventResult.value, input);
    if (!flushResult.ok) {
      return err(flushResult.error);
    }
    return ok(toSingleResult(flushResult.value, eventResult.value.eventName));
  }
}
